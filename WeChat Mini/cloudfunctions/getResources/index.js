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

async function getAllTags(type) {
  try {
    const where = type ? { type } : {}
    const resources = await db.collection('resources')
      .where(where)
      .field({ tags: 1 })
      .get()
    
    const allTags = new Set()
    resources.data.forEach(item => {
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

async function getAllCategories(type) {
  try {
    const where = type ? { type } : {}
    const categories = await db.collection('categories')
      .where(where)
      .get()
    
    return categories.data.map(item => ({
      key: item.key,
      name: item.name
    }))
  } catch (error) {
    console.error('获取分类失败:', error)
    return []
  }
}

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
      includeMeta = true
    } = params

    const limit = Math.min(Math.max(parseInt(pageSize) || 20, 1), 100)
    perf.markMilestone('参数解析完成')

    if (ids && ids.length > 0) {
       const res = await db.collection('resources')
        .where({
          _id: _.in(ids)
        })
        .field({
          _id: true, title: true, type: true, coverUrl: true,
          originUrl: true, categories: true, tags: true,
          hotScore: true, downloads: true, favorites: true, createdAt: true
        })
        .limit(100)
        .get()

       const data = (res.data || []).map(item => ({
          id: item._id,
          title: item.title,
          type: item.type,
          coverUrl: item.coverUrl,
          originUrl: item.originUrl || item.coverUrl,
          categories: item.categories || [item.category].filter(Boolean),
          tags: item.tags || [],
          hotScore: item.hotScore || 0,
          downloads: item.downloads || 0,
          favorites: item.favorites || 0,
          createdAt: item.createdAt || null
        }))
        
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

    const conditions = []
    let searchType = type
    let searchKeyword = keyword
    
    if (searchKeyword) {
      if (searchKeyword.includes('头像')) {
        searchType = 'avatar'
        searchKeyword = searchKeyword.replace(/头像/g, '').trim()
      } else if (searchKeyword.includes('壁纸')) {
        searchType = 'wallpaper'
        searchKeyword = searchKeyword.replace(/壁纸/g, '').trim()
      }

      const commonTags = [
        '女生', '男生', '情侣', '动漫', '二次元', '风景', '城市', '极简', '萌宠', '猫', '狗', 
        '清新', '酷帅', '少女', '日落', '山川', '夜景', '霓虹', '蓝色', '质感', '海岸', '夏日', 
        '星空', '夜色', '街拍', '潮流', '夕阳', '浪漫', '森林', '清晨', '雾气', '插画', '可爱', 
        '线稿', '留白', '赛博', '古风', '唯美', '手绘', '卡通', '黑白'
      ]
      
      const extractedTags = []
      commonTags.forEach(tag => {
        if (searchKeyword.includes(tag)) {
          extractedTags.push(tag)
          searchKeyword = searchKeyword.split(tag).join(' ').trim()
        }
      })
      
      extractedTags.forEach(t => {
        const tagReg = db.RegExp({ regexp: t, options: 'i' })
        conditions.push(_.or([
          { tags: tagReg },
          { categories: tagReg },
          { category: tagReg },
          { title: tagReg }
        ]))
      })
      
      searchKeyword = searchKeyword.replace(/\s+/g, ' ').trim()
      if (searchKeyword) {
        const subKeywords = searchKeyword.split(' ')
        subKeywords.forEach(k => {
          if (k) {
             const kReg = db.RegExp({ regexp: k, options: 'i' })
             conditions.push(_.or([
               { title: kReg },
               { tags: kReg },
               { categories: kReg }
             ]))
          }
        })
      }
    }

    if (searchType !== 'all') {
      conditions.push({ type: searchType })
    }

    if (category && category !== 'all') {
      conditions.push({
        categories: _.in([category])
      })
    }

    if (tag) {
      conditions.push(_.or([
        { tags: tag },
        { categories: tag },
        { category: tag }
      ]))
    }

    const skip = Math.max(page - 1, 0) * pageSize
    perf.markMilestone('查询条件构建完成')
    
    const SORT_FIELD_MAP = {
      'latest': 'createdAt',
      'createTime': 'createdAt',
      'createdAt': 'createdAt',
      'hot': 'hotScore',
      'hotScore': 'hotScore',
      'viewCount': 'hotScore',
      'likeCount': 'favorites',
      'favorites': 'favorites',
      'downloadCount': 'downloads',
      'downloads': 'downloads'
    }
    
    const sortField = SORT_FIELD_MAP[sort] || 'createdAt'

    const queryStart = Date.now()
    let res
    
    if (sort === 'random') {
      res = await db.collection('resources')
        .aggregate()
        .match(_.and(conditions))
        .sample({ size: limit })
        .project({
          _id: true, type: true, title: true, coverUrl: true,
          originUrl: true, categories: true, tags: true,
          hotScore: true, downloads: true, favorites: true, createdAt: true
        })
        .end()
      
      res.data = res.list
    } else {
      res = await db.collection('resources')
        .where(_.and(conditions))
        .field({
          _id: true, type: true, title: true, coverUrl: true,
          originUrl: true, categories: true, tags: true,
          hotScore: true, downloads: true, favorites: true, createdAt: true
        })
        .orderBy(sortField, 'desc')
        .skip(skip)
        .limit(limit)
        .get()
    }
    
    perf.trackDatabaseQuery('resources', 'query_resources', queryStart)
    perf.markMilestone('资源查询完成')

    const data = (res.data || []).map(item => ({
      id: item._id,
      title: item.title,
      type: item.type,
      coverUrl: item.coverUrl,
      originUrl: item.originUrl || item.coverUrl,
      categories: item.categories || [item.category].filter(Boolean),
      tags: item.tags || [],
      hotScore: item.hotScore || 0,
      downloads: item.downloads || 0,
      favorites: item.favorites || 0,
      createdAt: item.createdAt || null
    }))

    let categories = []
    let tags = []
    if (includeMeta) {
      const meta = await Promise.all([
        getAllCategories(type === 'all' ? undefined : type),
        getAllTags(type === 'all' ? undefined : type)
      ])
      categories = meta[0]
      tags = meta[1]
      perf.markMilestone('元数据获取完成')
    }

    const result = {
      success: true,
      data,
      page,
      pageSize,
      hasMore: data.length === pageSize,
      categories,
      tags
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
