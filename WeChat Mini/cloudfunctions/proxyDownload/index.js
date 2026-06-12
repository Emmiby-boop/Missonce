const cloud = require('wx-server-sdk')
const https = require('https')
const http = require('http')
const { URL } = require('url')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 🔒 允许下载的域名白名单
// 仅允许从已知的图源 CDN 下载，防止被用作开放代理
const ALLOWED_DOMAINS = [
  'cloud://',              // 微信云存储内部链接
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

function isUrlAllowed(targetUrl) {
  // 允许云存储链接
  if (targetUrl.startsWith('cloud://')) return true
  
  try {
    const u = new URL(targetUrl)
    const hostname = u.hostname.toLowerCase()
    return ALLOWED_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith('.' + domain)
    )
  } catch (e) {
    return false
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
          // 处理重定向（也需检查目标域名）
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
        const MAX_SIZE = 10 * 1024 * 1024 // 10MB limit
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

exports.main = async (event) => {
  const { url } = event || {}
  if (!url || typeof url !== 'string') {
    return { success: false, message: 'missing url' }
  }

  // 🔒 安全检查：域名白名单验证
  if (!isUrlAllowed(url)) {
    console.warn('proxyDownload: 域名不在白名单中被拒绝:', url)
    return { success: false, message: '不支持的图片来源，仅允许从白名单域名下载' }
  }

  try {
    const { buffer, contentType } = await fetchBuffer(url)
    const now = Date.now()
    const rand = Math.random().toString(36).slice(2, 8)
    let ext = 'jpg'
    if (contentType.includes('png')) ext = 'png'
    else if (contentType.includes('gif')) ext = 'gif'
    else if (contentType.includes('webp')) ext = 'webp'

    const cloudPath = `proxy/downloads/${now}-${rand}.${ext}`
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
    console.error('proxyDownload failed:', error)
    return { success: false, message: '下载失败，请稍后重试' }
  }
}
