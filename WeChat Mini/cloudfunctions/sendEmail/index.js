const cloud = require('wx-server-sdk')
const nodemailer = require('nodemailer')
const CryptoJS = require('crypto-js')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// ==========================================
// 邮件配置：从云函数环境变量读取
// 
// 请在云函数控制台设置以下环境变量：
//   SMTP_HOST  - SMTP 服务器地址 (如 smtp.mail.me.com)
//   SMTP_PORT  - SMTP 端口 (如 587)
//   SMTP_USER  - 发件人邮箱
//   SMTP_PASS  - 邮箱密码/App专用密码
// 
// 注意：密码必须是"App 专用密码"，不是 Apple ID 密码！
// 获取方法：登录 appleid.apple.com -> 登录和安全 -> App 专用密码 -> 生成
// ==========================================

let transporter = null;

function initTransporter() {
  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    console.error('邮件服务未配置：缺少 SMTP_HOST, SMTP_USER 或 SMTP_PASS 环境变量')
    return null
  }

  try {
    return nodemailer.createTransport({
      host: host,
      port: parseInt(port || '587'),
      secure: false, // 587 端口通常是 false (STARTTLS)
      auth: {
        user: user,
        pass: pass
      },
      tls: {
        // 必须加上这个，否则连接 iCloud 可能会报错
        ciphers: 'SSLv3'
      }
    })
  } catch (e) {
    console.error('邮件服务初始化失败，请检查配置', e)
    return null
  }
}

exports.main = async (event, context) => {
  const { email, type = 'login' } = event
  const db = cloud.database()
  
  if (!email) {
    return { success: false, message: '邮箱不能为空' }
  }

  // 懒初始化 transporter
  if (!transporter) {
    transporter = initTransporter()
  }
  
  if (!transporter) {
    return { success: false, message: '邮件服务未配置，请联系管理员设置云函数环境变量 (SMTP_HOST, SMTP_USER, SMTP_PASS)' }
  }

  try {
    // 1. 验证该邮箱是否属于管理员
    // 优先查 admins 集合
    let adminRes = await db.collection('admins').where({ email: email }).get()
    
    if (adminRes.data.length === 0) {
       // 尝试查 sys_user 表作为后备 (CMS)
       adminRes = await db.collection('sys_user').where({ email: email }).get()
    }
    
    if (adminRes.data.length === 0) {
      return { success: false, message: '该邮箱未注册为管理员' }
    }

    // 2. 🔒 频率限制：同一邮箱 1 分钟内只能请求一次验证码
    const oneMinuteAgo = Date.now() - 60 * 1000
    const recentCode = await db.collection('verify_codes')
      .where({
        email: email,
        used: false,
        createdAt: db.command.gte(new Date(oneMinuteAgo))
      })
      .count()
    
    if (recentCode.total > 0) {
      return { success: false, message: '验证码已发送，请稍后再试' }
    }

    // 3. 生成 6 位随机验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    
    // 4. 将验证码存入数据库 verify_codes 集合
    const expireTime = Date.now() + 5 * 60 * 1000
    
    await db.collection('verify_codes').add({
      data: {
        email: email,
        codeHash: codeHash,
        type: type,
        createdAt: db.serverDate(),
        expireAt: expireTime,
        used: false
      }
    })

    // 5. 发送邮件
    const mailOptions = {
      from: `"小程序后台管理" <${process.env.SMTP_USER}>`,
      to: email,
      subject: '【管理后台】登录验证码',
      text: `您正在登录管理后台，验证码是：${code}。\n该验证码 5 分钟内有效，请勿泄露给他人。`
    };

    await transporter.sendMail(mailOptions)
    
    return { success: true, message: '验证码已发送，请查收' }

  } catch (err) {
    console.error(err)
    return { success: false, message: '发送失败，请稍后重试' }
  }
}
