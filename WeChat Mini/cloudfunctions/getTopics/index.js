const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 内存缓存：专题列表（按 status 维度缓存）
const _cache = {
  data: null,
  timestamp: 0,
  status: ''
}
const CACHE_TTL = 5 * 60 * 1000  // 5 分钟

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

  logSummary() {
    const totalTime = Date.now() - this.startTime
    console.group('[Performance] 📈 云函数执行总结')
    console.log(`总耗时: ${totalTime}ms`)
    console.log('里程碑:', this.metrics)
    console.groupEnd()
  }
}

exports.main = async (event, context) => {
  // 🔥 定时触发器保活：仅维持热实例，不执行业务查询（专题页冷启动关键路径）
  if (event && event.Type === 'timer') {
    return { success: true, message: 'keepalive', timestamp: Date.now() }
  }

  const perf = new CloudFunctionPerformance()
  const { id } = event || {}
  
  try {
    perf.markMilestone('初始化完成')

    if (id) {
      const topicRes = await db.collection('topics').doc(id).get()
      
      if (!topicRes.data) {
        return {
          success: false,
          message: '专题不存在'
        }
      }
      
      const topic = topicRes.data
      console.log('[Topic] 专题数据:', JSON.stringify(topic, null, 2))
      perf.markMilestone('专题信息获取完成')

      // Resolve cover URL if stored as cloud fileID
      let topicCoverUrl = topic.coverUrl || topic.cover || topic.image || ''
      if (topicCoverUrl && typeof topicCoverUrl === 'string' && topicCoverUrl.startsWith('cloud://')) {
        try {
          const coverUrlRes = await cloud.getTempFileURL({
            fileList: [{ fileID: topicCoverUrl, maxAge: 3600 * 24 * 7 }]
          })
          topicCoverUrl = coverUrlRes.fileList?.[0]?.tempFileURL || topicCoverUrl
        } catch (coverErr) {
          console.warn('[Topic] 封面 URL 解析失败:', coverErr)
        }
      }

      let resources = []
      let resourceIds = []
      
      const contentType = topic.contentType || 'manual'
      
      if (contentType === 'auto') {
        console.log('[Topic] 自动筛选模式')
        const filterType = topic.filterType
        const filterValue = topic.filterValue
        const resourceType = topic.resourceType || 'all'
        const defaultSort = topic.defaultSort || 'latest'
        const gridModule = topic.layout?.modules?.find(m => m.type === 'resource-grid')
        const count = gridModule?.config?.count || 20
        
        console.log('[Topic] 筛选条件:', { filterType, filterValue, resourceType, defaultSort, count })
        
        const conditions = { deletedAt: null }
        
        if (resourceType && resourceType !== 'all') {
          conditions.type = resourceType
        }
        
        if (filterType === 'tag' && filterValue) {
          conditions.tags = filterValue
        } else if (filterType === 'category' && filterValue) {
          conditions.categories = filterValue
        }
        
        console.log('[Topic] 查询条件:', conditions)
        
        let query = db.collection('resources').where(conditions)
        
        if (defaultSort === 'hot') {
          query = query.orderBy('hotScore', 'desc')
        }
        query = query.orderBy('createdAt', 'desc')
        
        const resourceRes = await query.limit(count).get()
        resources = resourceRes.data.map(item => {
          const result = {
            ...item,
            id: item._id,
            _id: item._id,
            coverUrl: item.coverUrl || item.cover,
            cover: item.cover || item.coverUrl,
            originUrl: item.originUrl,
            categories: item.categories || [item.category].filter(Boolean),
            tags: item.tags || [],
            hotScore: item.hotScore || 0,
            downloads: item.downloads || 0,
            favorites: item.favorites || 0
          }
          return result
        })
        
        console.log('[Topic] 自动筛选获取资源数量:', resources.length)
      } else {
        console.log('[Topic] 手动模式')
        if (topic.resources) {
          if (Array.isArray(topic.resources) && topic.resources.length > 0) {
            resourceIds = topic.resources
          } else if (typeof topic.resources === 'string' && topic.resources.trim()) {
            resourceIds = topic.resources.split(',').map(id => id.trim()).filter(id => id)
          }
        }
        if (topic.resourceIds && resourceIds.length === 0) {
          if (Array.isArray(topic.resourceIds) && topic.resourceIds.length > 0) {
            resourceIds = topic.resourceIds
          } else if (typeof topic.resourceIds === 'string' && topic.resourceIds.trim()) {
            resourceIds = topic.resourceIds.split(',').map(id => id.trim()).filter(id => id)
          }
        }
        if (topic.resourceList && resourceIds.length === 0) {
          if (Array.isArray(topic.resourceList) && topic.resourceList.length > 0) {
            resourceIds = topic.resourceList
          }
        }
        // Fallback: read manualIds from layout modules if no legacy resourceIds present
        if (resourceIds.length === 0 && topic.layout && topic.layout.modules) {
          const manualIds = topic.layout.modules
            .filter(m => m.type === 'resource-grid' && m.config && m.config.sourceType === 'manual')
            .flatMap(m => (m.config.manualIds || []).filter(id => id))
          resourceIds = [...new Set(manualIds)]
        }
        console.log('[Topic] 最终资源ID列表:', resourceIds)
        perf.markMilestone('资源ID解析完成')

        if (resourceIds.length > 0) {
          const chunkSize = 20
          const chunks = []
          for (let i = 0; i < resourceIds.length; i += chunkSize) {
            chunks.push(resourceIds.slice(i, i + chunkSize))
          }
          
          const resourcePromises = chunks.map(chunk => 
            db.collection('resources')
              .where({
                _id: _.in(chunk),
                deletedAt: null
              })
              .get()
          )
          
          const resourceResults = await Promise.all(resourcePromises)
          const allResources = resourceResults.flatMap(r => r.data || [])
          console.log('[Topic] 查询到的资源数量:', allResources.length)
          
          const idToIndex = new Map(resourceIds.map((id, index) => [id, index]))
          resources = allResources.sort((a, b) => {
            return (idToIndex.get(a._id) ?? 9999) - (idToIndex.get(b._id) ?? 9999)
          }).map(item => {
            const result = {
              ...item,
              id: item._id,
              _id: item._id,
              coverUrl: item.coverUrl || item.cover,
              cover: item.cover || item.coverUrl,
              originUrl: item.originUrl,
              categories: item.categories || [item.category].filter(Boolean),
              tags: item.tags || [],
              hotScore: item.hotScore || 0,
              downloads: item.downloads || 0,
              favorites: item.favorites || 0
            }
            return result
          })
        }
      }
      
      perf.markMilestone('资源数据获取完成')

      const result = {
        success: true,
        data: {
          ...topic,
          id: topic._id,
          _id: topic._id,
          title: topic.title,
          coverUrl: topicCoverUrl,
          cover: topicCoverUrl,
          description: topic.description || topic.desc,
          desc: topic.desc || topic.description,
          resources,
          resourceIds: resourceIds
        }
      }
      
      console.log('[Topic] 返回结果:', JSON.stringify(result, null, 2))
      perf.logSummary()
      return result
    }

    // 专题列表接口：支持分页 + 状态过滤
    const status = event.status || 'active'
    const page = Math.max(1, parseInt(event.page, 10) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(event.pageSize, 10) || 20))
    const skip = (page - 1) * pageSize

    // 后台管理需要实时数据，status='all' 时不使用缓存
    const useCache = page === 1 && status !== 'all'

    // 内存缓存命中时直接返回（只缓存第一页 active 列表，按 status 维度）
    if (useCache && _cache.data && _cache.status === status && (Date.now() - _cache.timestamp) < CACHE_TTL) {
      perf.markMilestone('专题列表命中缓存')
      perf.logSummary()
      return {
        success: true,
        data: _cache.data.slice(0, pageSize),
        hasMore: _cache.data.length > pageSize
      }
    }

    const whereCondition = status === 'all' ? {} : { status: status }
    const totalRes = await db.collection('topics').where(whereCondition).count()
    const total = totalRes.total || 0

    const topicsRes = await db.collection('topics')
      .where(whereCondition)
      .orderBy('sort', 'asc')
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
    
    perf.markMilestone('专题列表获取完成')

    // Batch resolve cloud:// cover URLs to temp URLs
    const coverFileIDs = (topicsRes.data || [])
      .map(item => item.cover || item.coverUrl || item.image)
      .filter(url => typeof url === 'string' && url.startsWith('cloud://'))
    const coverUrlMap = new Map()
    if (coverFileIDs.length > 0) {
      try {
        const uniqueFileIDs = [...new Set(coverFileIDs)]
        const coverUrlRes = await cloud.getTempFileURL({
          fileList: uniqueFileIDs.map(fileID => ({ fileID, maxAge: 3600 * 24 * 7 }))
        })
        ;(coverUrlRes.fileList || []).forEach(f => {
          if (f.tempFileURL) coverUrlMap.set(f.fileID, f.tempFileURL)
        })
      } catch (coverErr) {
        console.warn('[Topics] 批量解析封面URL失败:', coverErr)
      }
    }

    const topics = (topicsRes.data || []).map(item => {
      const rawCover = item.cover || item.coverUrl || item.image || ''
      const resolvedCover = rawCover && rawCover.startsWith('cloud://')
        ? (coverUrlMap.get(rawCover) || rawCover)
        : rawCover

      // 从 layout 提取手动选择的资源ID和网格列数
      let manualIds = []
      let gridColumns = 3
      if (item.layout && item.layout.modules) {
        const gridModule = item.layout.modules.find(m => m.type === 'resource-grid')
        if (gridModule && gridModule.config) {
          if (gridModule.config.sourceType === 'manual' && Array.isArray(gridModule.config.manualIds)) {
            manualIds = gridModule.config.manualIds
          }
          if (gridModule.config.columns) {
            gridColumns = gridModule.config.columns
          }
        }
      }
      // 兼容旧数据：resourceIds 字段
      if (manualIds.length === 0 && Array.isArray(item.resourceIds) && item.resourceIds.length > 0) {
        manualIds = item.resourceIds
      }

      return {
        id: item._id,
        _id: item._id,
        title: item.title,
        coverUrl: resolvedCover,
        cover: resolvedCover,
        description: item.description || item.desc,
        desc: item.desc || item.description,
        sort: item.sort || 0,
        createdAt: item.createdAt,
        status: item.status || 'active',
        isFeatured: item.isFeatured || false,
        badge: item.badge || '',
        filterType: item.filterType || 'tag',
        filterValue: item.filterValue || '',
        resourceType: item.resourceType || 'all',
        contentType: item.contentType || 'auto',
        defaultSort: item.defaultSort || 'latest',
        linkType: item.linkType || 'resource',
        linkUrl: item.linkUrl || '',
        manualIds,
        gridColumns
      }
    })

    const hasMore = skip + topics.length < total

    // 缓存第一页 active 列表数据（用于分页加载和避免重复查询）
    if (useCache) {
      _cache.data = topics
      _cache.timestamp = Date.now()
      _cache.status = status
    }

    const result = {
      success: true,
      data: topics,
      hasMore,
      total
    }
    
    perf.logSummary()
    return result
    
  } catch (error) {
    console.error('getTopics error:', error)
    perf.logSummary()
    return {
      success: false,
      message: error?.message || '获取专题失败'
    }
  }
}
