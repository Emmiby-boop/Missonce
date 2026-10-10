/**
 * 会员免广告总闸门
 *
 * ⚠️ 背景（踩过的坑）：
 *   - 「下载免广告」是在**云函数 userPoints / download** 里返回 `canFreeDownload` 实现的，
 *     属于业务接口层面的判断。
 *   - 但**插屏广告 / 激励视频是前端 `interstitialAdManager` / `ad-unit` 组件直接弹的**，
 *     完全不经过云函数，所以早期版本里会员开通了照样弹插屏。
 *   - 现在统一由本模块提供 `isAdFree()` 判断，各广告入口自行拦截。
 *
 * 性能设计：
 *   - 会员状态读**内存缓存**优先（判断是同步的，不能 await 云函数）
 *   - 内存未命中时读 storage（storageManager 已预热，也是内存读）
 *   - `refresh()` 异步拉一次云函数，回填内存 + storage，供下次判定
 *   - 最坏情况（storage 也没命中）默认**非会员**→ 照常弹广告，行为跟现在一致，不会漏弹
 *
 * 开通会员成功后请调用 `setMember(true)` 立即生效，无需等下次冷启动。
 */

import { getStorage, setStorage } from './storageManager.js'

const STORAGE_KEY = 'member_ad_free'
// 兜底过期时间：storage 里超过这个时长视为不可信，重新拉取
const MAX_AGE = 24 * 60 * 60 * 1000 // 24 小时

let _cache = null // { isMember, expireAt }

/**
 * 是否会员免广告（同步，无阻塞）
 * @returns {boolean}
 */
export function isAdFree() {
  if (_cache && _cache.isMember) return true

  const saved = getStorage(STORAGE_KEY)
  if (saved && typeof saved.isMember === 'boolean' && saved.ts) {
    const fresh = Date.now() - saved.ts < MAX_AGE
    if (fresh) {
      _cache = { isMember: saved.isMember, expireAt: saved.ts + MAX_AGE }
      return !!saved.isMember
    }
  }
  return false
}

/**
 * 写入会员状态（同步，立即生效）
 * @param {boolean} isMember
 */
export function setMember(isMember) {
  const v = !!isMember
  _cache = { isMember: v, expireAt: Date.now() + MAX_AGE }
  setStorage(STORAGE_KEY, { isMember: v, ts: Date.now() })
}

/**
 * 从云函数拉取最新会员状态（异步，非阻塞）。
 * 供 app 启动 / 关键页面 onShow 调用一次即可，不要在渲染路径里调。
 * @returns {Promise<boolean>} 是否会员
 */
export async function refresh() {
  try {
    const res = await wx.cloud.callFunction({
      name: 'userPoints',
      data: { action: 'getMemberStatus' }
    })
    const data = res && res.result && res.result.success ? res.result.data : null
    setMember(!!(data && data.isMember))
    return !!(data && data.isMember)
  } catch (e) {
    // 云函数异常时保持现状（照常弹广告），不阻塞页面
    return isAdFree()
  }
}

/**
 * 会员开通成功后调用：立即关闸，不必等下次 refresh
 */
export function grantMember() {
  setMember(true)
}

/**
 * 仅供调试 / 会员过期后手动清缓存
 */
export function reset() {
  _cache = null
  setStorage(STORAGE_KEY, { isMember: false, ts: 0 })
}

export default {
  isAdFree,
  setMember,
  refresh,
  grantMember,
  reset
}
