const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()
const _ = db.command
const $ = db.command.aggregate

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

  getSummary() {
    const totalTime = Date.now() - this.startTime
    const totalDbTime = this.databaseQueries.reduce((sum, q) => sum + q.duration, 0)
    return { totalTime, totalDbTime, dbQueryCount: this.databaseQueries.length, metrics: this.metrics, databaseQueries: this.databaseQueries }
  }

  logSummary() {
    const summary = this.getSummary()
    console.group('[Performance] 📈 云函数执行总结')
    console.log(`总耗时: ${summary.totalTime}ms`)
    console.log(`数据库查询: ${summary.dbQueryCount}次, 总耗时: ${summary.totalDbTime}ms`)
    console.log('里程碑:', summary.metrics)
    console.groupEnd()
    return summary
  }
}

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
          console.log(`[Cache] ✅ Hit: ${key}`)
          return cacheItem.value
        }
        console.log(`[Cache] ⏰ Expired: ${key}`)
        await this.delete(key)
      }
      console.log(`[Cache] ❌ Miss: ${key}`)
      return null
    } catch (err) {
      console.error(`[Cache] Get error:`, err)
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
      console.log(`[Cache] 💾 Set: ${key} (TTL: ${ttl}ms)`)
      return true
    } catch (err) {
      console.error(`[Cache] Set error:`, err)
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
      console.error(`[Cache] Delete error:`, err)
      return false
    }
  }
}

// 缓存时间延长到 30 分钟，减少数据库查询频率
const cache = new CloudCache({ defaultTTL: 30 * 60 * 1000 })

exports.main = async (event, context) => {
  const perf = new CloudFunctionPerformance()
  
  try {
    perf.markMilestone('初始化完成')

    // 🔥 优先读预渲染缓存（由 prebuildHomepage 云函数预先生成）
    // 预渲染缓存命中时，完全跳过所有数据库查询，冷启动毫秒级响应
    const prebuiltCacheKey = 'home_prebuilt_v1'
    const prebuiltData = await cache.get(prebuiltCacheKey)
    if (prebuiltData) {
      perf.markMilestone('预渲染缓存命中')
      perf.logSummary()
      return prebuiltData
    }

    // 回退：读普通缓存
    const cacheKey = 'home_data_v1'
    const cachedData = await cache.get(cacheKey)
    if (cachedData) {
      perf.markMilestone('缓存命中')
      perf.logSummary()
      return cachedData
    }

    perf.markMilestone('开始获取数据')

    const [bannersResult, sectionsResult, categoriesResult] = await Promise.all([
      db.collection('banners')
        .orderBy('sort', 'asc')
        .where({ status: 'active' })
        .field({ _id: true, title: true, image: true, link: true, type: true, target: true, sort: true })
        .get(),
      db.collection('home_sections')
        .where({ enable: true })
        .orderBy('sort', 'asc')
        .get(),
      db.collection('categories')
        .where({ enabled: true })
        .get()
    ])
    
    perf.markMilestone('基础数据获取完成')

    const banners = bannersResult.data.map(banner => {
      const processedBanner = { ...banner }
      
      const cleanField = (value) => {
        if (typeof value === 'string') {
          return value.trim().replace(/^`\s*/, '').replace(/\s*`$/, '')
        }
        return value
      }
      
      processedBanner.image = cleanField(processedBanner.image)
      processedBanner.target = cleanField(processedBanner.target)
      processedBanner.link = cleanField(processedBanner.link)
      processedBanner.type = cleanField(processedBanner.type)
      
      if (processedBanner.link && !processedBanner.target) {
        processedBanner.target = processedBanner.link
        if (!processedBanner.type) {
          processedBanner.type = 'page'
        }
      }
      
      return processedBanner
    })
    const sectionsConfig = sectionsResult.data
    const categories = categoriesResult.data
    
    const categoryMap = {}
    categories.forEach(cat => {
      categoryMap[cat.name] = cat.key
      categoryMap[cat.key] = cat.key
    })
    
    perf.markMilestone('分类映射构建完成')

    const sectionDataPromises = sectionsConfig.map(async (config) => {
      const dataSource = config.dataSource || {}
      const queryConfig = config.queryConfig || {}
      
      const sourceType = dataSource.type || 'automatic'
      const limit = Number(dataSource.limit || queryConfig.limit) || 6
      
      let items = []
      const queryStart = Date.now()

      if (sourceType === 'manual' && dataSource.manualItems && dataSource.manualItems.length > 0) {
        // 确保 manualItems 是字符串 ID 数组
        const manualIds = dataSource.manualItems.map((item) => {
          return typeof item === 'string' ? item : item.id
        }).filter((id) => id)
        
        if (manualIds.length > 0) {
          const manualRes = await db.collection('resources')
            .where({
              _id: _.in(manualIds)
            })
            .field({
              _id: true, title: true, type: true, coverUrl: true,
              originUrl: true, categories: true, tags: true,
              hotScore: true, downloads: true, favorites: true, createdAt: true
            })
            .get()
          
          // 构建 ID 到资源的映射，提高查找效率
          const resourceMap = {}
          manualRes.data.forEach(item => {
            resourceMap[item._id] = item
          })
          
          items = manualIds
            .map(id => resourceMap[id])
            .filter(item => item)
        }
      }
      
      else if (sourceType === 'ai_personalized') {
        // 🔥 优化：简化 AI 个性化推荐，避免嵌套云函数调用
        // 直接使用热门推荐作为个性化推荐（性能优先）
        const recResourceType = dataSource.resourceType || 'all'
        const aiLimit = Number(dataSource.limit || queryConfig.limit) || 6
        
        let matchStage = { status: 'published' }
        if (recResourceType && recResourceType !== 'all') {
           matchStage.type = recResourceType
        } else {
           matchStage.type = _.in(['wallpaper', 'avatar'])
        }
        
        const recRes = await db.collection('resources')
          .where(matchStage)
          .orderBy('hotScore', 'desc')
          .orderBy('createdAt', 'desc')
          .field({
            _id: true, title: true, type: true, coverUrl: true,
            originUrl: true, categories: true, tags: true,
            hotScore: true, downloads: true, favorites: true, createdAt: true
          })
          .limit(aiLimit)
          .get()
        items = recRes.data
      }
      
      else if (sourceType === 'recommendation') {
        const rule = dataSource.recommendationRule || 'trending_now'
        const recResourceType = dataSource.resourceType || 'all'
        
        let matchStage = { status: 'published' }
        if (recResourceType && recResourceType !== 'all') {
           matchStage.type = recResourceType
        } else {
           matchStage.type = _.in(['wallpaper', 'avatar'])
        }

        if (rule === 'random_discovery') {
           const sampleRes = await db.collection('resources')
             .aggregate()
             .match(matchStage)
             .sample({ size: limit })
             .project({
               _id: true, title: true, type: true, coverUrl: true,
               originUrl: true, categories: true, tags: true,
               hotScore: true, downloads: true, favorites: true, createdAt: true
             })
             .end()
           items = sampleRes.list
        } else {
           const trendRes = await db.collection('resources')
             .where(matchStage)
             .orderBy('hotScore', 'desc')
             .orderBy('createdAt', 'desc')
             .field({
               _id: true, title: true, type: true, coverUrl: true,
               originUrl: true, categories: true, tags: true,
               hotScore: true, downloads: true, favorites: true, createdAt: true
             })
             .limit(limit)
             .get()
           items = trendRes.data
        }
      }
      
      else {
        const resourceType = dataSource.resourceType || queryConfig.resourceType || 'all'
        const category = dataSource.category || queryConfig.category
        const tagsRaw = dataSource.tags || queryConfig.tags
        const autoSplit = dataSource.autoSplit === true
        const totalLimit = Number(dataSource.limit || queryConfig.limit || 6)
        const rawSortField = dataSource.sortField || queryConfig.sortField || 'createTime'
        
        const SORT_FIELD_MAP = {
          'createTime': 'createdAt',
          'createdAt': 'createdAt',
          'hotScore': 'hotScore',
          'viewCount': 'hotScore',
          'likeCount': 'favorites',
          'favorites': 'favorites',
          'downloadCount': 'downloads',
          'downloads': 'downloads'
        }
        
        const sortField = SORT_FIELD_MAP[rawSortField] || 'createdAt'

        const conditions = { status: 'published' }
        
        if (resourceType && resourceType !== 'all') {
          conditions.type = resourceType
        }
        
        if (category && category !== 'all') {
          let catValues = [category]
          if (categoryMap[category]) {
            catValues.push(categoryMap[category])
          }
          conditions.categories = _.in(catValues)
        }
        
        let filterTags = []
        if (tagsRaw) {
          if (Array.isArray(tagsRaw)) {
            filterTags = tagsRaw
          } else if (typeof tagsRaw === 'string') {
            filterTags = tagsRaw.split(/[,，]/).map(t => t.trim()).filter(t => t)
          }
        } else if (queryConfig.tag) {
           if (typeof queryConfig.tag === 'string') {
              filterTags = queryConfig.tag.split(/[,，]/).map(t => t.trim()).filter(t => t)
           }
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
            db.collection('resources')
              .where({ ...queryConditions, type: 'wallpaper' })
              .orderBy(sortFieldName, 'desc')
              .field({
                _id: true, title: true, type: true, coverUrl: true,
                originUrl: true, categories: true, tags: true,
                hotScore: true, downloads: true, favorites: true, createdAt: true
              })
              .limit(totalLimit)
              .get(),
            db.collection('resources')
              .where({ ...queryConditions, type: 'avatar' })
              .orderBy(sortFieldName, 'desc')
              .field({
                _id: true, title: true, type: true, coverUrl: true,
                originUrl: true, categories: true, tags: true,
                hotScore: true, downloads: true, favorites: true, createdAt: true
              })
              .limit(totalLimit)
              .get()
          ])
          
          const wallpaperItems = wallpaperRes.data
          const wallpaperCount = wallpaperItems.length
          const usedSlots = wallpaperCount * 2
          let neededAvatars = totalLimit - usedSlots
          if (neededAvatars < 0) neededAvatars = 0
          
          const avatarItems = avatarRes.data.slice(0, neededAvatars)
          console.log('=== 混合内容处理 ===', 'totalLimit:', totalLimit, 'wallpaperCount:', wallpaperItems.length, 'avatarCount:', avatarItems.length)
          items = [...wallpaperItems, ...avatarItems]
        } else {
          let query = db.collection('resources').where(queryConditions)
          
          const validSortFields = ['createdAt', 'hotScore', 'favorites', 'downloads']
          if (validSortFields.includes(sortField)) {
            query = query.orderBy(sortField, 'desc')
            if (sortField !== 'createdAt') {
              query = query.orderBy('createdAt', 'desc')
            }
          } else {
            query = query.orderBy('createdAt', 'desc')
          }
          
          const result = await query
            .field({
              _id: true, title: true, type: true, coverUrl: true,
              originUrl: true, categories: true, tags: true,
              hotScore: true, downloads: true, favorites: true, createdAt: true
            })
            .limit(totalLimit)
            .get()
          items = result.data
        }
      }
      
      perf.trackDatabaseQuery('resources', 'get_section_data', queryStart)

      const finalQueryConfig = {
        ...queryConfig,
        resourceType: dataSource.resourceType || queryConfig.resourceType || 'all',
        category: dataSource.category || queryConfig.category,
        tags: dataSource.tags || queryConfig.tags,
        sortField: dataSource.sortField || queryConfig.sortField
      }

      return {
        ...config,
        queryConfig: finalQueryConfig,
        dataSource: {
          ...dataSource,
          autoSplit: dataSource.autoSplit || false
        },
        items
      }
    })

    perf.markMilestone('开始获取板块数据')
    const sectionsData = await Promise.all(sectionDataPromises)
    perf.markMilestone('板块数据获取完成')

    const result = {
      success: true,
      data: {
        banners,
        sections: sectionsData
      }
    }
    
    // 非阻塞写入缓存，不影响主流程返回
    cache.set(cacheKey, result, 30 * 60 * 1000).catch(err => {
      console.error('[Cache] 写入缓存失败:', err)
    })
    perf.markMilestone('缓存写入完成')
    perf.logSummary()
    
    return result

  } catch (err) {
    console.error(err)
    perf.logSummary()
    return {
      success: false,
      error: err
    }
  }
}
