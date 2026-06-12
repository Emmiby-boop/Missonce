const cloud = require('wx-server-sdk')
const CryptoJS = require('crypto-js')
const { requireAdmin } = require('../shared/adminAuth')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// Shared decrypt for manageApiKeys-encrypted keys
const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_SECRET

function decryptKey(encryptedText) {
  if (!ENCRYPTION_KEY) return encryptedText
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY)
    return bytes.toString(CryptoJS.enc.Utf8)
  } catch (e) {
    return encryptedText
  }
}

exports.main = async (event, context) => {
  const { action, ...data } = event
  const { OPENID } = cloud.getWXContext()

  // 鉴权检查
  if (!OPENID) {
    return { success: false, message: '未登录' }
  }
  const auth = await requireAdmin(db, OPENID)
  if (!auth.isAdmin) {
    return auth.response
  }

  console.log('manageAIConfig 被调用, action:', action)

  try {
    switch (action) {
      case 'get':
        return await getConfig(data)
      case 'saveAIConfig':
        return await saveAIConfig(data)
      case 'saveCategories':
        return await saveCategories(data)
      case 'saveTags':
        return await saveTags(data)
      case 'saveWriterConfig':
        return await saveWriterConfig(data)
      case 'saveFeaturedQuotes':
        return await saveFeaturedQuotes(data)
      default:
        return { success: false, message: '未知操作' }
    }
  } catch (error) {
    console.error('AI 配置管理错误:', error)
    return { success: false, message: error.message || '操作失败' }
  }
}

async function getConfig(data) {
  const result = {}

  try {
    const [aiRes, catRes, tagRes, keysRes, writerRes] = await Promise.all([
      db.collection('sys_config').doc('ai_config').get().catch(() => null),
      db.collection('sys_config').doc('categories_whitelist').get().catch(() => null),
      db.collection('sys_config').doc('tags_whitelist').get().catch(() => null),
      db.collection('api_keys').orderBy('createdAt', 'desc').get().catch(() => null),
      db.collection('sys_config').doc('ai_writer_config').get().catch(() => null)
    ])

    if (aiRes && aiRes.data) {
      result.aiConfig = Array.isArray(aiRes.data) ? aiRes.data[0] : aiRes.data
    }
    if (catRes && catRes.data) {
      result.categories = Array.isArray(catRes.data) ? catRes.data[0] : catRes.data
    }
    if (tagRes && tagRes.data) {
      result.tags = Array.isArray(tagRes.data) ? tagRes.data[0] : tagRes.data
    }
    if (keysRes && keysRes.data) {
      // 解密后脱敏返回
      result.apiKeys = keysRes.data.map(item => ({
        ...item,
        key: item.key ? decryptKey(item.key).replace(/^(.{4}).*(.{4})$/, '$1****$2') : ''
      }))
    }
    if (writerRes && writerRes.data) {
      result.writerConfig = Array.isArray(writerRes.data) ? writerRes.data[0] : writerRes.data
    }

    return { success: true, data: result }
  } catch (error) {
    console.error('获取配置失败:', error)
    return { success: false, message: error.message }
  }
}

async function saveAIConfig(data) {
  const { config } = data

  try {
    const saveData = {
      API_KEY: config.API_KEY || '',
      API_URL: config.API_URL || '',
      MODEL: config.MODEL || '',
      SYSTEM_PROMPT: config.SYSTEM_PROMPT || '',
      updatedAt: db.serverDate()
    }

    try {
      await db.collection('sys_config').doc('ai_config').update({ data: saveData })
    } catch (updateError) {
      await db.collection('sys_config').add({
        data: { _id: 'ai_config', ...saveData, createdAt: db.serverDate() }
      })
    }

    return { success: true, message: 'AI 配置保存成功' }
  } catch (error) {
    console.error('saveAIConfig 保存失败:', error)
    return { success: false, message: error.message || 'AI 配置保存失败' }
  }
}

async function saveCategories(data) {
  const { categories } = data
  try {
    await db.collection('sys_config').doc('categories_whitelist').set({ categories })
    return { success: true, message: '分类白名单保存成功' }
  } catch (error) {
    return { success: false, message: error.message || '分类白名单保存失败' }
  }
}

async function saveTags(data) {
  const { tags } = data
  try {
    await db.collection('sys_config').doc('tags_whitelist').set({ tags })
    return { success: true, message: '标签白名单保存成功' }
  } catch (error) {
    return { success: false, message: error.message || '标签白名单保存失败' }
  }
}

async function saveWriterConfig(data) {
  const { config, scenes } = data
  try {
    await db.collection('sys_config').doc('ai_writer_config').set({
      SYSTEM_PROMPT: config.SYSTEM_PROMPT || '',
      PROVIDER: config.PROVIDER || '',
      MODEL: config.MODEL || '',
      API_URL: config.API_URL || '',
      API_KEY: config.API_KEY || '',
      scenes: scenes || []
    })
    return { success: true, message: '文案配置保存成功' }
  } catch (error) {
    return { success: false, message: error.message || '文案配置保存失败' }
  }
}

async function saveFeaturedQuotes(data) {
  const { featuredQuotes } = data
  try {
    try {
      await db.collection('sys_config').doc('ai_writer_config').update({ featuredQuotes })
    } catch (e) {
      await db.collection('sys_config').doc('ai_writer_config').set({ featuredQuotes })
    }
    return { success: true, message: '文案库保存成功' }
  } catch (error) {
    return { success: false, message: error.message || '文案库保存失败' }
  }
}