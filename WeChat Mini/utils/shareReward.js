/**
 * 分享奖励工具
 * 在 onShareAppMessage 成功后调用，发放分享积分
 */

let _lastShareTime = 0
const SHARE_COOLDOWN = 3000 // 3秒内不重复触发

/**
 * 记录分享并获取积分奖励
 * @returns {Promise<object|null>} 奖励结果，失败返回 null
 */
export async function recordShareReward() {
  const now = Date.now()
  if (now - _lastShareTime < SHARE_COOLDOWN) {
    return null
  }
  _lastShareTime = now
  
  try {
    const res = await wx.cloud.callFunction({
      name: 'userPoints',
      data: { action: 'recordShare' }
    })
    
    if (res.result && res.result.success) {
      const { points, totalPoints, todayCount, dailyLimit } = res.result
      wx.showToast({
        title: `分享成功 +${points}积分`,
        icon: 'success'
      })
      return { points, totalPoints, todayCount, dailyLimit }
    } else if (res.result && res.result.error) {
      // 次数用完时不提示错误，静默失败
      console.log('[Share]', res.result.error)
    }
  } catch (e) {
    console.error('[Share] 记录分享失败:', e)
  }
  return null
}

/**
 * 获取今日分享状态
 * @returns {Promise<object>} 分享状态
 */
export async function getShareStatus() {
  try {
    const res = await wx.cloud.callFunction({
      name: 'userPoints',
      data: { action: 'getShareStatus' }
    })
    
    if (res.result && res.result.success) {
      return res.result
    }
  } catch (e) {
    console.error('[Share] 获取分享状态失败:', e)
  }
  return { todayCount: 0, dailyLimit: 5, canShare: true, pointsPerShare: 10 }
}

export default { recordShareReward, getShareStatus }
