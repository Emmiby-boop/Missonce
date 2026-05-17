const cloud = require('wx-server-sdk')
const https = require('https')
const http = require('http')
const { URL } = require('url')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

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
          // handle redirect
          return resolve(fetchBuffer(res.headers.location))
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`))
        }
        const chunks = []
        res.on('data', (c) => chunks.push(c))
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
    return { success: false, message: error.message || 'download failed' }
  }
}
