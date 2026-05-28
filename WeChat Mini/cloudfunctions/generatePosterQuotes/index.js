const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// OpenAI 兼容的 AI API 调用
async function callAI(apiUrl, apiKey, model, systemPrompt, userPrompt) {
  const url = apiUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || 'qwen-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.9,
      max_tokens: 500
    })
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`AI API 返回错误 ${response.status}: ${errText}`)
  }

  const json = await response.json()
  const content = json.choices?.[0]?.message?.content || ''
  return content
}

// 解析 AI 返回的文案为数组
function parseQuotes(raw) {
  return raw
    .split('\n')
    .map(line => line.replace(/^\d+[\.\、\)）]\s*/, '').trim())
    .filter(line => line.length >= 4 && line.length <= 30)
}

exports.main = async (event) => {
  const { action = 'generate', count = 5 } = event

  try {
    // 读取 writer 配置
    const writerRes = await db.collection('sys_config').doc('ai_writer_config').get().catch(() => null)
    if (!writerRes || !writerRes.data) {
      return { success: false, message: '请先在 AI 配置页面配置文案模型' }
    }

    const cfg = writerRes.data
    if (!cfg.API_KEY) {
      return { success: false, message: '请先配置文案模型的 API Key' }
    }

    const systemPrompt = cfg.SYSTEM_PROMPT || '你是一位温暖治愈的文案助手。'
    const userPrompt = `请生成${count}条温暖、治愈、励志的中文短文案，每条不超过20字。适合用作壁纸/头像分享海报的文案。直接输出文案，每行一条，不要编号，不要引号。`

    console.log('正在调用 AI 生成文案...', { model: cfg.MODEL, provider: cfg.PROVIDER })

    const raw = await callAI(
      cfg.API_URL,
      cfg.API_KEY,
      cfg.MODEL,
      systemPrompt,
      userPrompt
    )

    const quotes = parseQuotes(raw)

    return {
      success: true,
      quotes,
      raw
    }
  } catch (error) {
    console.error('生成文案失败:', error)
    return { success: false, message: error.message || 'AI 生成失败' }
  }
}
