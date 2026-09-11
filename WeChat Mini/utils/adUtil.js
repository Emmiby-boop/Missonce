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

// listAdConfig 缓存（全局，按 pagePath 返回间隔配置）
const listAdConfigCache = { value: null, timestamp: 0 }
const LIST_AD_CACHE_EXPIRE = 5 * 60 * 1000 // 5分钟

/**
 * 读取 listAdConfig 中指定页面的广告间隔配置
 * @param {string} pagePath - 页面路径，如 '/pages/index/index'
 * @param {number} defaultInterval - 后台未配置时的默认间隔
 * @returns {Promise<{enabled: boolean, interval: number}>}
 */
export const getListAdConfig = async (pagePath, defaultInterval = 12) => {
  try {
    // 命中缓存
    if (listAdConfigCache.value && Date.now() - listAdConfigCache.timestamp < LIST_AD_CACHE_EXPIRE) {
      const cfg = listAdConfigCache.value || {}
      const pages = cfg.pages || {}
      const pageCfg = pages[pagePath]
      if (pageCfg) {
        const interval = Math.max(0, Math.min(50, Number(pageCfg.interval) || defaultInterval))
        return { enabled: pageCfg.enabled !== false && interval > 0, interval }
      }
      return { enabled: false, interval: defaultInterval }
    }

    const res = await wx.cloud.callFunction({
      name: 'getConfig',
      data: { key: 'listAdConfig' }
    })
    if (res && res.result && res.result.success && res.result.data) {
      listAdConfigCache.value = res.result.data.value || {}
      listAdConfigCache.timestamp = Date.now()
      const cfg = listAdConfigCache.value || {}
      const pages = cfg.pages || {}
      const pageCfg = pages[pagePath]
      if (pageCfg) {
        const interval = Math.max(0, Math.min(50, Number(pageCfg.interval) || defaultInterval))
        return { enabled: pageCfg.enabled !== false && interval > 0, interval }
      }
    }
  } catch (e) {
    console.error('[adUtil] 获取 listAdConfig 失败:', e)
  }
  return { enabled: false, interval: defaultInterval }
}

/**
 * 清除 listAdConfig 缓存（下拉刷新时调用）
 */
export const clearListAdConfigCache = () => {
  listAdConfigCache.value = null
  listAdConfigCache.timestamp = 0
}

export default { fetchPageAds, pickByType, getListAdConfig, clearListAdConfigCache }
