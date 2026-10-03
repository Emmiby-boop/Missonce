const cloud = require('wx-server-sdk')
const https = require('https')
const url = require('url')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

let AI_CONFIG = {
  API_KEY: '',
  MODEL: 'qwen-turbo',
  API_URL: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
}

let _configLoaded = false

async function loadConfig() {
  if (_configLoaded) return
  
  try {
    const aiConfigRes = await db.collection('sys_config').doc('ai_config').get().catch(() => null)
    
    if (aiConfigRes && aiConfigRes.data) {
      const data = aiConfigRes.data
      AI_CONFIG.API_KEY = data.API_KEY || data['API KEY'] || AI_CONFIG.API_KEY
      AI_CONFIG.MODEL = data.MODEL || AI_CONFIG.MODEL
      AI_CONFIG.API_URL = data.API_URL || AI_CONFIG.API_URL
      console.log('已加载 AI 配置，模型:', AI_CONFIG.MODEL)
    }
    
    _configLoaded = true
  } catch (err) {
    console.error('加载配置失败:', err)
  }
}

async function callAI(prompt, systemPrompt) {
  if (!AI_CONFIG.API_KEY) {
    throw new Error('API Key 未配置')
  }

  const messages = []
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt })
  }
  messages.push({ role: 'user', content: prompt })

  const postData = JSON.stringify({
    model: AI_CONFIG.MODEL,
    messages,
    stream: false,
    max_tokens: 500
  })

  const responseData = await new Promise((resolve, reject) => {
    const parsedUrl = url.parse(AI_CONFIG.API_URL)
    const req = https.request({
      hostname: parsedUrl.hostname,
      path: parsedUrl.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_CONFIG.API_KEY}`,
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 60000
    }, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => resolve({ statusCode: res.statusCode, body }))
    })
    
    req.on('timeout', () => { req.destroy(); reject(new Error('API 超时')) })
    req.on('error', reject)
    req.write(postData)
    req.end()
  })

  if (responseData.statusCode !== 200) {
    throw new Error(`API 请求失败: ${responseData.statusCode}`)
  }

  const data = JSON.parse(responseData.body)
  return data.choices[0].message.content
}

const { withAdmin } = require('./withAdmin')

// 🔒 P0-6 费用护栏：调用上游大模型必须限长，防止超长 prompt 单次烧掉大量 token
const MAX_PROMPT_LEN = 1000
const MAX_SYSTEM_PROMPT_LEN = 2000

const handleRequest = async (event, context) => {
  await loadConfig()

  const { action, prompt, scene } = event

  if (action === 'getConfig') {
    return {
      success: true,
      config: {
        scenes: [],
        featuredQuotes: []
      }
    }
  }

  if (action === 'generate') {
    const systemPrompt = event.systemPrompt
    // 入参合法性：长度护栏 + 类型校验
    if (typeof prompt !== 'string' || !prompt.trim()) {
      return { success: false, error: 'prompt 不能为空' }
    }
    if (prompt.length > MAX_PROMPT_LEN) {
      return { success: false, error: `prompt 过长（上限 ${MAX_PROMPT_LEN} 字）` }
    }
    if (systemPrompt && String(systemPrompt).length > MAX_SYSTEM_PROMPT_LEN) {
      return { success: false, error: `systemPrompt 过长（上限 ${MAX_SYSTEM_PROMPT_LEN} 字）` }
    }

    try {
      const result = await callAI(prompt, systemPrompt)
      return { success: true, text: result }
    } catch (err) {
      console.error('生成失败:', err)
      return { success: false, error: err.message }
    }
  }

  return { success: false, error: '无效的 action' }
}

// 🔒 P0-6：本函数直接消耗通义千问账单，原先无任何鉴权与限流，任何人可循环调用刷爆费用。
// 现统一用 withAdmin 包裹（adminToken → adminAuth.verifyToken）。
// 唯一调用方是 Mini admin 的 QuotesPage.vue，其 callFunctionWithAuth 会自动注入 adminToken，
// 前端无需改动即可正常鉴权。
exports.main = withAdmin(handleRequest)
