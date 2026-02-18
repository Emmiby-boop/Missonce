const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

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
        
        const conditions = {}
        
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
                _id: _.in(chunk)
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
          coverUrl: topic.coverUrl || topic.cover || topic.image,
          cover: topic.cover || topic.coverUrl,
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

    const topicsRes = await db.collection('topics')
      .orderBy('sort', 'asc')
      .orderBy('createdAt', 'desc')
      .get()
    
    perf.markMilestone('专题列表获取完成')

    const topics = (topicsRes.data || []).map(item => ({
      id: item._id,
      _id: item._id,
      title: item.title,
      coverUrl: item.coverUrl || item.cover || item.image,
      cover: item.cover || item.coverUrl,
      description: item.description || item.desc,
      desc: item.desc || item.description,
      sort: item.sort || 0,
      createdAt: item.createdAt
    }))

    const result = {
      success: true,
      data: topics
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
