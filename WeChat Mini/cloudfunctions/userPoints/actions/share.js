const { db, _, POINTS_CONFIG, formatDate, createPointRecord, getOrCreateUser } = require('../shared')

/**
 * 记录分享并发放积分
 * @param {string} openid - 用户openid
 * @param {object} event - 事件参数
 * @returns {Promise<object>} 结果
 */
async function recordShare(openid, event = {}) {
  const user = await getOrCreateUser(openid)
  
  // 检查今日分享次数
  const today = formatDate(new Date())
  const shareCountRes = await db.collection('share_records')
    .where({
      _openid: openid,
      date: today
    })
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
    data: {
      _openid: openid,
      date: today,
      createdAt: new Date()
    }
  })
  
  // 发放积分
  const points = POINTS_CONFIG.sharePoints
  const totalPoints = (user.points || 0) + points
  
  await db.collection('users').doc(openid).update({
    data: {
      points: totalPoints,
      totalPoints: _.inc(points),
      updatedAt: new Date()
    }
  })
  
  // 记录积分流水
  await createPointRecord(openid, {
    type: 'earn',
    amount: points,
    source: 'share',
    description: '分享获得积分'
  })
  
  return {
    success: true,
    points: points,
    totalPoints: totalPoints,
    todayCount: shareCountRes.total + 1,
    dailyLimit: POINTS_CONFIG.shareDailyLimit
  }
}

/**
 * 获取今日分享状态
 * @param {string} openid - 用户openid
 * @returns {Promise<object>} 分享状态
 */
async function getShareStatus(openid) {
  const today = formatDate(new Date())
  const shareCountRes = await db.collection('share_records')
    .where({
      _openid: openid,
      date: today
    })
    .count()
  
  return {
    success: true,
    todayCount: shareCountRes.total,
    dailyLimit: POINTS_CONFIG.shareDailyLimit,
    canShare: shareCountRes.total < POINTS_CONFIG.shareDailyLimit,
    pointsPerShare: POINTS_CONFIG.sharePoints
  }
}

module.exports = { recordShare, getShareStatus }
