const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const $ = db.command.aggregate

// 内存缓存
const _memCache = {}
const CACHE_DURATION = 10 * 60 * 1000 // 10分钟

/**
 * 使用聚合查询从 resources 集合中实时提取所有唯一的单个标签
 */
async function getUniqueTagsFromResources(type) {
  const cacheKey = `tags_${type || 'all'}`
  const now = Date.now()
  const cached = _memCache[cacheKey]
  
  if (cached && now - cached.time < CACHE_DURATION) {
    console.log('[getCategories] 从内存缓存返回标签')
    return cached.data
  }
  
  try {
    const match = { status: 'published' }
    if (type && type !== 'all') {
      match.type = type
    }

    const res = await db.collection('resources').aggregate()
      .match(match)
      .unwind('$tags')
      .group({
        _id: '$tags',
        count: $.sum(1)
      })
      .sort({ count: -1 })
      .limit(200)
      .end()

    const data = res.list.map(item => ({
      id: item._id,
      name: item._id,
      key: item._id,
      count: item.count
    }))
    
    _memCache[cacheKey] = { data, time: now }
    return data
  } catch (error) {
    console.error('聚合提取标签失败:', error)
    return getTagsFromCollection(type)
  }
}

/**
 * 从 tags 集合获取标签数据（作为备份或特定用途）
 */
async function getTagsFromCollection(type) {
  try {
    const where = { visible: true }
    if (type && type !== 'all') {
      where.type = type
    }
    
    const res = await db.collection('tags')
      .where(where)
      .orderBy('order', 'asc')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get()
    
    const uniqueTags = []
    const seenNames = new Set()
    
    for (const item of res.data) {
      const cleanName = String(item.name).trim()
      if (cleanName && !seenNames.has(cleanName)) {
        seenNames.add(cleanName)
        uniqueTags.push({
          id: cleanName,
          name: cleanName,
          key: cleanName,
          type: item.type
        })
      }
    }
    
    return uniqueTags
  } catch (error) {
    console.error('获取标签集合失败:', error)
    return []
  }
}

exports.main = async (event, context) => {
  const { type = 'all', source = 'categories' } = event
  try {
    // 按照用户要求，直接读取并展示图片库中所有出现的独立标签
    if (source === 'tags') {
      const tags = await getUniqueTagsFromResources(type)
      return {
        success: true,
        data: tags
      }
    }

    // 检查分类内存缓存
    const cacheKey = `categories_${type || 'all'}`
    const now = Date.now()
    const cached = _memCache[cacheKey]
    
    if (cached && now - cached.time < CACHE_DURATION) {
      console.log('[getCategories] 从内存缓存返回分类')
      return cached.data
    }

    const where = { visible: true }
    if (type !== 'all') {
      where.type = type
    }
    
    const res = await db.collection('categories').where(where).orderBy('order', 'asc').limit(100).get()
    
    const uniqueItems = []
    const seenNames = new Set()
    
    for (const item of res.data) {
      if (!seenNames.has(item.name)) {
        seenNames.add(item.name)
        uniqueItems.push({
          id: item.key || item.name,
          name: item.name,
          key: item.key || item.name,
          type: item.type
        })
      }
    }
    
    const result = {
      success: true,
      data: uniqueItems
    }
    
    _memCache[cacheKey] = { data: result, time: now }
    
    return result
  } catch (error) {
    console.error('获取分类失败:', error)
    return {
      success: false,
      message: error.message
    }
  }
}
