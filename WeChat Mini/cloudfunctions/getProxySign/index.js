const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 🔒 签名密钥必须与 proxyDownload 中的 SIGN_SECRET 保持一致（同一环境变量下发）
// fail-closed：禁止硬编码兜底，原明文默认值 'missonce-proxy-sign-key-v2' 已视为泄露并废弃
const SIGN_SECRET = process.env.PROXY_SIGN_SECRET

// 签名有效期 5 分钟
const SIGN_TTL_MS = 5 * 60 * 1000

exports.main = async (event, context) => {
  // 服务端未配置签名密钥时拒绝签发，避免回退到不安全的默认值
  if (!SIGN_SECRET) {
    console.error('[getProxySign] PROXY_SIGN_SECRET 未配置，拒绝签发')
    return { success: false, code: 'MISCONFIGURED', message: '服务端签名未配置' }
  }

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
