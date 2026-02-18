const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  const db = cloud.database()
  const wxContext = cloud.getWXContext()
  const { action, uuid, email, code, username, password } = event

  // --------------------------------------------------
  // 场景 0：账号密码登录
  // --------------------------------------------------
  if (action === 'loginByAccount') {
    if (!username || !password) {
      return { success: false, message: '账号或密码不能为空' }
    }

    // SHA256 Hash the password
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex')

    const res = await db.collection('admins').where({
      username: username,
      password: hashedPassword
    }).get()

    if (res.data.length > 0) {
      const admin = res.data[0]
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

    // Verify old password
    const oldHashed = crypto.createHash('sha256').update(oldPassword).digest('hex')
    const res = await db.collection('admins').where({
      username: username,
      password: oldHashed
    }).get()

    if (res.data.length === 0) {
      return { success: false, message: '旧密码错误' }
    }

    // Update new password
    const newHashed = crypto.createHash('sha256').update(newPassword).digest('hex')
    const adminId = res.data[0]._id

    await db.collection('admins').doc(adminId).update({
      data: {
        password: newHashed,
        updateTime: db.serverDate()
      }
    })

    return { success: true, message: '密码修改成功' }
  }

  // --------------------------------------------------
  // 场景 1：Web 端请求获取二维码 UUID
  // --------------------------------------------------
  if (action === 'getUUID') {
    const newUuid = 'admin-qr-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6)
    
    await db.collection('login_sessions').add({
      data: {
        uuid: newUuid,
        status: 'pending', // pending -> scanned -> confirmed -> expired
        createdAt: db.serverDate(),
        expireAt: Date.now() + 5 * 60 * 1000 // 5分钟有效期
      }
    })
    
    return { success: true, uuid: newUuid }
  }

  // --------------------------------------------------
  // 场景 2：Web 端轮询检查登录状态
  // --------------------------------------------------
  if (action === 'checkStatus') {
    if (!uuid) return { success: false, message: '缺少 uuid' }
    
    const res = await db.collection('login_sessions').where({
      uuid: uuid
    }).get()
    
    if (res.data.length === 0) {
      return { success: false, status: 'invalid', message: '二维码无效或已过期' }
    }
    
    const session = res.data[0]
    if (Date.now() > session.expireAt) {
      return { success: false, status: 'expired', message: '二维码已过期' }
    }
    
    if (session.status === 'confirmed') {
      // 登录成功！返回管理员信息（注意脱敏）
      // 此时可以生成一个自定义 Token 返回给 Web 端，或者直接返回用户信息
      return { 
        success: true, 
        status: 'confirmed', 
        admin: session.adminInfo 
      }
    }
    
    return { success: true, status: session.status } // pending 或 scanned
  }

  // --------------------------------------------------
  // 场景 3：小程序端 -> 确认登录 (扫码后点击确认)
  // --------------------------------------------------
  if (action === 'confirmLogin') {
    if (!uuid) return { success: false, message: '缺少 uuid' }
    
    // 1. 验证当前小程序用户是否是管理员
    const openid = wxContext.OPENID
    // 优先查 admins 集合 (根据用户截图确认存在 admins 且字段为 _openid)
    let adminRes = await db.collection('admins').where({ _openid: openid }).get()
    
    // 如果 admins 没查到，尝试兼容 sys_user (CMS)
    if (adminRes.data.length === 0) {
       adminRes = await db.collection('sys_user').where({ _openid: openid }).get()
    }

    if (adminRes.data.length === 0) {
       // 尝试用 openid 字段查 (以防万一)
       adminRes = await db.collection('admins').where({ openid: openid }).get()
    }
    
    if (adminRes.data.length === 0) {
      return { success: false, message: '您不是管理员，无权登录后台' }
    }
    
    const adminInfo = adminRes.data[0]
    
    // 2. 更新 session 状态为 confirmed
    await db.collection('login_sessions').where({
      uuid: uuid
    }).update({
      data: {
        status: 'confirmed',
        adminInfo: {
          _id: adminInfo._id,
          username: adminInfo.username || adminInfo.nickName,
          role: 'admin',
          openid: openid
        },
        confirmedAt: db.serverDate()
      }
    })
    
    return { success: true, message: '授权登录成功' }
  }

  // --------------------------------------------------
  // 场景 4：邮箱验证码登录验证 (Web 端提交验证码)
  // --------------------------------------------------
  if (action === 'verifyEmail') {
    if (!email || !code) return { success: false, message: '参数不全' }
    
    // 1. 查找验证码记录
    const codeRes = await db.collection('verify_codes').where({
      email: email,
      code: code,
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
