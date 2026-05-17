// 广告配置缓存
const adConfigCache = new Map()
const CACHE_EXPIRE_TIME = 5 * 60 * 1000 // 5分钟缓存

export const fetchPageAds = async (pagePath) => {
  try {
    // 检查缓存
    const cacheKey = pagePath
    const cached = adConfigCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_EXPIRE_TIME) {
      return cached.data
    }
    
    const res = await wx.cloud.callFunction({
      name: 'getAdConfig',
      data: { pagePath }
    })
    if (res && res.result && res.result.success) {
      const data = Array.isArray(res.result.data) ? res.result.data : []
      // 更新缓存
      adConfigCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      })
      return data
    }
  } catch (e) {
    console.error('获取广告配置失败:', e)
  }
  return []
}

export const pickByType = (list, type) => {
  return (list || []).filter(i => i && i.type === type && i.isEnable)
}

export default { fetchPageAds, pickByType }
