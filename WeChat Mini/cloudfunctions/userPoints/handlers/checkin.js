const {
  db, _, POINTS_CONFIG, formatDate, getBeijingTodayStart, getOrCreateUser, createPointRecord,
  getDownloadConfig, addPoints, recordInviteAction
} = require('../shared')

module.exports = async (event, context) => {
  const { action, openid } = event
  switch (action) {
    case 'checkIn':
      return await checkIn(openid)
    case 'rewardAdWatch':
      return await rewardAdWatch(openid)
    case 'markAdWatched':
      return await markAdWatched(openid)
    default:
      return null
  }
}

async function checkIn(openid) {
  const today = formatDate(new Date())
  const yesterday = formatDate(new Date(Date.now() - 86400000))

  const user = await getOrCreateUser(openid)

  if (user.lastCheckInDate === today) {
    return { success: false, error: '今日已签到' }
  }

  let newCheckInDays = 1
  if (user.lastCheckInDate === yesterday) {
    newCheckInDays = user.checkInDays + 1
  }

  let pointsReward = POINTS_CONFIG.checkInPoints
  let bonusPoints = 0

  if (newCheckInDays === 7) {
    bonusPoints = POINTS_CONFIG.checkInBonus
  } else if (newCheckInDays === 30) {
    bonusPoints = POINTS_CONFIG.checkInMaxBonus
  }

  const totalReward = pointsReward + bonusPoints
  const newPoints = user.points + totalReward
  const newTotalPoints = user.totalPoints + totalReward
  const newTotalCheckInDays = user.totalCheckInDays + 1

  // 🔒 使用条件更新防止并发重复签到：仅当 lastCheckInDate 仍非今日时才更新
  const result = await db.collection('user_points')
    .where({ _id: user._id, lastCheckInDate: _.neq(today) })
    .update({
      data: {
        points: _.inc(totalReward),
        totalPoints: _.inc(totalReward),
        checkInDays: newCheckInDays,
        totalCheckInDays: newTotalCheckInDays,
        lastCheckInDate: today,
        updatedAt: new Date()
      }
    })

  if (result.stats.updated === 0) {
    return { success: false, error: '今日已签到' }
  }

  await createPointRecord(openid, 'checkIn', totalReward, newPoints, `每日签到 +${totalReward}辣度值`, newCheckInDays)

  await recordInviteAction(openid)

  return {
    success: true,
    data: {
      _id: user._id,
      points: newPoints,
      totalPoints: newTotalPoints,
      checkInDays: newCheckInDays,
      totalCheckInDays: newTotalCheckInDays,
      lastCheckInDate: today,
      isCheckedIn: true,
      pointsReward,
      bonusPoints,
      totalReward
    }
  }
}

async function rewardAdWatch(openid) {
  try {
    const dc = await getDownloadConfig()
    const beijingTodayStart = getBeijingTodayStart()
    const limit = dc.dailyAdWatchLimit || POINTS_CONFIG.watchAdDailyLimit || 15
    const reward = dc.pointsPerAdWatch || POINTS_CONFIG.watchAdPoints || 20

    // 查询今日 watchAd 记录次数（按北京时间 0 点为界）
    const countRes = await db.collection('point_records')
      .where({
        _openid: openid,
        type: 'watchAd',
        createdAt: _.gte(beijingTodayStart)
      })
      .count()

    if ((countRes.total || 0) >= limit) {
      return { success: false, error: '今日观看次数已达上限' }
    }

    const addRes = await addPoints(openid, reward, 'watchAd', `观看激励视频 +${reward}辣度值`)
    if (!addRes || !addRes.success) {
      return { success: false, error: addRes?.error || '辣度值发放失败' }
    }

    return {
      success: true,
      data: addRes.data
    }
  } catch (e) {
    console.error('rewardAdWatch 错误:', e)
    return { success: false, error: e.message }
  }
}

async function markAdWatched(openid) {
  try {
    const today = formatDate(new Date())
    const user = await getOrCreateUser(openid)

    await db.collection('user_points').doc(user._id).update({
      data: {
        lastAdWatchedDate: today,
        updatedAt: new Date()
      }
    })

    return { success: true }
  } catch (e) {
    console.error('markAdWatched 错误:', e)
    return { success: false, error: e.message }
  }
}
