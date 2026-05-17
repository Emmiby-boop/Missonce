const cloud = require('wx-server-sdk')
const CryptoJS = require('crypto-js')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  const db = cloud.database()
  const wxContext = cloud.getWXContext()
  const { action, uuid, email, code, username, password } = event

  const hashPassword = (pwd) => {
    return CryptoJS.SHA256(pwd).toString()
  }

  // --------------------------------------------------
  // 场景 0：账号密码登录
  // --------------------------------------------------
  if (action === 'loginByAccount') {
    if (!username || !password) {
      return { success: false, message: '账号或密码不能为空' }
    }

    // SHA256 Hash the password
    const hashedPassword = hashPassword(password)

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
    const oldHashed = hashPassword(oldPassword)
    const res = await db.collection('admins').where({
      username: username,
      password: oldHashed
    }).get()

    if (res.data.length === 0) {
      return { success: false, message: '旧密码错误' }
    }

    // Update new password
    const newHashed = hashPassword(newPassword)
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
