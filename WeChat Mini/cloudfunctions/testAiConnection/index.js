const cloud = require('wx-server-sdk')
const https = require('https')
const url = require('url')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event) => {
  const { API_URL, API_KEY, MODEL, messages, max_tokens } = event

  if (!API_URL || !API_KEY || !MODEL) {
    return {
      success: false,
      message: '缺少必要参数: API_URL / API_KEY / MODEL'
    }
  }

  try {
    const postData = JSON.stringify({
      model: MODEL,
      messages: messages || [{ role: 'user', content: 'Hi' }],
      max_tokens: max_tokens || 5
    })

    const responseData = await new Promise((resolve, reject) => {
      const parsedUrl = url.parse(API_URL)
      const req = https.request({
        hostname: parsedUrl.hostname,
        path: parsedUrl.path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 25000
      }, (res) => {
        let body = ''
        res.on('data', chunk => body += chunk)
        res.on('end', () => resolve({ statusCode: res.statusCode, body }))
      })

      req.on('timeout', () => {
        req.destroy()
        reject(new Error('请求超时（25s）'))
      })

      req.on('error', (e) => reject(e))
      req.write(postData)
      req.end()
    })

    if (responseData.statusCode !== 200) {
      let errMsg = `HTTP ${responseData.statusCode}`
      try {
        const errJson = JSON.parse(responseData.body)
        errMsg = errJson?.error?.message || errJson?.message || errMsg
      } catch (e) { /* use status code */ }
      return {
        success: false,
        message: `连接失败: ${errMsg}`,
        statusCode: responseData.statusCode,
        rawBody: responseData.body.slice(0, 500)
      }
    }

    const data = JSON.parse(responseData.body)
    const content = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || ''

    return {
      success: true,
      message: `连接成功！模型响应: "${String(content).trim().slice(0, 50)}"`,
      model: data?.model || MODEL,
      usage: data?.usage || null
    }
  } catch (err) {
    return {
      success: false,
      message: `网络错误: ${err.message}`
    }
  }
}
