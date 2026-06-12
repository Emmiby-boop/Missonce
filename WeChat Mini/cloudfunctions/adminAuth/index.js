const cloud = require('wx-server-sdk')
const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const CryptoJS = require('crypto-js') // ⚠️ 保留用于向后兼容旧密码，迁移完成后可移除

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const SALT_ROUNDS = 12

/**
 * 使用 bcrypt 哈希密码（新密码）
 */
const hashPassword = async (pwd) => {
  return bcrypt.hash(pwd, SALT_ROUNDS)
}

/**
 * 验证密码 - 兼容 bcrypt 和旧版 SHA256
 * 如果存储的哈希是旧版 SHA256，验证通过后会自动升级为 bcrypt
 */
const verifyPassword = async (pwd, storedHash, upgradeCallback) => {
  // 1. 判断是否为 bcrypt 哈希（以 $2a$ 或 $2b$ 开头）
  const isBcrypt = storedHash && (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$'))

  if (isBcrypt) {
    // bcrypt 验证
    return await bcrypt.compare(pwd, storedHash)
  }

  // 2. 旧版 SHA256 兼容验证
  const oldHash = CryptoJS.SHA256(pwd).toString()
  if (oldHash === storedHash) {
    // 自动升级：将旧哈希迁移为 bcrypt
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

exports.main = async (event, context) => {
  const db = cloud.database()
  const wxContext = cloud.getWXContext()
  const { action, uuid, email, code, username, password } = event
  console.log('[adminAuth] received action:', action, 'full event keys:', Object.keys(event))

  // --------------------------------------------------
  // 场景 0：账号密码登录
  // --------------------------------------------------
  if (action === 'loginByAccount') {
    if (!username || !password) {
      return { success: false, message: '账号或密码不能为空' }
    }

    // 查找管理员账号
    const res = await db.collection('admins').where({
      username: username
    }).get()

    if (res.data.length === 0) {
      return { success: false, message: '账号或密码错误' }
    }

    const admin = res.data[0]

    // 使用升级版验证（兼容 SHA256 旧密码并自动迁移）
    const isPasswordValid = await verifyPassword(password, admin.password, async (newHash) => {
      // 自动升级密码哈希
      await db.collection('admins').doc(admin._id).update({
        data: {
          password: newHash,
          updateTime: db.serverDate()
        }
      })
    })

    if (isPasswordValid) {
      return {
        success: true,
        message: '登录成功',
        admin: {
          _id: admin._id,
          username: admin.username,
          role: admin.role || 'admin',
          avatarUrl: admin.avatarUrl || ''
        }
      }
    } else {
      return { success: false, message: '账号或密码错误' }
    }
  }

  // --------------------------------------------------
  // 场景 0.5：修改密码
  // --------------------------------------------------
  if (action === 'changePassword') {
    const { oldPassword, newPassword } = event
    if (!username || !oldPassword || !newPassword) {
      return { success: false, message: '参数不完整' }
    }

    // 查找管理员账号
    const res = await db.collection('admins').where({
      username: username
    }).get()

    if (res.data.length === 0) {
      return { success: false, message: '账号不存在' }
    }

    const admin = res.data[0]

    // 验证旧密码（兼容 SHA256 旧密码）
    const isOldPasswordValid = await verifyPassword(oldPassword, admin.password, async (newHash) => {
      // 自动升级密码哈希
      await db.collection('admins').doc(admin._id).update({
        data: { password: newHash, updateTime: db.serverDate() }
      })
    })

    if (!isOldPasswordValid) {
      return { success: false, message: '旧密码错误' }
    }

    // 使用 bcrypt 哈希新密码
    const newHashed = await hashPassword(newPassword)

    await db.collection('admins').doc(admin._id).update({
      data: {
        password: newHashed,
        updateTime: db.serverDate()
      }
    })

    return { success: true, message: '密码修改成功' }
  }

  // --------------------------------------------------
  // 场景 4：邮箱验证码登录验证 (Web 端提交验证码)
  // --------------------------------------------------
  if (action === 'verifyEmail') {
    if (!email || !code) return { success: false, message: '参数不全' }
    
    // 🔒 频率限制：同一邮箱 5 分钟内最多尝试 5 次
    const fiveMinAgo = Date.now() - 5 * 60 * 1000
    const failedAttempts = await db.collection('verify_codes')
      .where({
        email: email,
        used: true,
        createdAt: db.command.gte(new Date(fiveMinAgo))
      })
      .count()
    
    if (failedAttempts.total >= 5) {
      return { success: false, message: '验证失败次数过多，请 5 分钟后再试' }
    }
    
    // 1. 查找验证码记录
    const codeHash = CryptoJS.SHA256(code).toString()
    const codeRes = await db.collection('verify_codes').where({
      email: email,
      codeHash: codeHash,
      used: false
    }).orderBy('createdAt', 'desc').limit(1).get()
    
    if (codeRes.data.length === 0) {
      return { success: false, message: '验证码错误或不存在' }
    }
    
    const record = codeRes.data[0]
    if (Date.now() > record.expireAt) {
      return { success: false, message: '验证码已过期' }
    }
    
    // 2. 标记验证码为已使用
    await db.collection('verify_codes').doc(record._id).update({
      data: { used: true }
    })
    
    // 3. 获取管理员信息
    // 优先查 admins 集合
    let adminRes = await db.collection('admins').where({ email: email }).get()
    
    if (adminRes.data.length === 0) {
       // 兼容 sys_user
       adminRes = await db.collection('sys_user').where({ email: email }).get()
    }
    
    if (adminRes.data.length === 0) {
      return { success: false, message: '管理员不存在' }
    }
    
    return { 
      success: true, 
      message: '登录成功', 
      admin: adminRes.data[0] 
    }
  }

  return { success: false, message: '未知 action' }
}
