const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 内存缓存
const _memCache = {}
const CACHE_DURATION = 10 * 60 * 1000 // 10分钟

exports.main = async (event, context) => {
  const { page = 1, pageSize = 20, category = '', keyword = '' } = event

  // 首页且有分类时检查缓存
  if (page === 1 && !keyword) {
    const cacheKey = `quotes_${category || 'all'}`
    const now = Date.now()
    const cached = _memCache[cacheKey]
    if (cached && now - cached.time < CACHE_DURATION) {
      console.log('[getQuotes] 从内存缓存返回')
      return {
        success: true,
        data: cached.data,
        total: cached.total,
        page,
        pageSize,
        fromCache: true
      }
    }
  }

  try {
    const conditions = [{ status: 'published' }]

    if (category) {
      conditions.push({ category })
    }

    if (keyword) {
      const keywordReg = db.RegExp({ regexp: keyword, options: 'i' })
      conditions.push(_.or([
        { content: keywordReg },
        { tags: keywordReg }
      ]))
    }

    const skip = (page - 1) * pageSize

    // 并行查询提升性能
    const [countRes, dataRes] = await Promise.all([
      db.collection('quotes')
        .where(_.and(conditions))
        .count(),
      db.collection('quotes')
        .where(_.and(conditions))
        .orderBy('createdAt', 'desc')
        .skip(skip)
        .limit(pageSize)
        .get()
    ])

    const result = {
      success: true,
      data: dataRes.data || [],
      total: countRes.total || 0,
      page,
      pageSize
    }

    // 缓存首页数据
    if (page === 1 && !keyword) {
      const cacheKey = `quotes_${category || 'all'}`
      _memCache[cacheKey] = {
        data: result.data,
        total: result.total,
        time: Date.now()
      }
    }

    return result
  } catch (error) {
    console.error('获取文案失败:', error)
    return {
      success: true,
      data: [],
      total: 0,
      page,
      pageSize
    }
  }
}
