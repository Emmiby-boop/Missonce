const { db, formatDate, checkMemberStatus, getOrCreateUser } = require('../shared')

async function getUserInfo(openid) {
  try {
    const userRes = await db.collection('user_points').where({ _openid: openid }).limit(1).get()

    if (userRes.data.length === 0) {
      return {
        success: true,
        data: {
          points: 0, totalPoints: 0, checkInDays: 0, totalCheckInDays: 0,
          lastCheckInDate: '', isCheckedIn: false, memberLevel: 'none', memberExpireDate: null
        }
      }
    }

    const user = userRes.data[0]
    const today = formatDate(new Date())
    const yesterday = formatDate(new Date(Date.now() - 86400000))
    const isCheckedIn = user.lastCheckInDate === today

    let finalCheckInDays = user.checkInDays
    let needUpdate = false

    if (user.lastCheckInDate && user.lastCheckInDate !== today && user.lastCheckInDate !== yesterday) {
      finalCheckInDays = 0
      needUpdate = true
    }

    if (needUpdate) {
      await db.collection('user_points').doc(user._id).update({
        data: { checkInDays: finalCheckInDays, updatedAt: new Date() }
      })
    }

    const memberStatus = checkMemberStatus(user)

    return {
      success: true,
      data: {
        ...user,
        isCheckedIn,
        checkInDays: finalCheckInDays,
        memberLevel: memberStatus.level,
        memberExpireDate: memberStatus.expireDate,
        isMember: memberStatus.isValid
      }
    }
  } catch (e) {
    console.error('getUserInfo 错误:', e)
    return {
      success: true,
      data: {
        points: 0, totalPoints: 0, checkInDays: 0,
        isCheckedIn: false, memberLevel: 'none', memberExpireDate: null, isMember: false
      }
    }
  }
}

async function getConfigs() {
  const { POINTS_CONFIG } = require('../shared')
  return { success: true, data: POINTS_CONFIG }
}

module.exports = { getUserInfo, getConfigs }
