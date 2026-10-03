/**
 * 统一触感反馈（震动）工具
 *
 * 设计要点：
 * 1. 全局开关：storage key `hapticEnabled`，默认开启，用户可在「我的」页关闭
 * 2. 节流：默认 300ms 内不重复触发，避免高频调用耗电 / 手感发麻
 * 3. 连击增强：单次 vibrateShort 在 Android 上固定 15ms，感知很弱；
 *    按场景在 80ms 间隔内连发 2~3 次，显著增强手感
 *    （iOS 上限 2 次，再多会被系统合并成一段糊震）
 * 4. 兼容：type（heavy/medium/light）需基础库 2.13.0+，旧版本退化为普通短震
 * 5. 平台：iOS 仅 iPhone 7 及以上生效；Android 全支持但 type 无效，靠连击补强
 *
 * 用法：
 *   import { hapticTap, hapticSuccess } from '../../utils/haptic'
 *   hapticTap()      // 点击
 *   hapticSuccess()  // 操作成功
 */

const STORAGE_KEY = 'hapticEnabled'
const DEFAULT_THROTTLE = 300
/** 连击间隔：80ms 是 iOS 上能被识别为两次震动的最小安全间隔 */
const BURST_GAP = 80

let lastTriggerAt = 0
let enabledCache = null
let platformCache = ''

/** 当前基础库是否支持震动分级（heavy / medium / light，2.13.0+） */
const canUseType = () =>
  typeof wx !== 'undefined' && typeof wx.canIUse === 'function' && wx.canIUse('vibrateShort.type')

/** 是否 iOS：iOS 上 type 分级有效，Android 上 type 无效（统一 15ms），需靠连击 */
const isIOS = () => {
  if (platformCache) return platformCache === 'ios'
  try {
    const info =
      typeof wx.getDeviceInfo === 'function' ? wx.getDeviceInfo() : wx.getSystemInfoSync()
    const raw = String(info.platform || info.system || '').toLowerCase()
    platformCache = raw.indexOf('ios') >= 0 ? 'ios' : 'other'
  } catch (e) {
    platformCache = 'other'
  }
  return platformCache === 'ios'
}

/** 读取开关（带缓存，避免每次读 storage） */
export const isHapticEnabled = () => {
  if (enabledCache !== null) return enabledCache
  try {
    const raw = wx.getStorageSync(STORAGE_KEY)
    // 从未设置过（空字符串/undefined）视为开启
    enabledCache = raw === '' || raw === undefined || raw === null ? true : !!raw
  } catch (e) {
    enabledCache = true
  }
  return enabledCache
}

/** 设置开关并持久化 */
export const setHapticEnabled = (enabled) => {
  enabledCache = !!enabled
  try {
    wx.setStorageSync(STORAGE_KEY, enabledCache)
  } catch (e) {
    // 存储失败不影响本次会话内的开关状态
  }
  return enabledCache
}

/**
 * 场景强度表：[type, 连击次数]
 * 要调整整体手感，只改这张表即可，业务层无需改动
 */
const SCENE_PROFILES = {
  tap: ['heavy', 2],
  select: ['heavy', 2],
  success: ['heavy', 3],
  cancel: ['medium', 1],
  longPress: ['heavy', 3],
  refresh: ['heavy', 2]
}

/** 真正发出一次短震 */
const fire = (type) => {
  try {
    if (canUseType()) {
      wx.vibrateShort({ type, fail: () => {} })
    } else {
      wx.vibrateShort({ fail: () => {} })
    }
    return true
  } catch (e) {
    return false
  }
}

/** 按平台裁剪连击次数 */
const normalizeBurst = (burst) => {
  // 不支持分级的基础库，连击行为不稳定，保守只发一次
  if (!canUseType()) return 1
  // iOS 上连击过多会被系统合并，上限 2 次
  if (isIOS()) return Math.min(burst, 2)
  return Math.max(burst, 1)
}

/**
 * 触发一次短震
 * @param {'heavy'|'medium'|'light'} type 震动强度，默认 medium
 * @param {number} throttle 节流毫秒数，传 0 表示不节流
 * @returns {boolean} 是否真实触发
 */
export const vibrate = (type = 'medium', throttle = DEFAULT_THROTTLE) => {
  if (!isHapticEnabled()) return false
  if (typeof wx === 'undefined' || typeof wx.vibrateShort !== 'function') return false

  const now = Date.now()
  if (throttle > 0 && now - lastTriggerAt < throttle) return false
  lastTriggerAt = now

  return fire(type)
}

/** 长震（400ms），用于重要节点如生成完成 */
export const vibrateLong = () => {
  if (!isHapticEnabled()) return false
  if (typeof wx === 'undefined' || typeof wx.vibrateLong !== 'function') return false
  const now = Date.now()
  if (now - lastTriggerAt < DEFAULT_THROTTLE) return false
  lastTriggerAt = now
  try {
    wx.vibrateLong({ fail: () => {} })
    return true
  } catch (e) {
    return false
  }
}

/**
 * 按场景触发震动
 * @param {keyof SCENE_PROFILES} scene 场景 key
 */
const triggerScene = (scene) => {
  if (!isHapticEnabled()) return false
  if (typeof wx === 'undefined' || typeof wx.vibrateShort !== 'function') return false

  const now = Date.now()
  if (now - lastTriggerAt < DEFAULT_THROTTLE) return false
  lastTriggerAt = now

  const entry = SCENE_PROFILES[scene] || ['medium', 1]
  const type = entry[0]
  const burst = normalizeBurst(entry[1])

  fire(type)
  for (let i = 1; i < burst; i++) {
    setTimeout(() => fire(type), BURST_GAP * i)
  }
  return true
}

// ---------- 语义化封装：业务层优先用这些，别直接调 vibrate ----------

/** 普通按钮点击 */
export const hapticTap = () => triggerScene('tap')

/** tabBar 切换 */
export const hapticSelect = () => triggerScene('select')

/** 操作成功（收藏、点赞、下载完成等） */
export const hapticSuccess = () => triggerScene('success')

/** 取消操作（取消收藏、取消点赞）比成功更轻 */
export const hapticCancel = () => triggerScene('cancel')

/** 长按 / 拖拽开始 */
export const hapticLongPress = () => triggerScene('longPress')

/** 刷新完成 */
export const hapticRefresh = () => triggerScene('refresh')

export default vibrate
