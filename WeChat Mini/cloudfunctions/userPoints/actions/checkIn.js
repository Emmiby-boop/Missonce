const { db, _, POINTS_CONFIG, formatDate, createPointRecord, getOrCreateUser } = require('../shared')

async function checkIn(openid) {
  const today = formatDate(new Date())
  const yesterday = formatDate(new Date(Date.now() - 86400000))

  let user = await getOrCreateUser(openid)

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

  await db.collection('user_points').doc(user._id).update({
    data: {
      points: _.inc(totalReward),
      totalPoints: _.inc(totalReward),
      checkInDays: newCheckInDays,
      totalCheckInDays: newTotalCheckInDays,
      lastCheckInDate: today,
      updatedAt: new Date()
    }
  })

  await createPointRecord(openid, 'checkIn', totalReward, newPoints, `每日签到 +${totalReward}积分`, newCheckInDays)

  // 异步记录邀请动作
  const { recordInviteAction } = require('./invite')
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

module.exports = { checkIn }
