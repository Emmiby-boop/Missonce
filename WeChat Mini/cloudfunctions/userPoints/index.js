const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { action } = event
  const openid = cloud.getWXContext().OPENID

  if (!openid) {
    return { success: false, error: '用户未登录' }
  }

  try {
    switch (action) {
      case 'getUserInfo':
        return await getUserInfo(openid)
      case 'checkIn':
        return await checkIn(openid)
      case 'deductPoints':
        return await deductPoints(openid, event.amount, event.description)
      case 'addPoints':
        return await addPoints(openid, event.amount, event.type, event.description)
      case 'getRecords':
        return await getRecords(openid, event.page || 1, event.limit || 20)
      default:
        return { success: false, error: '无效的 action' }
    }
  } catch (e) {
    console.error('云函数执行失败:', e)
    return { success: false, error: e.message }
  }
}

async function getUserInfo(openid) {
  try {
    const userRes = await db.collection('user_points').where({ _openid: openid }).get()
    
    if (userRes.data.length === 0) {
      return {
        success: true,
        data: {
          points: 0,
          totalPoints: 0,
          checkInDays: 0,
          totalCheckInDays: 0,
          lastCheckInDate: '',
          isCheckedIn: false
        }
      }
    }

    const user = userRes.data[0]
    const today = formatDate(new Date())
    const isCheckedIn = user.lastCheckInDate === today

    return {
      success: true,
      data: {
        ...user,
        isCheckedIn
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
        isCheckedIn: false
      }
    }
  }
}

async function checkIn(openid) {
  const today = formatDate(new Date())
  const yesterday = formatDate(new Date(Date.now() - 86400000))
  
  let userRes = await db.collection('user_points').where({ _openid: openid }).get()
  let user
  let isNewUser = false
  
  if (userRes.data.length === 0) {
    isNewUser = true
    const now = new Date()
    user = {
      _openid: openid,
      points: 0,
      totalPoints: 0,
      checkInDays: 0,
      totalCheckInDays: 0,
      lastCheckInDate: '',
      createdAt: now,
      updatedAt: now
    }
    const addRes = await db.collection('user_points').add({ data: user })
    user._id = addRes._id
  } else {
    user = userRes.data[0]
  }

  if (user.lastCheckInDate === today) {
    return { success: false, error: '今日已签到' }
  }

  let newCheckInDays = 1
  if (user.lastCheckInDate === yesterday) {
    newCheckInDays = user.checkInDays + 1
  }

  let pointsReward = 10
  let bonusPoints = 0
  
  if (newCheckInDays === 7) {
    bonusPoints = 30
  } else if (newCheckInDays === 30) {
    bonusPoints = 100
  }

  const totalReward = pointsReward + bonusPoints
  const newPoints = user.points + totalReward
  const newTotalPoints = user.totalPoints + totalReward
  const newTotalCheckInDays = user.totalCheckInDays + 1

  await db.collection('user_points').doc(user._id).update({
    data: {
      points: newPoints,
      totalPoints: newTotalPoints,
      checkInDays: newCheckInDays,
      totalCheckInDays: newTotalCheckInDays,
      lastCheckInDate: today,
      updatedAt: new Date()
    }
  })

  try {
    await db.collection('point_records').add({
      data: {
        _openid: openid,
        type: 'checkIn',
        amount: totalReward,
        balance: newPoints,
        description: `每日签到 +${totalReward}积分`,
        checkInDays: newCheckInDays,
        createdAt: new Date()
      }
    })
  } catch (e) {
    console.error('创建积分记录失败:', e)
  }
  
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

async function addPoints(openid, amount, type, description) {
  return { success: true }
}

async function deductPoints(openid, amount, description) {
  return { success: true }
}

async function getRecords(openid, page, limit) {
  try {
    const skip = (page - 1) * limit
    
    let res = await db.collection('point_records')
      .where({ _openid: openid })
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(limit)
      .get()

    if (res.data.length === 0) {
      res = await db.collection('point_records')
        .orderBy('createdAt', 'desc')
        .skip(skip)
        .limit(limit)
        .get()
    }

    return {
      success: true,
      data: res.data,
      hasMore: res.data.length === limit
    }
  } catch (e) {
    console.error('getRecords 错误:', e)
    return {
      success: true,
      data: [],
      hasMore: false
    }
  }
}

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
