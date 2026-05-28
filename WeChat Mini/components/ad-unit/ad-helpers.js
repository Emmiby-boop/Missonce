import { getAppBaseInfo, getWindowInfo } from '../../utils/storageManager.js'

export const NAV_BAR_HEIGHT = 44
export const STATUS_BAR_HEIGHT = 20
const COOLDOWN_TIME = 60 * 1000
const MIN_TRIGGER_INTERVAL = 3000
const MIN_APP_START_TIME = 3000

export const AD_CONSTANTS = {
  COOLDOWN_TIME,
  MIN_TRIGGER_INTERVAL,
  MIN_APP_START_TIME,
  DEFAULT_INTERVALS: 60,
  DEFAULT_THRESHOLD: 200,
  DEFAULT_LAZY_DELAY: 300
}

export function getNavBarDimensions() {
  const windowInfo = getWindowInfo()
  const appBaseInfo = getAppBaseInfo()
  return {
    statusBarHeight: windowInfo.statusBarHeight || STATUS_BAR_HEIGHT,
    navBarHeight: (appBaseInfo.theme === 'dark' ? 44 : 44)
  }
}

/**
 * Helper: initialize native ad
 */
export function initNativeAd(component, adConfig) {
  if (!adConfig || !adConfig.adUnitId || !adConfig.isEnable) return false
  // Component handles the actual initialization
  return true
}

/**
 * Helper: create rewarded video ad
 */
export function createRewardedVideoAd(adUnitId) {
  if (!adUnitId || !wx.createRewardedVideoAd) return null
  return wx.createRewardedVideoAd({ adUnitId })
}

/**
 * Helper: timeout cleanup
 */
export function clearAllTimers(component) {
  ;['_autoShowTimer', '_showRaceCheck', '_hideAdTimer', '_lazyInitTimer'].forEach(key => {
    if (component[key]) {
      clearTimeout(component[key])
      component[key] = null
    }
  })
}
