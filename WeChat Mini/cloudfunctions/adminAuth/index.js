const cloud = require('wx-server-sdk')
const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const CryptoJS = require('crypto-js')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

const SALT_ROUNDS = 12

if (!process.env.SESSION_SECRET) {
  throw new Error('[adminAuth] 未配置 SESSION_SECRET 环境变量，无法安全签发/校验管理员 Token。请在云开发控制台 → 云函数 → 环境变量中设置 SESSION_SECRET。')
}
const SECRET = process.env.SESSION_SECRET

const TOKEN_TTL = 24 * 60 * 60 * 1000

function sign(data) {
  return crypto
    .createHmac('sha256', SECRET)
    .update(data)
    .digest('hex')
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false
  }
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch (e) {
    return false
  }
}

async function generateToken(adminId) {
  // 读取最新 tokenVersion（改密/登出会递增使其失效）
  let tokenVersion = 0
  try {
    const r = await db.collection('admins').doc(adminId).get()
    if (r.data) tokenVersion = r.data.tokenVersion || 0
  } catch (e) {
    console.warn('[adminAuth] 读取 tokenVersion 失败，使用 0:', e.message)
  }
  const timestamp = Date.now()
  const payload = `${adminId}.${timestamp}.${tokenVersion}`
  const signature = sign(payload)

  return {
    token: `${payload}.${signature}`,
    expiresAt: timestamp + TOKEN_TTL,
    adminId
  }
}

async function verifyAndGetAdmin(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'TOKEN_EMPTY' }
  }

  const parts = token.split('.')
  if (parts.length !== 4) {
    return { valid: false, reason: 'TOKEN_FORMAT_INVALID' }
  }

  const [adminId, timestampStr, tokenVersionStr, providedSignature] = parts

  const payload = `${adminId}.${timestampStr}.${tokenVersionStr}`
  const expectedSignature = sign(payload)

  if (!safeEqual(providedSignature, expectedSignature)) {
    return { valid: false, reason: 'TOKEN_SIGNATURE_MISMATCH' }
  }

  const timestamp = parseInt(timestampStr, 10)
  if (isNaN(timestamp)) {
    return { valid: false, reason: 'TOKEN_TIMESTAMP_INVALID' }
  }

  if (Date.now() - timestamp > TOKEN_TTL) {
    return { valid: false, reason: 'TOKEN_EXPIRED' }
  }

  try {
    let adminRes
    if (adminId.match(/^[a-f0-9]{24}$/i)) {
      adminRes = await db.collection('admins').doc(adminId).get()
    } else {
      adminRes = await db.collection('admins').where({
        _id: adminId
      }).get()
    }

    if (!adminRes.data || adminRes.data.length === 0) {
      return { valid: false, reason: 'ADMIN_NOT_FOUND' }
    }

    const admin = adminRes.data[0] || adminRes.data

    if (admin.status === 'disabled' || admin.status === 'banned') {
      return { valid: false, reason: 'ADMIN_DISABLED' }
    }

    // 令牌版本校验：改密 / 登出会递增 tokenVersion，使旧令牌立即失效
    const tokenVersion = parseInt(tokenVersionStr, 10) || 0
    const currentVersion = admin.tokenVersion || 0
    if (tokenVersion !== currentVersion) {
      return { valid: false, reason: 'TOKEN_REVOKED' }
    }

    return {
      valid: true,
      admin: {
        _id: admin._id,
        username: admin.username,
        role: admin.role || 'admin',
        phone: admin.phone || '',
        email: admin.email || '',
        createdAt: admin.createdAt,
        tokenVersion: admin.tokenVersion || 0
      },
      expiresAt: timestamp + TOKEN_TTL
    }
  } catch (err) {
    console.error('[adminAuth] 查询 admin 失败:', err)
    return { valid: false, reason: 'DB_ERROR', error: err.message }
  }
}

function getFailMessage(reason) {
  const messages = {
    'TOKEN_EMPTY': '登录凭证为空',
    'TOKEN_FORMAT_INVALID': '登录凭证格式无效',
    'TOKEN_SIGNATURE_MISMATCH': '登录凭证无效',
    'TOKEN_TIMESTAMP_INVALID': '登录凭证时间戳无效',
    'TOKEN_EXPIRED': '登录已过期，请重新登录',
    'TOKEN_REVOKED': '登录已失效，请重新登录',
    'ADMIN_NOT_FOUND': '账号不存在或已被删除',
    'ADMIN_DISABLED': '账号已被禁用',
    'DB_ERROR': '系统错误，请稍后重试',
    'TOKEN_MISSING': '未提供登录凭证'
  }
  return messages[reason] || '认证失败'
}

const hashPassword = async (pwd) => {
  return bcrypt.hash(pwd, SALT_ROUNDS)
}

const verifyPassword = async (pwd, storedHash, upgradeCallback) => {
  const isBcrypt = storedHash && (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$'))

  if (isBcrypt) {
    return await bcrypt.compare(pwd, storedHash)
  }

  const oldHash = CryptoJS.SHA256(pwd).toString()
  if (oldHash === storedHash) {
    if (upgradeCallback) {
      try {
        const newHash = await bcrypt.hash(pwd, SALT_ROUNDS)
        await upgradeCallback(newHash)
        console.log('密码哈希已从 SHA256 升级为 bcrypt')
      } catch (e) {
        console.warn('密码哈希自动升级失败（不影响登录）:', e.message)
      }
    }
    return true
  }

  return false
}

async function manageAdmins(event) {
  const data = event.data || {}
  const { action: subAction } = data
  // callFunction 在顶层注入 adminToken；同时兼容 data.adminToken
  const adminToken = data.adminToken || event.adminToken

  if (!adminToken) {
    return { success: false, message: '缺少管理员凭证' }
  }
  const authResult = await verifyAndGetAdmin(adminToken)
  if (!authResult.valid) {
    return { success: false, message: getFailMessage(authResult.reason), reason: authResult.reason }
  }

  if (subAction === 'create') {
    const { username, password, role, phone } = data
    if (!username || !password || !role) {
      return { success: false, message: '缺少必要参数（username / password / role）' }
    }

    const existing = await db.collection('admins').where({ username }).limit(1).get()
    if (existing.data && existing.data.length > 0) {
      return { success: false, message: '用户名已存在' }
    }

    if (phone) {
      const normalizedPhone = String(phone).replace(/[\s+]/g, '').replace(/^86/, '')
      const existingPhone = await db.collection('admins').where({ phone: normalizedPhone }).limit(1).get()
      if (existingPhone.data && existingPhone.data.length > 0) {
        return { success: false, message: '手机号已被其他管理员使用' }
      }
    }

    const hashedPassword = await hashPassword(password)
    const adminData = {
      username,
      password: hashedPassword,
      role,
      status: 'active',
      tokenVersion: 0,
      createdAt: db.serverDate()
    }
    if (phone) {
      adminData.phone = String(phone).replace(/[\s+]/g, '').replace(/^86/, '')
    }
    const result = await db.collection('admins').add({ data: adminData })

    console.log(`[adminAuth] 管理员创建成功: ${username} by ${authResult.admin._id}`)
    return { success: true, message: '管理员创建成功', data: { _id: result._id } }
  }

  if (subAction === 'update') {
    const { id, role, newPassword, phone } = data
    if (!id) {
      return { success: false, message: '缺少管理员 ID' }
    }

    const updateData = { updateTime: db.serverDate() }
    if (role) {
      updateData.role = role
    }
    if (newPassword) {
      updateData.password = await hashPassword(newPassword)
      updateData.tokenVersion = db.command.inc(1) // 重置密码即吊销旧令牌
    }
    if (phone !== undefined) {
      if (phone) {
        const normalizedPhone = String(phone).replace(/[\s+]/g, '').replace(/^86/, '')
        const existingPhone = await db.collection('admins').where({
          phone: normalizedPhone,
          _id: db.command.neq(id)
        }).limit(1).get()
        if (existingPhone.data && existingPhone.data.length > 0) {
          return { success: false, message: '手机号已被其他管理员使用' }
        }
        updateData.phone = normalizedPhone
      } else {
        updateData.phone = ''
      }
    }

    await db.collection('admins').doc(id).update({ data: updateData })
    console.log(`[adminAuth] 管理员更新成功: ${id} by ${authResult.admin._id}`)
    return { success: true, message: '管理员更新成功' }
  }

  if (subAction === 'delete') {
    const { id } = data
    if (!id) {
      return { success: false, message: '缺少管理员 ID' }
    }

    const targetRes = await db.collection('admins').doc(id).get()
    const target = targetRes.data
    if (target && (target.role === 'superadmin' || target.role === 'super_admin')) {
      const superAdmins = await db.collection('admins').where({
        role: target.role
      }).get()
      if (superAdmins.data && superAdmins.data.length <= 1) {
        return { success: false, message: '不能删除最后一个超级管理员' }
      }
    }

    await db.collection('admins').doc(id).remove()
    console.log(`[adminAuth] 管理员删除成功: ${id} by ${authResult.admin._id}`)
    return { success: true, message: '管理员删除成功' }
  }

  if (subAction === 'list') {
    try {
      const res = await db.collection('admins').orderBy('createdAt', 'desc').get()
      // 不返回密码哈希
      const safe = (res.data || []).map(a => {
        const { password, passwordHash, ...rest } = a
        return rest
      })
      return { success: true, data: safe }
    } catch (e) {
      return { success: false, message: '获取管理员列表失败: ' + e.message }
    }
  }

  return { success: false, message: '未知的子操作，支持: create / update / delete / list' }
}

/**
 * 读取 CloudBase Auth 的调用者身份（用于验证码登录的信任链）
 *
 * 背景：P0-2 的根因是 loginByPhone 只凭一个 phone 字符串就签发超管 token，
 * 攻击者可以完全跳过前端的短信验证环节，直接裸调本接口。
 *
 * 实现方式与 @cloudbase/node-sdk 的 auth().getUserInfo() 完全一致：
 * 云函数运行时会把 TCB_CONTEXT_KEYS 列出的键注入到 process.env，
 * node-sdk 内部同样是从 TCB_UUID / TCB_ISANONYMOUS_USER 这两个键取值。
 * 这里直接读取，避免为登录关键路径引入 node-sdk 这个大依赖（冷启动代价）。
 *
 * 关键：这些值由平台注入，客户端无法伪造；匿名用户 isAnonymous 为 true。
 *
 * @returns {{uid:string, customUserId:string, isAnonymous:boolean, loginType:string, source:string}}
 */
function getCallerAuth(context) {
  // 云函数互调等场景下，环境变量可能落在 context.environ 而非 process.env
  const environ = (context && (context.environ || context.environment)) || {}
  const read = (key) => (environ[key] !== undefined ? environ[key] : process.env[key]) || ''

  const uid = read('TCB_UUID') || read('TCB_CUSTOM_USER_ID')

  return {
    uid,
    customUserId: read('TCB_CUSTOM_USER_ID'),
    isAnonymous: String(read('TCB_ISANONYMOUS_USER')).toLowerCase() === 'true',
    loginType: read('LOGINTYPE'),
    source: read('TCB_SOURCE') || read('SOURCE') || ''
  }
}

/**
 * 判断调用者是否已通过 CloudBase Auth 完成「真实的、非匿名」登录。
 * 前端的 register/verifyOtp 流程走的就是 CloudBase Auth 短信验证码，
 * 因此这一步等价于「调用者确实收到了并正确输入了短信验证码」。
 */
function isCallerPhoneVerified(context) {
  const caller = getCallerAuth(context)
  return !!caller.uid && !caller.isAnonymous
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const callerOpenid = wxContext.OPENID
  const { action, token, adminId, username, password, phone } = event
  console.log('[adminAuth] received action:', action)

  if (action === 'generateToken') {
    if (!adminId) {
      return { success: false, message: '缺少 adminId 参数' }
    }

    if (callerOpenid) {
      try {
        const callerRes = await db.collection('admins').where({ _openid: callerOpenid }).limit(1).get()
        if (!callerRes.data || callerRes.data.length === 0) {
          return { success: false, message: '权限不足，仅管理员可生成 Token' }
        }
        const caller = callerRes.data[0]
        if (caller._id !== adminId) {
          return { success: false, message: '禁止为他人生成 Token' }
        }
      } catch (err) {
        console.error('[adminAuth] generateToken 鉴权失败:', err)
        return { success: false, message: '鉴权失败' }
      }
    } else {
      // 🔒 P0-1：无 openid 的调用（Web 端 / curl / 云函数互调）一律拒绝签发。
      //
      // 历史实现在这里是「只要该 adminId 在 admins 表中存在就签发 token」，
      // 等于任何人拿到任一管理员的 24 位 _id（日志、操作记录、分享链接均可泄露）
      // 就能换取超管令牌，进而调用全部 withAdmin 云函数 —— 整个后台失守。
      // 加 ObjectId 格式校验挡不住猜测与泄露，必须直接从行为上禁止。
      //
      // 本 action 当前在前端无任何调用方；正常获取令牌的路径是
      // loginByAccount / loginByPhone / refreshToken，删此分支不影响现有功能。
      console.warn('[adminAuth] generateToken 缺少调用者 openid，已拒绝')
      return { success: false, message: '缺少登录态，无法生成 Token' }
    }

    const result = await generateToken(adminId)
    console.log(`[adminAuth] Token generated for admin: ${String(adminId).slice(0, 4)}****`)
    return { success: true, data: result }
  }

  if (action === 'verifyToken') {
    if (!token) {
      return { success: false, message: '缺少 token 参数', reason: 'TOKEN_MISSING' }
    }

    // 修复 P1-2：verifyAndGetAdmin 接收字符串，传 { token } 会命中
    // `typeof token !== 'string'` 而恒定返回 TOKEN_EMPTY —— 这会让 verifyToken 永久失效，
    // 进而使所有依赖 verifyToken 的 withAdmin 永远判定为未授权。
    const result = await verifyAndGetAdmin(token)

    if (!result.valid) {
      console.warn(`[adminAuth] Token verification failed:`, result.reason)
      return {
        success: false,
        message: getFailMessage(result.reason),
        reason: result.reason
      }
    }

    return {
      success: true,
      data: {
        admin: result.admin,
        expiresIn: Math.floor(((result.expiresAt || 0) - Date.now()) / 1000)
      }
    }
  }

  if (action === 'refreshToken') {
    if (!token) {
      return { success: false, message: '缺少 token 参数' }
    }

    const checkResult = await verifyAndGetAdmin(token)
    if (!checkResult.valid) {
      return {
        success: false,
        message: getFailMessage(checkResult.reason),
        reason: checkResult.reason
      }
    }

    const newToken = await generateToken(checkResult.admin._id)
    console.log(`[adminAuth] Token refreshed for admin: ${checkResult.admin._id}`)
    return { success: true, data: newToken }
  }

  if (action === 'loginByAccount') {
    if (!username || !password) {
      return { success: false, message: '账号或密码不能为空' }
    }

    try {
      const lockKey = `login_fail_${username}`
      const failRes = await db.collection('login_attempts').where({ _key: lockKey }).limit(1).get()
      if (failRes.data.length > 0) {
        const record = failRes.data[0]
        const failCount = record.count || 0
        const lastAttemptTs = record.lastAttempt ? new Date(record.lastAttempt).getTime() : 0
        const lockDuration = 15 * 60 * 1000
        if (failCount >= 5 && (Date.now() - lastAttemptTs) < lockDuration) {
          const remainMin = Math.ceil((lockDuration - (Date.now() - lastAttemptTs)) / 60000)
          return { success: false, message: `账号已被锁定，请 ${remainMin} 分钟后再试` }
        }
        if (failCount >= 5 && (Date.now() - lastAttemptTs) >= lockDuration) {
          await db.collection('login_attempts').doc(record._id).update({ data: { count: 0 } })
        }
      }
    } catch (e) {
      console.warn('[adminAuth] 检查锁定状态出错:', e.message)
    }

    const res = await db.collection('admins').where({
      username: username
    }).get()

    if (res.data.length === 0) {
      return { success: false, message: '账号或密码错误' }
    }

    const admin = res.data[0]

    const isPasswordValid = await verifyPassword(password, admin.password, async (newHash) => {
      await db.collection('admins').doc(admin._id).update({
        data: {
          password: newHash,
          updateTime: db.serverDate()
        }
      })
    })

    if (isPasswordValid) {
      const tokenResult = await generateToken(admin._id)
      console.log(`[adminAuth] Token generated for admin: ${String(admin._id).slice(0, 4)}****`)

      try {
        const lockKey = `login_fail_${username}`
        const failRes = await db.collection('login_attempts').where({ _key: lockKey }).limit(1).get()
        if (failRes.data.length > 0) {
          await db.collection('login_attempts').doc(failRes.data[0]._id).remove()
        }
      } catch (e) {
        console.error('[adminAuth] 清除登录失败记录失败:', e)
      }

      return {
        success: true,
        message: '登录成功',
        admin: {
          _id: admin._id,
          username: admin.username,
          role: admin.role || 'admin',
          avatarUrl: admin.avatarUrl || ''
        },
        token: tokenResult.token
      }
    } else {
      try {
        const lockKey = `login_fail_${username}`
        const failRes = await db.collection('login_attempts').where({ _key: lockKey }).limit(1).get()
        let count = 1
        if (failRes.data.length > 0) {
          count = (failRes.data[0].count || 0) + 1
          await db.collection('login_attempts').doc(failRes.data[0]._id).update({
            data: { count, lastAttempt: new Date() }
          })
        } else {
          await db.collection('login_attempts').add({
            data: { _key: lockKey, count: 1, lastAttempt: new Date(), expireAt: new Date(Date.now() + 15 * 60 * 1000) }
          })
        }
      } catch (e) {
        console.warn('记录登录失败次数出错:', e.message)
      }
      return { success: false, message: '账号或密码错误' }
    }
  }

  if (action === 'loginByPhone') {
    if (!phone) {
      return { success: false, message: '手机号不能为空' }
    }

    const normalizedPhone = phone.replace(/[\s+]/g, '').replace(/^86/, '')

    // 🔒 P0-2：调用者必须已在前端完成 CloudBase Auth 短信验证码校验。
    // 这一步堵死「跳过短信直接裸调 loginByPhone」的路径 —— 即使攻击者知道管理员手机号，
    // 没有真实通过 CloudBase Auth 的已登录会话也无法继续。
    const callerAuth = getCallerAuth(context)
    if (!callerAuth.uid || callerAuth.isAnonymous) {
      console.warn('[adminAuth][loginByPhone] 拒绝：调用者未通过 CloudBase Auth 验证', {
        hasUid: !!callerAuth.uid,
        isAnonymous: callerAuth.isAnonymous,
        source: callerAuth.source
      })
      return {
        success: false,
        message: '未完成短信校验，请在登录页获取并填写验证码后再重试'
      }
    }

    console.log('[adminAuth][loginByPhone] 入参', {
      phone: normalizedPhone,
      callerAuth: {
        uid: String(callerAuth.uid).slice(0, 6) + '****',
        isAnonymous: callerAuth.isAnonymous,
        loginType: callerAuth.loginType,
        source: callerAuth.source
      }
    })

    // 🔒 只按「已绑定且可信」的 CloudBase 身份匹配。authUid 只能经由 bindPhoneLogin
    // 在有效 adminToken（账号密码登录）的前提下写入，因此是可信锚点。
    //
    // 这里刻意不做「phone 命中 + authUid 为空就首次绑定」的自动绑定：
    // 那样等于「知道管理员手机号 + 任意一个通过 CloudBase 验证的手机号」即可抢占绑定，
    // 攻击者用自己手机完成验证就能接管他人账号，区分度不足。
    let admin = null
    let matchBy = ''
    try {
      const res = await db.collection('admins')
        .where({ authUid: callerAuth.uid })
        .limit(1)
        .get()
      if (res.data && res.data.length > 0) {
        admin = res.data[0]
        matchBy = 'authUid'
      }
    } catch (e) {
      console.warn('[adminAuth][loginByPhone] authUid 查询失败', e.message)
    }

    // 未命中时给出可操作的提示：区分「账号不存在」与「存在但未启用验证码登录」
    if (!admin) {
      let phoneMatched = false
      try {
        const res = await db.collection('admins')
          .where({ phone: normalizedPhone })
          .limit(1)
          .get()
        phoneMatched = !!(res.data && res.data.length > 0)
      } catch (e) {
        console.warn('[adminAuth][loginByPhone] phone 存在性检查失败', e.message)
      }

      console.warn('[adminAuth][loginByPhone] 未找到匹配的 authUid', {
        phoneMatched,
        hasPhone: !!normalizedPhone
      })

      return {
        success: false,
        message: phoneMatched
          ? '该账号尚未启用验证码登录。请先用账号密码登录，在「账号安全」中完成一次绑定后再使用。'
          : '该手机号未注册为管理员，请联系超级管理员在后台「管理员管理」中添加'
      }
    }

    // 已移除不可信的 uid / _openid 兜底匹配：
    // 旧逻辑用 wxContext.UID || OPENID 反查管理员，Web 端该值不可靠；
    // 旧的「回填 uid」还会把任意调用者的身份写进管理员记录，属于先污染再信任。

    // 已删除原 uid / _openid 兜底匹配：
    // wxContext.UID || OPENID 在 Web 端不可靠，且旧「回填 uid」逻辑会把任意调用者
    // 的身份写进管理员记录，等于让攻击者自助绑定。信任链改为完全依赖 authUid。

    if (admin.status === 'disabled' || admin.status === 'banned') {
      return { success: false, message: '账号已被禁用，请联系超级管理员' }
    }

    try {
      // 只回填展示用的手机号，绝不在此处写入 authUid —— 绑定必须走 bindPhoneLogin
      if (!admin.phone) {
        await db.collection('admins').doc(admin._id).update({
          data: { phone: normalizedPhone }
        })
        console.log('[adminAuth][loginByPhone] 已回填 phone')
      }
    } catch (e) {
      console.warn('[adminAuth][loginByPhone] 回填 phone 失败:', e.message)
    }

    const tokenResult = await generateToken(admin._id)
    console.log(`[adminAuth] Token generated for admin (matchBy=${matchBy}): ${String(admin._id).slice(0, 4)}****`)

    return {
      success: true,
      message: '登录成功',
      admin: {
        _id: admin._id,
        username: admin.username,
        role: admin.role || 'admin',
        phone: admin.phone || normalizedPhone,
        avatarUrl: admin.avatarUrl || ''
      },
      token: tokenResult.token
    }
  }

  /**
   * 绑定 / 解绑「验证码登录」所使用的 CloudBase 身份
   *
   * P0-2 修复配套：验证码登录改为只认 authUid，因此需要一个受保护的入口来写入它。
   * 绑定必须在已有有效 admin token（账号密码登录）的前提下进行，
   * 并且要求调用者自身已完成 CloudBase Auth 短信验证，杜绝自助抢占。
   */
  if (action === 'bindPhoneLogin' || action === 'unbindPhoneLogin') {
    const wantUnbind = action === 'unbindPhoneLogin'

    if (!token) {
      return { success: false, message: '缺少登录态，请先用账号密码登录' }
    }
    const authRes = await verifyAndGetAdmin(token)
    if (!authRes.valid) {
      return { success: false, message: getFailMessage(authRes.reason), reason: authRes.reason }
    }

    if (wantUnbind) {
      try {
        await db.collection('admins').doc(authRes.admin._id).update({
          data: { authUid: null, authUidBindTime: null }
        })
        return { success: true, message: '已解除验证码登录绑定' }
      } catch (e) {
        return { success: false, message: '解绑失败: ' + e.message }
      }
    }

    // 绑定：要求调用者已完成 CloudBase Auth 的短信验证
    const callerAuth = getCallerAuth(context)
    if (!callerAuth.uid || callerAuth.isAnonymous) {
      return {
        success: false,
        message: '未完成短信校验，请先点击「发送验证码」并填写后再绑定'
      }
    }

    try {
      await db.collection('admins').doc(authRes.admin._id).update({
        data: { authUid: callerAuth.uid, authUidBindTime: db.serverDate() }
      })
      console.log('[adminAuth][bindPhoneLogin] 已绑定当前管理员的验证码登录身份')
      return { success: true, message: '绑定成功，之后可用验证码登录' }
    } catch (e) {
      return { success: false, message: '绑定失败: ' + e.message }
    }
  }

  if (action === 'changePassword') {
    const { oldPassword, newPassword } = event
    if (!username || !oldPassword || !newPassword) {
      return { success: false, message: '参数不完整' }
    }

    const res = await db.collection('admins').where({
      username: username
    }).get()

    if (res.data.length === 0) {
      return { success: false, message: '账号不存在' }
    }

    const admin = res.data[0]

    const isOldPasswordValid = await verifyPassword(oldPassword, admin.password, async (newHash) => {
      await db.collection('admins').doc(admin._id).update({
        data: { password: newHash, updateTime: db.serverDate() }
      })
    })

    if (!isOldPasswordValid) {
      return { success: false, message: '旧密码错误' }
    }

    const newHashed = await hashPassword(newPassword)

    await db.collection('admins').doc(admin._id).update({
      data: {
        password: newHashed,
        updateTime: db.serverDate(),
        // 改密即吊销所有旧令牌
        tokenVersion: db.command.inc(1)
      }
    })

    return { success: true, message: '密码修改成功' }
  }

  if (action === 'logout') {
    if (!token) {
      return { success: false, message: '缺少 token 参数' }
    }
    const checkResult = await verifyAndGetAdmin(token)
    if (!checkResult.valid) {
      return { success: false, message: getFailMessage(checkResult.reason), reason: checkResult.reason }
    }
    try {
      await db.collection('admins').doc(checkResult.admin._id).update({
        data: { tokenVersion: db.command.inc(1), updateTime: db.serverDate() }
      })
      console.log(`[adminAuth] 管理员登出，令牌已吊销: ${checkResult.admin._id}`)
      return { success: true, message: '已退出登录' }
    } catch (e) {
      return { success: false, message: '登出失败: ' + e.message }
    }
  }

  if (action === 'manageAdmins') {
    return await manageAdmins(event)
  }

  return { success: false, message: '未知 action' }
}
