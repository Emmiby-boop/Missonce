const { db, _, POINTS_CONFIG, formatDate } = require('../shared')

module.exports = async (event, context) => {
  const { action, openid } = event
  switch (action) {
    case 'recordShare':
      return await recordShare(openid)
    case 'getShareStatus':
      return await getShareStatus(openid)
    default:
      return null
  }
}

// ============================================================
// 分享奖励功能
// ============================================================

async function recordShare(openid) {
  try {
    const today = formatDate(new Date())

    // 检查今日分享次数
    const shareCountRes = await db.collection('share_records')
      .where({ _openid: openid, date: today })
      .count()

    if (shareCountRes.total >= POINTS_CONFIG.shareDailyLimit) {
      return {
        success: false,
        error: `今日分享次数已用完（每日${POINTS_CONFIG.shareDailyLimit}次）`,
        todayCount: shareCountRes.total,
        dailyLimit: POINTS_CONFIG.shareDailyLimit
      }
    }

    // 记录分享
    await db.collection('share_records').add({
      data: { _openid: openid, date: today, createdAt: new Date() }
    })

    // 发放辣度值（原子递增，防止并发竞态）
    const points = POINTS_CONFIG.sharePoints
    const userRes = await db.collection('user_points').where({ _openid: openid }).limit(1).get()
    const user = userRes.data[0]

    await db.collection('user_points').doc(user._id).update({
      data: { points: _.inc(points), totalPoints: _.inc(points), updatedAt: new Date() }
    })

    // 记录辣度值流水
    try {
      await db.collection('point_records').add({
        data: {
          _openid: openid,
          type: 'share',
          amount: points,
          balance: (user.points || 0) + points,
          description: `分享好友 +${points}辣度值`,
          createdAt: new Date()
        }
      })
    } catch (e) {
      console.error('[share] 记录辣度值流水失败:', e)
    }

    return { success: true, points, todayCount: shareCountRes.total + 1, dailyLimit: POINTS_CONFIG.shareDailyLimit }
  } catch (e) {
    console.error('recordShare 错误:', e)
    return { success: false, error: e.message }
  }
}

async function getShareStatus(openid) {
  try {
    const today = formatDate(new Date())
    const shareCountRes = await db.collection('share_records')
      .where({ _openid: openid, date: today })
      .count()

    return {
      success: true,
      todayCount: shareCountRes.total,
      dailyLimit: POINTS_CONFIG.shareDailyLimit,
      canShare: shareCountRes.total < POINTS_CONFIG.shareDailyLimit,
      pointsPerShare: POINTS_CONFIG.sharePoints
    }
  } catch (e) {
    console.error('getShareStatus 错误:', e)
    return { success: false, error: e.message }
  }
}
