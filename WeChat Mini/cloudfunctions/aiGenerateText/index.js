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

let WRITER_CONFIG = {
  SYSTEM_PROMPT: '',
  scenes: [],
  featuredQuotes: []
}

let _configLoaded = false

async function loadConfig() {
  if (_configLoaded) return
  
  try {
    const aiConfigRes = await db.collection('sys_config').doc('ai_config').get().catch(() => null)
    const writerConfigRes = await db.collection('sys_config').doc('ai_writer_config').get().catch(() => null)
    
    if (writerConfigRes && writerConfigRes.data) {
      const writerData = writerConfigRes.data
      WRITER_CONFIG.SYSTEM_PROMPT = writerData.SYSTEM_PROMPT || WRITER_CONFIG.SYSTEM_PROMPT
      if (Array.isArray(writerData.scenes)) WRITER_CONFIG.scenes = writerData.scenes
      if (Array.isArray(writerData.featuredQuotes)) WRITER_CONFIG.featuredQuotes = writerData.featuredQuotes
      
      AI_CONFIG.MODEL = writerData.MODEL || 'qwen-turbo'
      AI_CONFIG.API_URL = writerData.API_URL || AI_CONFIG.API_URL
      AI_CONFIG.API_KEY = writerData.API_KEY || ''
      
      console.log('已加载文案配置，模型:', AI_CONFIG.MODEL)
    }
    
    if (!AI_CONFIG.API_KEY && aiConfigRes && aiConfigRes.data) {
      AI_CONFIG.API_KEY = aiConfigRes.data['API KEY'] || aiConfigRes.data.API_KEY || AI_CONFIG.API_KEY
      console.log('使用视觉模型的 API Key')
    }
    
    _configLoaded = true
  } catch (err) {
    console.error('加载配置失败:', err)
  }
}

async function callAI(prompt) {
  if (!AI_CONFIG.API_KEY) {
    throw new Error('API Key 未配置')
  }

  const postData = JSON.stringify({
    model: AI_CONFIG.MODEL,
    messages: [
      { role: 'system', content: WRITER_CONFIG.SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ],
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

exports.main = async (event, context) => {
  await loadConfig()

  const { action, prompt, scene } = event

  if (action === 'getConfig') {
    return {
      success: true,
      config: {
        scenes: WRITER_CONFIG.scenes,
        featuredQuotes: WRITER_CONFIG.featuredQuotes
      }
    }
  }

  if (action === 'generate') {
    try {
      const result = await callAI(prompt)
      return { success: true, text: result }
    } catch (err) {
      console.error('生成失败:', err)
      return { success: false, error: err.message }
    }
  }

  return { success: false, error: '无效的 action' }
}
