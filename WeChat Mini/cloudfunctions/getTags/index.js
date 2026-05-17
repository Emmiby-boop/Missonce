const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 内存缓存
const _memCache = {}
const CACHE_DURATION = 10 * 60 * 1000 // 10 minutes

/**
 * 从 resources 集合中聚合提取标签列表
 */
async function getUniqueTagsFromResources(type) {
  const cacheKey = `tags_${type || 'all'}`
  const now = Date.now()
  const cached = _memCache[cacheKey]

  if (cached && now - cached.time < CACHE_DURATION) {
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
      .group({ _id: '$tags', count: db.command.aggregate.sum(1) })
      .sort({ count: -1 })
      .limit(200)
      .end()

    const data = res.list.map(item => ({
      name: item._id,
      count: item.count
    }))

    _memCache[cacheKey] = { data, time: now }
    return data
  } catch (error) {
    console.error('[getTags] failed:', error)
    return []
  }
}

exports.main = async (event) => {
  const type = event.type || 'all'
  const tags = await getUniqueTagsFromResources(type)
  return { success: true, data: tags }
}