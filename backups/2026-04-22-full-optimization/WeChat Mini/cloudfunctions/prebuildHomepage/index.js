const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// ============================================================
// CloudCache — 服务端内存缓存（从 getHomeData 复制）
// ============================================================
class CloudCache {
  constructor(options = {}) {
    this.defaultTTL = options.defaultTTL || 5 * 60 * 1000
    this.collectionName = options.collectionName || 'cloud_cache'
  }

  async get(key) {
    try {
      const res = await db.collection(this.collectionName).where({ key }).get()
      if (res.data.length > 0) {
        const cacheItem = res.data[0]
        if (cacheItem.expireAt > Date.now()) {
          return cacheItem.value
        }
        await this.delete(key)
      }
      return null
    } catch (err) {
      return null
    }
  }

  async set(key, value, ttl = this.defaultTTL) {
    try {
      const expireAt = Date.now() + ttl
      const existing = await db.collection(this.collectionName).where({ key }).get()
      if (existing.data.length > 0) {
        await db.collection(this.collectionName).doc(existing.data[0]._id).update({
          data: { value, expireAt, updatedAt: db.serverDate() }
        })
      } else {
        await db.collection(this.collectionName).add({
          data: { key, value, expireAt, createdAt: db.serverDate(), updatedAt: db.serverDate() }
        })
      }
      return true
    } catch (err) {
      return false
    }
  }

  async delete(key) {
    try {
      const res = await db.collection(this.collectionName).where({ key }).get()
      if (res.data.length > 0) {
        await db.collection(this.collectionName).doc(res.data[0]._id).remove()
      }
      return true
    } catch (err) {
      return false
    }
  }
}

const cache = new CloudCache({ defaultTTL: 2 * 60 * 60 * 1000 }) // 预渲染缓存 2 小时

// ============================================================
// 辅助函数
// ============================================================
const cleanField = (value) => {
  if (typeof value === 'string') {
    return value.trim().replace(/^`\s*/, '').replace(/\s*`$/, '')
  }
  return value
}

// 核心数据生成逻辑（从 getHomeData 的 sectionDataPromises 简化）
async function generateSectionItems(db, sectionConfig, categoryMap) {
  const dataSource = sectionConfig.dataSource || {}
  const queryConfig = sectionConfig.queryConfig || {}

  const sourceType = dataSource.type || 'automatic'
  const limit = Number(dataSource.limit || queryConfig.limit) || 6

  let items = []

  if (sourceType === 'manual' && dataSource.manualItems && dataSource.manualItems.length > 0) {
    const manualIds = dataSource.manualItems.map(item => typeof item === 'string' ? item : item.id).filter(id => id)
    if (manualIds.length > 0) {
      const manualRes = await db.collection('resources')
        .where({ _id: _.in(manualIds) })
        .field({ _id: true, title: true, type: true, coverUrl: true, originUrl: true, categories: true, tags: true, hotScore: true, downloads: true, favorites: true, createdAt: true })
        .get()
      const resourceMap = {}
      manualRes.data.forEach(item => { resourceMap[item._id] = item })
      items = manualIds.map(id => resourceMap[id]).filter(item => item)
    }
  }

  else if (sourceType === 'ai_personalized' || sourceType === 'recommendation') {
    const recResourceType = dataSource.resourceType || 'all'
    let matchStage = { status: 'published' }
    if (recResourceType && recResourceType !== 'all') {
      matchStage.type = recResourceType
    } else {
      matchStage.type = _.in(['wallpaper', 'avatar'])
    }

    if (dataSource.recommendationRule === 'random_discovery') {
      const sampleRes = await db.collection('resources').aggregate()
        .match(matchStage)
        .sample({ size: limit })
        .project({ _id: true, title: true, type: true, coverUrl: true, originUrl: true, categories: true, tags: true, hotScore: true, downloads: true, favorites: true, createdAt: true })
        .end()
      items = sampleRes.list
    } else {
      const trendRes = await db.collection('resources')
        .where(matchStage)
        .orderBy('hotScore', 'desc')
        .orderBy('createdAt', 'desc')
        .field({ _id: true, title: true, type: true, coverUrl: true, originUrl: true, categories: true, tags: true, hotScore: true, downloads: true, favorites: true, createdAt: true })
        .limit(limit)
        .get()
      items = trendRes.data
    }
  }

  else {
    // automatic — 首页通用板块
    const resourceType = dataSource.resourceType || queryConfig.resourceType || 'all'
    const category = dataSource.category || queryConfig.category
    const tagsRaw = dataSource.tags || queryConfig.tags
    const autoSplit = dataSource.autoSplit === true
    const totalLimit = Number(dataSource.limit || queryConfig.limit || 6)
    const rawSortField = dataSource.sortField || queryConfig.sortField || 'createTime'

    const SORT_FIELD_MAP = {
      'createTime': 'createdAt', 'createdAt': 'createdAt',
      'hotScore': 'hotScore', 'viewCount': 'hotScore',
      'likeCount': 'favorites', 'favorites': 'favorites',
      'downloadCount': 'downloads', 'downloads': 'downloads'
    }
    const sortField = SORT_FIELD_MAP[rawSortField] || 'createdAt'

    const conditions = { status: 'published' }
    if (resourceType && resourceType !== 'all') conditions.type = resourceType
    if (category && category !== 'all') {
      const catValues = [category]
      if (categoryMap[category]) catValues.push(categoryMap[category])
      conditions.categories = _.in(catValues)
    }

    let filterTags = []
    if (tagsRaw) {
      filterTags = (typeof tagsRaw === 'string' ? tagsRaw.split(/[,，]/) : tagsRaw).map(t => t.trim()).filter(t => t)
    } else if (queryConfig.tag) {
      filterTags = (typeof queryConfig.tag === 'string' ? queryConfig.tag.split(/[,，]/) : [queryConfig.tag]).map(t => t.trim()).filter(t => t)
    }

    let queryConditions = conditions
    if (filterTags.length > 0) {
      const tagOrConditions = filterTags.map(t => ({ tags: t }))
      queryConditions = _.and(conditions, _.or(tagOrConditions))
    }

    if (resourceType === 'all' && !autoSplit) {
      const validSortFields = ['createdAt', 'hotScore', 'favorites', 'downloads']
      const sortFieldName = validSortFields.includes(sortField) ? sortField : 'createdAt'
      const [wallpaperRes, avatarRes] = await Promise.all([
        db.collection('resources').where({ ...queryConditions, type: 'wallpaper' })
          .orderBy(sortFieldName, 'desc').field({ _id: true, title: true, type: true, coverUrl: true, originUrl: true, categories: true, tags: true, hotScore: true, downloads: true, favorites: true, createdAt: true }).limit(totalLimit).get(),
        db.collection('resources').where({ ...queryConditions, type: 'avatar' })
          .orderBy(sortFieldName, 'desc').field({ _id: true, title: true, type: true, coverUrl: true, originUrl: true, categories: true, tags: true, hotScore: true, downloads: true, favorites: true, createdAt: true }).limit(totalLimit).get()
      ])
      const wallpaperItems = wallpaperRes.data
      const usedSlots = wallpaperItems.length * 2
      items = [...wallpaperItems, ...avatarRes.data.slice(0, Math.max(0, totalLimit - usedSlots))]
    } else {
      let query = db.collection('resources').where(queryConditions)
      const validSortFields = ['createdAt', 'hotScore', 'favorites', 'downloads']
      if (validSortFields.includes(sortField)) {
        query = query.orderBy(sortField, 'desc')
        if (sortField !== 'createdAt') query = query.orderBy('createdAt', 'desc')
      } else {
        query = query.orderBy('createdAt', 'desc')
      }
      const result = await query.field({ _id: true, title: true, type: true, coverUrl: true, originUrl: true, categories: true, tags: true, hotScore: true, downloads: true, favorites: true, createdAt: true }).limit(totalLimit).get()
      items = result.data
    }
  }

  return items
}

// ============================================================
// 主函数
// ============================================================
exports.main = async (event, context) => {
  const startTime = Date.now()

  try {
    console.log('[prebuildHomepage] 开始预渲染首页数据')

    // 1. 获取基础配置
    const [bannersResult, sectionsResult, categoriesResult] = await Promise.all([
      db.collection('banners').orderBy('sort', 'asc').where({ status: 'active' })
        .field({ _id: true, title: true, image: true, link: true, type: true, target: true, sort: true }).get(),
      db.collection('home_sections').where({ enable: true }).orderBy('sort', 'asc').get(),
      db.collection('categories').where({ enabled: true }).get()
    ])

    // 2. 处理 banners
    const banners = bannersResult.data.map(banner => {
      const b = { ...banner }
      b.image = cleanField(b.image)
      b.target = cleanField(b.target)
      b.link = cleanField(b.link)
      b.type = cleanField(b.type)
      if (b.link && !b.target) {
        b.target = b.link
        if (!b.type) b.type = 'page'
      }
      return b
    })

    // 3. 构建分类映射
    const categoryMap = {}
    categoriesResult.data.forEach(cat => {
      categoryMap[cat.name] = cat.key
      categoryMap[cat.key] = cat.key
    })

    // 4. 生成所有板块数据（并行）
    const sectionsData = await Promise.all(
      sectionsResult.data.map(config => generateSectionItems(db, config, categoryMap))
    )

    // 5. 组装结果
    const result = {
      success: true,
      data: {
        banners,
        sections: sectionsResult.data.map((config, i) => ({
          ...config,
          dataSource: config.dataSource || {},
          queryConfig: config.queryConfig || {},
          items: sectionsData[i]
        }))
      }
    }

    // 6. 写入预渲染缓存（2小时TTL）
    const prebuiltCacheKey = 'home_prebuilt_v1'
    await cache.set(prebuiltCacheKey, result, 2 * 60 * 60 * 1000)

    const cost = Date.now() - startTime
    console.log(`[prebuildHomepage] ✅ 预渲染完成，耗时: ${cost}ms`)
    console.log(`  - banners: ${banners.length}`)
    console.log(`  - sections: ${sectionsResult.data.length}`)

    return {
      success: true,
      cost,
      bannersCount: banners.length,
      sectionsCount: sectionsResult.data.length
    }

  } catch (err) {
    console.error('[prebuildHomepage] ❌ 预渲染失败:', err)
    return {
      success: false,
      error: err.message || String(err)
    }
  }
}
