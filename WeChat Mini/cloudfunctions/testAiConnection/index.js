const cloud = require('wx-server-sdk')
const https = require('https')

const { withAdmin } = require('./withAdmin')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

/**
 * 🔒 P0-5 SSRF 防护：只允许请求已知的 AI 服务商域名
 *
 * 漏洞原状：完全信任客户端传入的 API_URL，url.parse 后直接 https.request。
 * 云函数位于内网，可直达数据库、元数据服务等本不该对外暴露的地址，
 * 因此该接口此前可被当作探测内网的 HTTP 代理使用。
 *
 * 若需新增服务商，建议追加 AI_ALLOWED_HOSTS 环境变量（逗号分隔），
 * 而不是放开整张白名单。
 */
const BUILTIN_ALLOWED_HOSTS = [
  'dashscope.aliyuncs.com',   // 阿里云通义千问
  'open.bigmodel.cn',         // 智谱 GLM
  'bigmodel.cn',
  'api.openai.com',           // OpenAI
  'api.siliconflow.cn'        // SiliconFlow
]

const getAllowedHosts = () => {
  const extra = (process.env.AI_ALLOWED_HOSTS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
  return [...BUILTIN_ALLOWED_HOSTS, ...extra]
}

const isHostAllowed = (hostname) => {
  const host = String(hostname || '').toLowerCase()
  if (!host) return false
  return getAllowedHosts().some(allowed =>
    host === allowed || host.endsWith('.' + allowed)
  )
}

const handleRequest = async (event) => {
  const { API_URL, API_KEY, MODEL, messages, max_tokens } = event

  if (!API_URL || !API_KEY || !MODEL) {
    return {
      success: false,
      message: '缺少必要参数: API_URL / API_KEY / MODEL'
    }
  }

  let parsedUrl
  try {
    parsedUrl = new URL(API_URL)
  } catch (e) {
    return { success: false, message: 'API_URL 格式不合法' }
  }

  if (parsedUrl.protocol !== 'https:') {
    return { success: false, message: '仅允许 https 协议' }
  }

  if (!isHostAllowed(parsedUrl.hostname)) {
    console.warn('[testAiConnection] 拒绝非白名单域名:', parsedUrl.hostname)
    return {
      success: false,
      message: `域名不在白名单内: ${parsedUrl.hostname}`
    }
  }

  try {
    const postData = JSON.stringify({
      model: MODEL,
      messages: messages || [{ role: 'user', content: 'Hi' }],
      max_tokens: max_tokens || 5
    })

    const responseData = await new Promise((resolve, reject) => {
      // 复用已经通过白名单校验的 parsedUrl，避免「校验用一套解析、请求用另一套」的绕过。
      // url.parse 与 WHATWG URL 对某些畸形 URL 结果不同，混用会导致白名单被绕过。
      const req = https.request({
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: (parsedUrl.pathname || '/') + (parsedUrl.search || ''),
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
        statusCode: responseData.statusCode
        // 已移除 rawBody 回显：原实现会把上游返回的任意内容回显 500 字符
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

// 🔒 P0-5：原实现无任何鉴权，任何人可把它当 HTTP 代理使用。
// 调用方是 Mini admin 的 AIKeyManager / AIQuotesConfig，均走 callFunctionWithAuth
// （自动注入 adminToken），因此加鉴权前端无需改动。
exports.main = withAdmin(handleRequest)
