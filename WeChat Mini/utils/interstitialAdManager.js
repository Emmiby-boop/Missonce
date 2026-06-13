import { fetchPageAds, pickByType } from './adUtil.js'

let globalInterstitialAd = null
let lastShowTime = 0
let isAdLoading = false
let currentPagePath = ''
let externalAdPlaying = false
let interstitialShowing = false
let appStartTime = Date.now() // 记录小程序启动时间
let _triggerTimer = null
let dailyShowCount = 0
let dailyResetDate = ''

// 🔥 初始化每日计数
function initDailyCount() {
  const today = new Date().toDateString()
  if (dailyResetDate !== today) {
    dailyResetDate = today
    dailyShowCount = 0
    try {
      const saved = wx.getStorageSync('ad_daily_count')
      if (saved && saved.date === today) {
        dailyShowCount = saved.count || 0
      }
    } catch (e) {}
  }
}

function saveDailyCount() {
  try {
    wx.setStorageSync('ad_daily_count', {
      date: dailyResetDate,
      count: dailyShowCount
    })
  } catch (e) {}
}

const COOLDOWN_TIME = 60 * 1000 // 1分钟冷却时间
const MIN_TRIGGER_INTERVAL = 3000 // 最小触发间隔3秒，避免过于频繁
const DEFAULT_MIN_APP_START_TIME = 3000 // 默认：小程序启动后至少3秒才能显示插屏广告
const DAILY_LIMIT = 8 // 每日最多显示 8 次插屏广告

let minAppStartTime = DEFAULT_MIN_APP_START_TIME // 当前生效的启动延迟，可从 admin 配置

/**
 * 初始化插屏广告
 * @param {string} pagePath - 页面路径
 * @returns {Promise<boolean>} 是否初始化成功
 */
async function initInterstitialAd(pagePath) {
  try {

    currentPagePath = pagePath
    
    const list = await fetchPageAds(pagePath)

    
    const adConfig = pickByType(list, 'interstitial')[0]

    
    if (!adConfig) {
  
      return false
    }
    
    if (!adConfig.adUnitId) {
  
      return false
    }
    
    if (!adConfig.isEnable) {
  
      return false
    }
    
    if (!wx.createInterstitialAd) {
  
      return false
    }
    
    // 🔥 从 admin 配置读取启动延迟（startTime 单位秒），覆盖默认 3000ms
    if (adConfig.startTime) {
      const parsed = Number(adConfig.startTime)
      if (!isNaN(parsed) && parsed > 0) {
        minAppStartTime = parsed * 1000  // admin 存秒，这里用毫秒
      } else {
        minAppStartTime = DEFAULT_MIN_APP_START_TIME
      }
    } else {
      minAppStartTime = DEFAULT_MIN_APP_START_TIME
    }
    
    // 销毁之前的广告实例
    if (globalInterstitialAd) {
      try {
        globalInterstitialAd.destroy && globalInterstitialAd.destroy()
      } catch (e) {
  
      }
    }
    

    globalInterstitialAd = wx.createInterstitialAd({ adUnitId: adConfig.adUnitId })
    
    // 绑定事件监听
    globalInterstitialAd.onError && globalInterstitialAd.onError((e) => {
      isAdLoading = false
      interstitialShowing = false
    })
    
    globalInterstitialAd.onLoad && globalInterstitialAd.onLoad(() => {
      isAdLoading = false
    })
    
    globalInterstitialAd.onClose && globalInterstitialAd.onClose(() => {
      // 更新最后显示时间
      lastShowTime = Date.now()
      interstitialShowing = false
      isAdLoading = false
    })
    
    return true
  } catch (e) {
    console.log('[AD][Manager] ❌ 初始化异常:', e)
    isAdLoading = false
    return false
  }
}

/**
 * 检查是否可以显示插屏广告
 * @returns {boolean} 是否可以显示
 */
function canShowInterstitialAd() {
  if (!globalInterstitialAd) {
    return false
  }
  
  if (isAdLoading) {
    return false
  }
  
  if (interstitialShowing) {
    return false
  }
  
  if (externalAdPlaying) {
    return false
  }
  
  const now = Date.now()
  const timeSinceLastShow = now - lastShowTime
  
  if (timeSinceLastShow < COOLDOWN_TIME) {
    return false
  }
  
  const timeSinceAppStart = now - appStartTime
  if (timeSinceAppStart < minAppStartTime) {
    return false
  }
  
  // 🔥 每日次数限制
  initDailyCount()
  if (dailyShowCount >= DAILY_LIMIT) {
    return false
  }
  
  return true
}

/**
 * 显示插屏广告
 * @returns {Promise<boolean>} 是否显示成功
 */
async function showInterstitialAd() {
  if (!canShowInterstitialAd()) {
    return false
  }
  
  try {
    isAdLoading = true
    interstitialShowing = true
    
    await globalInterstitialAd.show()
    
    // 🔥 增加每日计数
    dailyShowCount++
    saveDailyCount()
    
    return true
  } catch (e) {
    isAdLoading = false
    interstitialShowing = false
    return false
  }
}

/**
 * 智能触发插屏广告（带防抖和冷却时间检查）
 * @param {number} delay - 延迟时间（毫秒），默认1000ms
 * @returns {Promise<boolean>} 是否触发成功
 */
function smartTriggerInterstitialAd(delay = 1000) {
  return new Promise((resolve) => {
    // 清除之前的定时器
    if (_triggerTimer) {
      clearTimeout(_triggerTimer)
    }
    
    // 设置新的定时器，实现防抖
    _triggerTimer = setTimeout(async () => {
      const result = await showInterstitialAd()
      resolve(result)
    }, delay)
  })
}

/**
 * 重置冷却时间
 */
function resetCooldown() {
  lastShowTime = 0
}

/**
 * 获取当前状态
 * @returns {Object} 当前状态信息
 */
function getStatus() {
  const now = Date.now()
  const timeSinceLastShow = now - lastShowTime
  const remainingCooldown = Math.max(0, COOLDOWN_TIME - timeSinceLastShow)
  
  return {
    hasAdInstance: !!globalInterstitialAd,
    isLoading: isAdLoading,
    isShowing: interstitialShowing,
    externalAdPlaying,
    lastShowTime,
    remainingCooldown,
    canShow: canShowInterstitialAd(),
    currentPagePath
  }
}

/**
 * 销毁广告实例（页面卸载时调用）
 */
function destroy() {
  if (globalInterstitialAd) {
    try {
      globalInterstitialAd.destroy && globalInterstitialAd.destroy()
    } catch (e) {}
    globalInterstitialAd = null
  }
  
  if (_triggerTimer) {
    clearTimeout(_triggerTimer)
    _triggerTimer = null
  }
  
  lastShowTime = 0
  isAdLoading = false
  currentPagePath = ''
  interstitialShowing = false
  externalAdPlaying = false
  minAppStartTime = DEFAULT_MIN_APP_START_TIME  // 重置为默认值
}

function setExternalAdPlaying(flag) {
  externalAdPlaying = !!flag
}

export default {
  initInterstitialAd,
  showInterstitialAd,
  smartTriggerInterstitialAd,
  canShowInterstitialAd,
  resetCooldown,
  getStatus,
  destroy,
  setExternalAdPlaying
}
