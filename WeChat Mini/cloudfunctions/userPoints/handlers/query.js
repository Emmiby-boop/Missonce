const {
  db, POINTS_CONFIG, formatDate, checkMemberStatus,
  getDownloadConfig, addPoints
} = require('../shared')

module.exports = async (event, context) => {
  const { action, openid } = event
  switch (action) {
    case 'getUserInfo':
      return await getUserInfo(openid)
    case 'getRecords':
      return await getRecords(openid, event.page || 1, event.limit || 20)
    case 'getConfigs':
      return await getConfigs()
    case 'addPoints': {
      // 🔒 仅限服务端调用（管理员或云函数互调）
      // 客户端禁止直接调用 addPoints，辣度值只能通过签到/广告/分享等行为获得
      if (!event.fromServer) {
        return { success: false, error: '禁止客户端直接调用此接口' }
      }
      return await addPoints(openid, event.amount, event.type, event.description)
    }
    default:
      return null
  }
}

async function getUserInfo(openid) {
  try {
    const userRes = await db.collection('user_points').where({ _openid: openid }).limit(1).get()

    if (userRes.data.length === 0) {
      return {
        success: true,
        data: {
          points: 0,
          totalPoints: 0,
          checkInDays: 0,
          totalCheckInDays: 0,
          lastCheckInDate: '',
          isCheckedIn: false,
          memberLevel: 'none',
          memberExpireDate: null
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
        points: 0,
        totalPoints: 0,
        checkInDays: 0,
        totalCheckInDays: 0,
        isCheckedIn: false,
        memberLevel: 'none',
        memberExpireDate: null,
        isMember: false
      }
    }
  }
}

async function getRecords(openid, page, limit) {
  try {
    const skip = (page - 1) * limit

    const res = await db.collection('point_records')
      .where({ _openid: openid })
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(limit)
      .get()

    return {
      success: true,
      data: res.data,
      hasMore: res.data.length === limit
    }
  } catch (e) {
    console.error('getRecords 错误:', e)
    return { success: true, data: [], hasMore: false }
  }
}

async function getConfigs() {
  const dc = await getDownloadConfig()
  return {
    success: true,
    data: { ...POINTS_CONFIG, ...dc }
  }
}
