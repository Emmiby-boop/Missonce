const cloud = require('wx-server-sdk')
const https = require('https')
const http = require('http')
const crypto = require('crypto')
const { URL } = require('url')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 🔒 允许下载的域名白名单（已移除 cloud:// —— 云存储文件应通过专用接口访问）
const ALLOWED_DOMAINS = [
  'mmbiz.qpic.cn',         // 微信公众号图片 CDN
  'qpic.cn',               // QQ 图片 CDN
  'gtimg.com',             // 腾讯图片 CDN
  'myqcloud.com',          // 腾讯云 COS CDN
  'alicdn.com',            // 阿里 CDN
  'qhimg.com',             // 360 图片 CDN
  'sinaimg.cn',            // 新浪图片 CDN
  'duitang.com',           // 堆糖
  'xiaohongshu.com',       // 小红书
  'zhihu.com',             // 知乎
  'bilibili.com',          // B站
  'doubanio.com',          // 豆瓣
  'picsum.photos',         // 占位图服务
  'unsplash.com',          // Unsplash
  'pexels.com',            // Pexels
  'pixabay.com',           // Pixabay
  'wallhaven.cc',          // Wallhaven
  'zcool.com.cn',          // 站酷
  'huaban.com',            // 花瓣
  'nipic.com',             // 昵图
]

// 🔒 签名密钥（必须从环境变量读取，禁止硬编码兜底）
//
// 历史问题：这里原为 `process.env.PROXY_SIGN_SECRET || 'missonce-proxy-sign-key-v2'`，
// 明文默认值已随仓库公开泄露 —— 任何人都能用它算出合法签名，把本函数当免费代理 / SSRF 跳板。
// 现改为 fail-closed：未配置环境变量时直接拒绝服务，绝不降级到硬编码值。
// 密钥通过 cloudbaserc.json 的 envVariables 下发（该文件已在 .gitignore 中），轮换只需改配置。
const SIGN_SECRET = process.env.PROXY_SIGN_SECRET

// 🔒 限流配置：每 IP 每分钟最多 20 次
const RATE_LIMIT_PER_MIN = 20
const RATE_LIMIT_WINDOW_MS = 60 * 1000

function isUrlAllowed(targetUrl) {
  // 禁止 cloud:// 协议（云存储文件应通过专用接口访问，防止越权遍历）
  if (targetUrl.startsWith('cloud://')) return false
  // 禁止 file:// 和内网地址
  if (targetUrl.startsWith('file://')) return false

  try {
    const u = new URL(targetUrl)
    const hostname = u.hostname.toLowerCase()

    // 禁止内网 IP / localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') || hostname.startsWith('172.16.') || hostname === '0.0.0.0') {
      return false
    }

    return ALLOWED_DOMAINS.some(domain =>
      hostname === domain || hostname.endsWith('.' + domain)
    )
  } catch (e) {
    return false
  }
}

/**
 * 验证签名：sign = HMAC-SHA256(url + expireTs, SECRET)
 * 客户端必须传入 sign 和 expireTs，签名失败返回三级降级链路中明确的状态码
 */
function verifySignature(url, sign, expireTs) {
  if (!sign || !expireTs) {
    return { valid: false, reason: 'SIGN_MISSING' }
  }

  // 检查过期时间
  const now = Date.now()
  if (Number(expireTs) < now) {
    return { valid: false, reason: 'SIGN_EXPIRED' }
  }

  // 计算预期签名
  const expected = crypto
    .createHmac('sha256', SIGN_SECRET)
    .update(`${url}.${expireTs}`)
    .digest('hex')

  // 恒定时间比较
  try {
    if (sign.length !== expected.length) {
      return { valid: false, reason: 'SIGN_INVALID' }
    }
    if (!crypto.timingSafeEqual(Buffer.from(sign), Buffer.from(expected))) {
      return { valid: false, reason: 'SIGN_INVALID' }
    }
  } catch (e) {
    return { valid: false, reason: 'SIGN_INVALID' }
  }

  return { valid: true }
}

/**
 * IP 限流：基于 rate_limit 集合按分钟维度计数
 * 返回 true 表示允许，false 表示超限
 */
async function checkRateLimit(ip) {
  if (!ip) ip = 'unknown'
  const windowKey = `${ip}_${Math.floor(Date.now() / RATE_LIMIT_WINDOW_MS)}`

  try {
    // 原子递增
    const _ = db.command
    const res = await db.collection('rate_limit')
      .where({ _key: windowKey })
      .update({ data: { count: _.inc(1) } })

    if (res.stats.updated === 0) {
      // 新窗口，创建记录
      await db.collection('rate_limit').add({
        data: {
          _key: windowKey,
          count: 1,
          expireAt: new Date(Date.now() + RATE_LIMIT_WINDOW_MS * 2)
        }
      })
      return true
    }

    // 查询当前计数
    const query = await db.collection('rate_limit').where({ _key: windowKey }).limit(1).get()
    if (query.data.length > 0 && query.data[0].count > RATE_LIMIT_PER_MIN) {
      return false
    }
    return true
  } catch (e) {
    console.warn('[proxyDownload] 限流查询失败，降级放行:', e.message)
    return true
  }
}

function fetchBuffer(targetUrl) {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(targetUrl)
      const client = u.protocol === 'https:' ? https : http
      const req = client.get(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = res.headers.location
          if (!isUrlAllowed(redirectUrl)) {
            return reject(new Error('重定向目标域名不在白名单中'))
          }
          return resolve(fetchBuffer(redirectUrl))
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`))
        }
        const chunks = []
        let totalSize = 0
        const MAX_SIZE = 10 * 1024 * 1024
        res.on('data', (c) => {
          totalSize += c.length
          if (totalSize > MAX_SIZE) {
            req.destroy()
            return reject(new Error('File too large (max 10MB)'))
          }
          chunks.push(c)
        })
        res.on('end', () => {
          const buffer = Buffer.concat(chunks)
          const contentType = res.headers['content-type'] || 'image/jpeg'
          resolve({ buffer, contentType })
        })
      })
      req.on('error', reject)
      req.setTimeout(15000, () => {
        req.destroy(new Error('Request timeout'))
      })
    } catch (e) {
      reject(e)
    }
  })
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const callerOpenid = wxContext.OPENID
  const ip = wxContext.CLIENTIP || 'unknown'

  const { url, sign, expireTs } = event || {}

  // 服务端未配置签名密钥时拒绝服务，避免回退到不安全的默认值
  if (!SIGN_SECRET) {
    console.error('[proxyDownload] PROXY_SIGN_SECRET 未配置，拒绝服务')
    return { success: false, code: 'MISCONFIGURED', message: '服务端签名未配置' }
  }

  if (!url || typeof url !== 'string') {
    return { success: false, code: 'URL_MISSING', message: 'missing url' }
  }

  // 🔒 鉴权：必须已登录
  if (!callerOpenid) {
    return { success: false, code: 'UNAUTHORIZED', message: '请先登录' }
  }

  // 🔒 签名验证（三级降级链路：尝试签名→失败冷却→降级下载）
  const signResult = verifySignature(url, sign, expireTs)
  if (!signResult.valid) {
    // 签名失败 —— 返回明确的降级状态码，前端可走降级链路
    return {
      success: false,
      code: 'SIGN_FAILED',
      reason: signResult.reason,
      message: '签名校验失败，请使用降级下载链路'
    }
  }

  // 🔒 域名白名单验证
  if (!isUrlAllowed(url)) {
    console.warn('proxyDownload: 域名不在白名单被拒绝:', url, 'ip:', ip)
    return { success: false, code: 'DOMAIN_NOT_ALLOWED', message: '不支持的图片来源，仅允许从白名单域名下载' }
  }

  // 🔒 IP 限流
  const allowed = await checkRateLimit(ip)
  if (!allowed) {
    return {
      success: false,
      code: 'RATE_LIMITED',
      message: '请求过于频繁，请稍后再试'
    }
  }

  try {
    const { buffer, contentType } = await fetchBuffer(url)

    // 使用 crypto.randomBytes 生成不可预测的文件名
    const rand = crypto.randomBytes(8).toString('hex')
    let ext = 'jpg'
    if (contentType.includes('png')) ext = 'png'
    else if (contentType.includes('gif')) ext = 'gif'
    else if (contentType.includes('webp')) ext = 'webp'

    const cloudPath = `proxy/downloads/${rand}.${ext}`
    const uploadRes = await cloud.uploadFile({
      cloudPath,
      fileContent: buffer
    })

    return {
      success: true,
      fileID: uploadRes.fileID,
      cloudPath
    }
  } catch (error) {
    console.error('proxyDownload failed:', error.message, 'url:', url)
    return { success: false, code: 'DOWNLOAD_FAILED', message: '下载失败，请稍后重试' }
  }
}
