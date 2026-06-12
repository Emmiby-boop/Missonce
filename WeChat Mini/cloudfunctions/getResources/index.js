const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// ============================================================
// 缓存工具
// ============================================================
const CACHE_TTL = 5 * 60 * 1000 // 5分钟
const cacheStore = {}

async function getCache(key) {
  // 内存缓存
  if (cacheStore[key]) {
    const item = cacheStore[key]
    if (item.expireAt > Date.now()) {
      return item.data
    }
    delete cacheStore[key]
  }
  
  // 数据库缓存
  try {
    const res = await db.collection('resources_cache').where({ key }).get()
    if (res.data.length > 0) {
      const item = res.data[0]
      if (item.expireAt > Date.now()) {
        cacheStore[key] = { data: item.data, expireAt: item.expireAt }
        return item.data
      }
    }
  } catch (e) {}
  
  return null
}

async function setCache(key, data) {
  const expireAt = Date.now() + CACHE_TTL
  
  // 内存缓存
  cacheStore[key] = { data, expireAt }
  
  // 异步写入数据库（不阻塞返回）
  db.collection('resources_cache').where({ key }).get().then(res => {
    if (res.data.length > 0) {
      db.collection('resources_cache').doc(res.data[0]._id).update({ data: { data, expireAt } })
    } else {
      db.collection('resources_cache').add({ data: { key, data, expireAt } })
    }
  }).catch(() => {})
}

// ============================================================
// 性能追踪类
// ============================================================
class CloudFunctionPerformance {
  constructor() {
    this.metrics = {}
    this.startTime = Date.now()
    this.databaseQueries = []
    this.lastMilestone = this.startTime
  }

  markMilestone(name) {
    const now = Date.now()
    const elapsed = now - this.startTime
    const sinceLast = now - this.lastMilestone
    this.metrics[name] = { elapsed, sinceLast, timestamp: now }
    this.lastMilestone = now
    console.log(`[Performance] ⏱️  ${name}: ${elapsed}ms (+${sinceLast}ms)`)
  }

  trackDatabaseQuery(collection, operation, startTime) {
    const duration = Date.now() - startTime
    this.databaseQueries.push({ collection, operation, duration, timestamp: Date.now() })
    console.log(`[DB Query] 📊 ${collection}.${operation}: ${duration}ms`)
  }

  logSummary() {
    const totalTime = Date.now() - this.startTime
    const totalDbTime = this.databaseQueries.reduce((sum, q) => sum + q.duration, 0)
    console.group('[Performance] 📈 云函数执行总结')
    console.log(`总耗时: ${totalTime}ms`)
    console.log(`数据库查询: ${this.databaseQueries.length}次, 总耗时: ${totalDbTime}ms`)
    console.log('里程碑:', this.metrics)
    console.groupEnd()
  }
}

// ============================================================
// 常量
// ============================================================

// 字段投影：覆盖 ids 查询 / aggregate 查询 / 普通查询三处
const RESOURCE_FIELD = {
  _id: true, type: true, title: true, coverUrl: true,
  originUrl: true, url: true, categories: true, tags: true,
  views: true, hotScore: true, dailyHotScore: true, downloads: true, favorites: true, createdAt: true
}

// 排序字段映射
const SORT_FIELD_MAP = {
  'latest': 'createdAt', 'createTime': 'createdAt', 'createdAt': 'createdAt',
  'hot': 'hotScore', 'hotScore': 'hotScore',
  'todayHot': 'dailyHotScore', 'dailyHot': 'dailyHotScore', 'dailyHotScore': 'dailyHotScore',
  'viewCount': 'hotScore',
  'likeCount': 'favorites', 'favorites': 'favorites',
  'downloadCount': 'downloads', 'downloads': 'downloads'
}

// 类型关键词
const AVATAR_KEYWORDS = ['头像', '头象']
const WALLPAPER_KEYWORDS = ['壁纸', '背景', '墙纸']

// ============================================================
// 数据清洗：ids 路径和普通路径共用
// ============================================================
function cleanResource(item) {
  return {
    id: item._id,
    title: item.title,
    type: item.type,
    coverUrl: item.coverUrl,
    originUrl: item.originUrl || item.coverUrl,
    url: item.url || item.coverUrl,
    categories: item.categories || [item.category].filter(Boolean),
    tags: item.tags || [],
    views: item.views || 0,
    hotScore: item.hotScore || 0,
    dailyHotScore: item.dailyHotScore || 0,
    downloads: item.downloads || 0,
    favorites: item.favorites || 0,
    createdAt: item.createdAt || null
  }
}

// ============================================================
// 元数据获取（并行 + 只取必要字段）
// ============================================================
async function getAllCategories(type) {
  try {
    const query = db.collection('categories')
    if (type) {
      const result = await query.where({ type }).field({ key: true, name: true }).get()
      return result.data.map(item => ({ key: item.key, name: item.name }))
    } else {
      const result = await query.field({ key: true, name: true }).get()
      return result.data.map(item => ({ key: item.key, name: item.name }))
    }
  } catch (error) {
    console.error('获取分类失败:', error)
    return []
  }
}

async function getAllTags(type) {
  try {
    const where = type ? { type } : {}
    const result = await db.collection('resources')
      .where(where)
      .field({ tags: true })
      .limit(1000) // 加限制防止拉全量
      .get()

    const allTags = new Set()
    result.data.forEach(item => {
      if (item.tags && Array.isArray(item.tags)) {
        item.tags.forEach(tag => allTags.add(tag))
      }
    })
    return Array.from(allTags)
  } catch (error) {
    console.error('获取标签失败:', error)
    return []
  }
}

// ============================================================
// 关键词智能解析
// ============================================================
function parseKeyword(keyword) {
  if (!keyword) return { cleanKeyword: '', searchType: null }

  let cleanKeyword = keyword.replace(/\s+/g, ' ').trim()
  let searchType = null

  const hasAvatar = AVATAR_KEYWORDS.some(k => cleanKeyword.includes(k))
  const hasWallpaper = WALLPAPER_KEYWORDS.some(k => cleanKeyword.includes(k))

  // 两者都有则不处理，保留原始搜索
  if (!hasAvatar && !hasWallpaper) {
    // 保留原始关键词
  } else if (hasAvatar && !hasWallpaper) {
    searchType = 'avatar'
    AVATAR_KEYWORDS.forEach(k => { cleanKeyword = cleanKeyword.split(k).join('') })
  } else if (!hasAvatar && hasWallpaper) {
    searchType = 'wallpaper'
    WALLPAPER_KEYWORDS.forEach(k => { cleanKeyword = cleanKeyword.split(k).join('') })
  }

  cleanKeyword = cleanKeyword.replace(/\s+/g, ' ').trim()

  if (cleanKeyword && searchType === null) {
    // 只有在没有类型前缀时，才把纯关键词作为搜索条件
    return { cleanKeyword, searchType: null }
  }

  return { cleanKeyword, searchType }
}

// ============================================================
// 构建查询条件
// ============================================================
function buildConditions({ type, category, tag, color, keyword }) {
  const conditions = []

  // 类型
  if (type !== 'all') {
    conditions.push({ type })
  }

  // 分类
  if (category && category !== 'all') {
    conditions.push({ categories: _.in([category]) })
  }

  // 标签
  if (tag) {
    conditions.push(_.or([
      { tags: tag },
      { categories: tag },
      { category: tag }
    ]))
  }

  // 颜色
  if (color) {
    conditions.push({ colors: _.in([color]) })
  }

  // 关键词（最后处理，会更新 searchType）
  const { cleanKeyword, searchType: keywordType } = parseKeyword(keyword)
  const finalType = keywordType || type
  if (finalType !== 'all' && conditions.findIndex(c => c.type !== undefined) === -1) {
    conditions.push({ type: finalType })
  }

  if (cleanKeyword) {
    const keywordReg = db.RegExp({ regexp: cleanKeyword, options: 'i' })
    conditions.push(_.or([
      { categories: _.in([cleanKeyword]) },
      { tags: _.in([cleanKeyword]) },
      { title: keywordReg },
      { categories: keywordReg },
      { tags: keywordReg },
      { category: keywordReg }
    ]))
  }

  return conditions
}

// ============================================================
// 主函数
// ============================================================
exports.main = async (event) => {
  const perf = new CloudFunctionPerformance()
  const params = event || {}

  try {
    perf.markMilestone('初始化完成')

    const {
      type = 'all',
      category = '',
      tag = '',
      page = 1,
      pageSize = 20,
      keyword = '',
      sort = 'latest',
      ids = [],
      includeMeta = true,
      color = ''
    } = params

    const limit = Math.min(Math.max(parseInt(pageSize) || 20, 1), 100)
    perf.markMilestone('参数解析完成')

    // 🔥 优化：第一页且无搜索条件时使用缓存
    const useCache = page === 1 && !keyword && !color && ids.length === 0
    const cacheKey = useCache ? `resources_${type}_${tag || 'all'}_${sort}` : null
    
    if (useCache && cacheKey) {
      const cached = await getCache(cacheKey)
      if (cached) {
        perf.markMilestone('缓存命中')
        perf.logSummary()
        return cached
      }
    }

    // ============================================================
    // 分支 A：ids 批量查询
    // ============================================================
    if (ids && ids.length > 0) {
      const queryStart = Date.now()
      const res = await db.collection('resources')
        .where({ _id: _.in(ids) })
        .field(RESOURCE_FIELD)
        .limit(100)
        .get()

      perf.trackDatabaseQuery('resources', 'query_by_ids', queryStart)

      let data = (res.data || []).map(cleanResource)

      // 按原始 ids 顺序排序
      const orderMap = new Map(ids.map((id, index) => [id, index]))
      data.sort((a, b) => (orderMap.get(a.id) || 0) - (orderMap.get(b.id) || 0))

      perf.markMilestone('ID查询完成')
      perf.logSummary()

      return {
        success: true,
        data,
        page: 1,
        pageSize: ids.length,
        hasMore: false,
        categories: [],
        tags: []
      }
    }

    // ============================================================
    // 分支 B：分页 / 搜索查询
    // ============================================================
    const conditions = buildConditions({ type, category, tag, color, keyword })
    const sortField = SORT_FIELD_MAP[sort] || 'createdAt'
    const skip = Math.max(page - 1, 0) * limit

    perf.markMilestone('查询条件构建完成')

    const queryStart = Date.now()
    let res

    if (sort === 'random') {
      res = await db.collection('resources')
        .aggregate()
        .match(_.and(conditions))
        .sample({ size: limit })
        .project(RESOURCE_FIELD)
        .end()
      res.data = res.list
    } else {
      res = await db.collection('resources')
        .where(_.and(conditions))
        .field(RESOURCE_FIELD)
        .orderBy(sortField, 'desc')
        .skip(skip)
        .limit(limit)
        .get()
    }

    perf.trackDatabaseQuery('resources', 'query_resources', queryStart)
    perf.markMilestone('资源查询完成')

    // ============================================================
    // 元数据并行获取
    // ============================================================
    let categories = []
    let tags = []
    if (includeMeta) {
      const [cats, tgs] = await Promise.all([
        getAllCategories(type === 'all' ? undefined : type),
        getAllTags(type === 'all' ? undefined : type)
      ])
      categories = cats
      tags = tgs
      perf.markMilestone('元数据获取完成')
    }

    const data = (res.data || []).map(cleanResource)

    const result = {
      success: true,
      data,
      page,
      pageSize: limit,
      hasMore: data.length === limit,
      categories,
      tags
    }

    // 🔥 缓存第一页结果
    if (useCache && cacheKey) {
      setCache(cacheKey, result)
    }

    perf.logSummary()
    return result

  } catch (error) {
    console.error('getResources error:', error)
    perf.logSummary()
    return {
      success: false,
      message: error?.message || '加载资源失败'
    }
  }
}
