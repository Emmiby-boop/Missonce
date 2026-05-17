const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 内存缓存
const _memCache = {}
const CACHE_DURATION = 10 * 60 * 1000 // 10分钟

exports.main = async (event, context) => {
  try {
    const { status = 'active' } = event
    
    // 检查内存缓存
    const cacheKey = `banners_${status}`
    const now = Date.now()
    const cached = _memCache[cacheKey]
    if (cached && now - cached.time < CACHE_DURATION) {
      console.log('[getBanners] 从内存缓存返回')
      return cached.data
    }
    
    const cleanField = (value) => {
      if (typeof value === 'string') {
        return value.trim().replace(/^`\s*/, '').replace(/\s*`$/, '')
      }
      return value
    }
    
    const processBanner = (banner) => {
      const processedBanner = { ...banner }
      
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
    }
    
    // 尝试带排序获取
    let result
    try {
      const res = await db.collection('banners')
        .where({ status })
        .orderBy('sort', 'asc')
        .get()
      const processedData = res.data.map(processBanner)
      result = { success: true, data: processedData }
    } catch (sortErr) {
      console.warn('带排序获取失败，尝试降级获取', sortErr)
      // 降级：如果因为缺少索引导致失败，尝试不排序获取
      const res = await db.collection('banners')
        .where({ status })
        .get()
      const processedData = res.data.map(processBanner)
      result = { success: true, data: processedData }
    }
    
    // 写入内存缓存
    _memCache[cacheKey] = { data: result, time: now }
    
    return result
  } catch (err) {
    console.error('获取轮播图失败:', err)
    return { success: false, error: err }
  }
}
