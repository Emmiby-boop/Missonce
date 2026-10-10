import { fetchPageAds, pickByType } from './adUtil.js'
import logger from './logger'
import { getStorage, setStorage } from './storageManager.js'
import { isAdFree } from './memberAdFree.js'

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
let _dailyCountLoading = false // 防止异步加载重复触发

// 🔥 P0 性能优化：跨天首发用内存缓存优先，未命中时异步读取 storage（避免 getStorageSync 阻塞 JS 线程）
function initDailyCount() {
  const today = new Date().toDateString()
  if (dailyResetDate !== today) {
    dailyResetDate = today
    dailyShowCount = 0
    // 优先从内存缓存读取（storageManager 已通过异步预热加载到内存）
    const saved = getStorage('ad_daily_count')
    if (saved && saved.date === today) {
      dailyShowCount = saved.count || 0
      return
    }
    // 内存未命中：异步读取 storage（不阻塞 JS 线程），完成后回填
    if (_dailyCountLoading) return
    _dailyCountLoading = true
    wx.getStorage({
      key: 'ad_daily_count',
      success: (res) => {
        const saved = res.data
        if (saved && saved.date === today) {
          // 防止跨天异步读取期间用户已触发广告，取较大值
          dailyShowCount = Math.max(dailyShowCount, saved.count || 0)
        }
      },
      fail: () => {},
      complete: () => { _dailyCountLoading = false }
    })
  }
}

function saveDailyCount() {
  // 🔥 使用 storageManager 异步写入（已带内存缓存同步更新），避免 setStorageSync 阻塞
  setStorage('ad_daily_count', {
    date: dailyResetDate,
    count: dailyShowCount
  })
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
    // 🔥 会员免插屏：直接不初始化，省掉广告请求与实例创建
    if (isAdFree()) {
      return false
    }

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
        console.error('[interstitialAdManager] 销毁广告实例失败:', e)
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
    logger.warn('createInterstitialAd 创建失败', e)
    isAdLoading = false
    return false
  }
}

/**
 * 是否可以显示插屏广告
 * @returns {boolean} 是否可以显示
 */
function canShowInterstitialAd() {
  // 🔥 会员免插屏：闸门放在最前面，连广告实例都不用建
  if (isAdFree()) {
    return false
  }

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
    logger.warn('showInterstitialAd 展示失败', e)
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
    } catch (e) {
      console.error('[interstitialAdManager] 销毁广告实例失败:', e)
    }
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
