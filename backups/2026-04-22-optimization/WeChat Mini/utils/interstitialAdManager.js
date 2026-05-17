import { fetchPageAds, pickByType } from './adUtil.js'

let globalInterstitialAd = null
let lastShowTime = 0
let isAdLoading = false
let currentPagePath = ''
let externalAdPlaying = false
let interstitialShowing = false
let appStartTime = Date.now() // 记录小程序启动时间
let _triggerTimer = null

const COOLDOWN_TIME = 60 * 1000 // 1分钟冷却时间
const MIN_TRIGGER_INTERVAL = 3000 // 最小触发间隔3秒，避免过于频繁
const MIN_APP_START_TIME = 3000 // 小程序启动后至少3秒才能显示插屏广告

/**
 * 初始化插屏广告
 * @param {string} pagePath - 页面路径
 * @returns {Promise<boolean>} 是否初始化成功
 */
async function initInterstitialAd(pagePath) {
  try {
    console.log('[AD][Manager] 🔄 开始初始化插屏广告...')
    currentPagePath = pagePath
    
    const list = await fetchPageAds(pagePath)
    console.log('[AD][Manager] fetchPageAds结果:', list)
    
    const adConfig = pickByType(list, 'interstitial')[0]
    console.log('[AD][Manager] 插屏广告配置:', adConfig)
    
    if (!adConfig) {
      console.log('[AD][Manager] ❌ 未找到插屏广告配置')
      return false
    }
    
    if (!adConfig.adUnitId) {
      console.log('[AD][Manager] ❌ 配置中缺少adUnitId')
      return false
    }
    
    if (!adConfig.isEnable) {
      console.log('[AD][Manager] ❌ 插屏广告配置被禁用')
      return false
    }
    
    if (!wx.createInterstitialAd) {
      console.log('[AD][Manager] ❌ 当前基础库版本不支持插屏广告')
      console.log('[AD][Manager] 💡 建议基础库版本 >= 2.6.0')
      return false
    }
    
    // 销毁之前的广告实例
    if (globalInterstitialAd) {
      try {
        globalInterstitialAd.destroy && globalInterstitialAd.destroy()
      } catch (e) {
        console.log('[AD][Manager] 销毁旧广告实例失败:', e)
      }
    }
    
    console.log('[AD][Manager] ✅ 创建插屏广告实例，adUnitId:', adConfig.adUnitId)
    globalInterstitialAd = wx.createInterstitialAd({ adUnitId: adConfig.adUnitId })
    
    // 绑定事件监听
    globalInterstitialAd.onError && globalInterstitialAd.onError((e) => {
      console.log('[AD][Manager] ❌ 广告错误:', e)
      console.log('[AD][Manager] 💡 错误码:', e.errCode, '错误信息:', e.errMsg)
      isAdLoading = false
      interstitialShowing = false
    })
    
    globalInterstitialAd.onLoad && globalInterstitialAd.onLoad(() => {
      console.log('[AD][Manager] ✅ 广告加载成功')
      isAdLoading = false
    })
    
    globalInterstitialAd.onClose && globalInterstitialAd.onClose(() => {
      console.log('[AD][Manager] ✅ 广告关闭')
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
    console.log('[AD][Manager] ❌ 插屏广告实例不存在')
    return false
  }
  
  if (isAdLoading) {
    console.log('[AD][Manager] ❌ 广告正在加载中')
    return false
  }
  
  if (interstitialShowing) {
    console.log('[AD][Manager] ❌ 插屏广告正在展示中')
    return false
  }
  
  if (externalAdPlaying) {
    console.log('[AD][Manager] ❌ 其他广告正在播放，跳过插屏展示')
    return false
  }
  
  const now = Date.now()
  const timeSinceLastShow = now - lastShowTime
  
  if (timeSinceLastShow < COOLDOWN_TIME) {
    const remainingTime = Math.ceil((COOLDOWN_TIME - timeSinceLastShow) / 1000)
    console.log(`[AD][Manager] ❌ 冷却时间未结束，还需等待 ${remainingTime} 秒`)
    return false
  }
  
  const timeSinceAppStart = now - appStartTime
  if (timeSinceAppStart < MIN_APP_START_TIME) {
    console.log('[AD][Manager] ❌ 小程序启动时间过短，跳过展示')
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
    console.log('[AD][Manager] ✅ 开始显示插屏广告')
    isAdLoading = true
    interstitialShowing = true
    
    await globalInterstitialAd.show()
    
    console.log('[AD][Manager] ✅ 插屏广告显示成功')
    return true
  } catch (e) {
    console.log('[AD][Manager] ❌ 插屏广告显示失败:', e)
    console.log('[AD][Manager] 💡 错误码:', e.errCode, '错误信息:', e.errMsg)
    
    if (e.errCode === 1000) {
      console.log('[AD][Manager] 💡 错误1000：当前场景不适合展示插屏广告')
    } else if (e.errCode === 1004) {
      console.log('[AD][Manager] 💡 错误1004：广告单元ID无效或广告位类型不匹配')
    } else if (e.errCode === 1005) {
      console.log('[AD][Manager] 💡 错误1005：广告被屏蔽或限制')
    } else if (e.errCode === 2003) {
      console.log('[AD][Manager] ℹ️ 检测到其他广告正在播放，延后由外部触发')
    }
    
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
  console.log('[AD][Manager] 🔄 冷却时间已重置')
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
      console.log('[AD][Manager] 🗑️ 广告实例已销毁')
    } catch (e) {
      console.log('[AD][Manager] 销毁广告实例失败:', e)
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
