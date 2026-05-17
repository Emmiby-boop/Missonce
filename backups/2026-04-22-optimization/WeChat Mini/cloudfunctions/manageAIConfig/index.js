const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { action, ...data } = event
  
  console.log('manageAIConfig 被调用, action:', action, 'data:', JSON.stringify(data))
  
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
        console.log('未知操作:', action)
        return { success: false, message: '未知操作' }
    }
  } catch (error) {
    console.error('AI 配置管理错误:', error)
    return { success: false, message: error.message || '操作失败' }
  }
}

async function getConfig(data) {
  const { type } = data
  
  const result = {}
  
  try {
    console.log('开始获取配置...')
    const [aiRes, catRes, tagRes, keysRes, writerRes] = await Promise.all([
      db.collection('sys_config').doc('ai_config').get().catch((e) => {
        console.log('ai_config 获取失败:', e)
        return null
      }),
      db.collection('sys_config').doc('categories_whitelist').get().catch((e) => {
        console.log('categories_whitelist 获取失败:', e)
        return null
      }),
      db.collection('sys_config').doc('tags_whitelist').get().catch((e) => {
        console.log('tags_whitelist 获取失败:', e)
        return null
      }),
      db.collection('api_keys').orderBy('createdAt', 'desc').get().catch((e) => {
        console.log('api_keys 获取失败:', e)
        return null
      }),
      db.collection('sys_config').doc('ai_writer_config').get().catch((e) => {
        console.log('ai_writer_config 获取失败:', e)
        return null
      })
    ])
    
    console.log('aiRes:', aiRes)
    console.log('catRes:', catRes)
    console.log('tagRes:', tagRes)
    console.log('keysRes:', keysRes)
    console.log('writerRes:', writerRes)
    
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
      result.apiKeys = Array.isArray(keysRes.data) ? keysRes.data : [keysRes.data]
    }
    
    if (writerRes && writerRes.data) {
      result.writerConfig = Array.isArray(writerRes.data) ? writerRes.data[0] : writerRes.data
    }
    
    console.log('返回结果:', result)
    
    return {
      success: true,
      data: result
    }
  } catch (error) {
    console.error('获取配置失败:', error)
    return { success: false, message: error.message }
  }
}

async function saveAIConfig(data) {
  const { config } = data
  console.log('saveAIConfig 被调用, config:', JSON.stringify(config))
  
  try {
    const saveData = {
      API_KEY: config.API_KEY || '',
      API_URL: config.API_URL || '',
      MODEL: config.MODEL || '',
      SYSTEM_PROMPT: config.SYSTEM_PROMPT || '',
      updatedAt: db.serverDate()
    }
    console.log('准备保存的数据:', saveData)
    
    console.log('尝试使用 update 方法...')
    try {
      await db.collection('sys_config').doc('ai_config').update({
        data: saveData
      })
      console.log('saveAIConfig update 成功')
      return {
        success: true,
        message: 'AI 配置保存成功'
      }
    } catch (updateError) {
      console.log('update 失败，尝试 add 方法:', updateError)
      const addData = {
        _id: 'ai_config',
        ...saveData,
        createdAt: db.serverDate()
      }
      await db.collection('sys_config').add({
        data: addData
      })
      console.log('saveAIConfig add 成功')
      return {
        success: true,
        message: 'AI 配置保存成功'
      }
    }
  } catch (error) {
    console.error('saveAIConfig 保存失败:', error)
    console.error('错误堆栈:', error.stack)
    return {
      success: false,
      message: error.message || 'AI 配置保存失败'
    }
  }
}

async function saveCategories(data) {
  const { categories } = data
  console.log('saveCategories 被调用, categories:', categories)
  
  try {
    await db.collection('sys_config').doc('categories_whitelist').set({
      categories: categories
    })
    console.log('saveCategories 保存成功')
    return {
      success: true,
      message: '分类白名单保存成功'
    }
  } catch (error) {
    console.error('saveCategories 保存失败:', error)
    return {
      success: false,
      message: error.message || '分类白名单保存失败'
    }
  }
}

async function saveTags(data) {
  const { tags } = data
  console.log('saveTags 被调用, tags:', tags)
  
  try {
    await db.collection('sys_config').doc('tags_whitelist').set({
      tags: tags
    })
    console.log('saveTags 保存成功')
    return {
      success: true,
      message: '标签白名单保存成功'
    }
  } catch (error) {
    console.error('saveTags 保存失败:', error)
    return {
      success: false,
      message: error.message || '标签白名单保存失败'
    }
  }
}

async function saveWriterConfig(data) {
  const { config, scenes } = data
  console.log('saveWriterConfig 被调用, config:', config, 'scenes:', scenes)
  
  try {
    await db.collection('sys_config').doc('ai_writer_config').set({
      SYSTEM_PROMPT: config.SYSTEM_PROMPT || '',
      PROVIDER: config.PROVIDER || '',
      MODEL: config.MODEL || '',
      API_URL: config.API_URL || '',
      API_KEY: config.API_KEY || '',
      scenes: scenes || []
    })
    console.log('saveWriterConfig 保存成功')
    return {
      success: true,
      message: '文案配置保存成功'
    }
  } catch (error) {
    console.error('saveWriterConfig 保存失败:', error)
    return {
      success: false,
      message: error.message || '文案配置保存失败'
    }
  }
}

async function saveFeaturedQuotes(data) {
  const { featuredQuotes } = data
  console.log('saveFeaturedQuotes 被调用, featuredQuotes:', featuredQuotes)
  
  try {
    try {
      await db.collection('sys_config').doc('ai_writer_config').update({
        featuredQuotes: featuredQuotes
      })
    } catch (e) {
      console.log('update 失败，尝试 set:', e)
      await db.collection('sys_config').doc('ai_writer_config').set({
        featuredQuotes: featuredQuotes
      })
    }
    console.log('saveFeaturedQuotes 保存成功')
    return {
      success: true,
      message: '文案库保存成功'
    }
  } catch (error) {
    console.error('saveFeaturedQuotes 保存失败:', error)
    return {
      success: false,
      message: error.message || '文案库保存失败'
    }
  }
}
