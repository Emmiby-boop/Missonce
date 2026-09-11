const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 🔒 签名密钥必须与 proxyDownload 中的 SIGN_SECRET 保持一致
const SIGN_SECRET = process.env.PROXY_SIGN_SECRET || 'missonce-proxy-sign-key-v2'

// 签名有效期 5 分钟
const SIGN_TTL_MS = 5 * 60 * 1000

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const callerOpenid = wxContext.OPENID

  if (!callerOpenid) {
    return { success: false, code: 'UNAUTHORIZED', message: '请先登录' }
  }

  const { url } = event || {}
  if (!url || typeof url !== 'string') {
    return { success: false, message: 'missing url' }
  }

  const expireTs = Date.now() + SIGN_TTL_MS
  const sign = crypto
    .createHmac('sha256', SIGN_SECRET)
    .update(`${url}.${expireTs}`)
    .digest('hex')

  return {
    success: true,
    sign,
    expireTs
  }
}
