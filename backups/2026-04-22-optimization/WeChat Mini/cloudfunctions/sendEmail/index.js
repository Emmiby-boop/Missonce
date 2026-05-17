const cloud = require('wx-server-sdk')
const nodemailer = require('nodemailer')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// ==========================================
// TODO: 请在此处配置您的 iCloud 发件人信息
// 注意：密码必须是“App 专用密码”，不是您的 Apple ID 密码！
// 获取方法：登录 appleid.apple.com -> 登录和安全 -> App 专用密码 -> 生成一个
// ==========================================
const MAIL_CONFIG = {
  host: 'smtp.mail.me.com',      // iCloud SMTP 服务器地址
  port: 587,                     // iCloud 使用 587 端口 (TLS)
  user: 'emmiby@icloud.com',     // 您的 iCloud 邮箱
  pass: 'eybw-sgwu-lkfi-isod'    // 您的 App 专用密码
}

let transporter = null;

try {
  transporter = nodemailer.createTransport({
    host: MAIL_CONFIG.host,
    port: MAIL_CONFIG.port,
    secure: false, // 587 端口通常是 false (STARTTLS)
    auth: {
      user: MAIL_CONFIG.user,
      pass: MAIL_CONFIG.pass
    },
    tls: {
      // 必须加上这个，否则连接 iCloud 可能会报错
      ciphers: 'SSLv3'
    }
  });
} catch (e) {
  console.error('邮件服务初始化失败，请检查配置', e)
}

exports.main = async (event, context) => {
  const { email, type = 'login' } = event
  const db = cloud.database()
  
  if (!email) {
    return { success: false, message: '邮箱不能为空' }
  }
  
  // 检查是否配置了邮箱
  if (MAIL_CONFIG.user.includes('YOUR_EMAIL')) {
    return { success: false, message: '服务端未配置发件人邮箱，请联系管理员配置 cloudfunctions/sendEmail' }
  }

  try {
    // 1. 验证该邮箱是否属于管理员
    // 优先查 admins 集合 (根据用户截图确认存在)
    let adminRes = await db.collection('admins').where({ email: email }).get()
    
    if (adminRes.data.length === 0) {
       // 尝试查 sys_user 表作为后备 (CMS)
       adminRes = await db.collection('sys_user').where({ email: email }).get()
    }
    
    if (adminRes.data.length === 0) {
      return { success: false, message: '该邮箱未注册为管理员' }
    }

    // 2. 生成 6 位随机验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    
    // 3. 将验证码存入数据库 verify_codes 集合
    const expireTime = Date.now() + 5 * 60 * 1000
    
    await db.collection('verify_codes').add({
      data: {
        email: email,
        code: code,
        type: type,
        createdAt: db.serverDate(),
        expireAt: expireTime,
        used: false
      }
    })

    // 4. 发送邮件
    const mailOptions = {
      from: `"小程序后台管理" <${MAIL_CONFIG.user}>`,
      to: email,
      subject: '【管理后台】登录验证码',
      text: `您正在登录管理后台，验证码是：${code}。\n该验证码 5 分钟内有效，请勿泄露给他人。`
    };

    await transporter.sendMail(mailOptions)
    
    return { success: true, message: '验证码已发送，请查收' }

  } catch (err) {
    console.error(err)
    return { success: false, message: '发送失败: ' + err.message }
  }
}
