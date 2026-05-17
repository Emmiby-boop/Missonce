const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const MEMBER_CONFIG = {
  weekly: { name: '周卡会员', days: 7, dailyDownloads: Infinity },
  monthly: { name: '月卡会员', days: 30, dailyDownloads: Infinity },
  quarterly: { name: '季卡会员', days: 90, dailyDownloads: Infinity },
  yearly: { name: '年卡会员', days: 365, dailyDownloads: Infinity },
  lifetime: { name: '终身会员', days: null, dailyDownloads: Infinity }
}

const POINTS_CONFIG = {
  checkInPoints: 10,
  checkInBonus: 30,
  checkInMaxBonus: 100,
  sharePoints: 10,
  shareDailyLimit: 5,
  inviteRewardPoints: 50,
  inviteDailyLimit: 5,
  downloadPoints: 6,
  dailyFreeDownload: 1,
  watchAdPoints: 20,
  watchAdDailyLimit: 15,
  memberWeeklyPoints: 500,
  memberMonthlyPoints: 1800,
  memberQuarterlyPoints: 4800,
  memberYearlyPoints: 16800,
  memberLifetimePoints: 50000,
  singleDownloadPoints: 6,
  threeDownloadPoints: 15,
  tenDownloadPoints: 45
}

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
        return await deductPoints(openid, event.amount, event.type, event.description)
      case 'addPoints':
        return await addPoints(openid, event.amount, event.type, event.description)
      case 'getRecords':
        return await getRecords(openid, event.page || 1, event.limit || 20)
      case 'exchangeMember':
        return await exchangeMember(openid, event.level)
      case 'getMemberStatus':
        return await getMemberStatus(openid)
      case 'recordDownload':
        return await recordDownload(openid, event.resourceId, event.resourceType, event.downloadMethod)
      case 'getConfigs':
        return await getConfigs()
      case 'getDownloadStatus':
        return await getDownloadStatus(openid)
      case 'canDownload':
        return await canDownload(openid)
      case 'getInviteStatus':
        return await getInviteStatus(openid)
      case 'bindInviter':
        return await bindInviter(openid, event.inviterOpenid)
      case 'getInviteRecords':
        return await getInviteRecords(openid)
      case 'exchangeDownloads':
        return await exchangeDownloads(openid, event.count)
      case 'getExchangeOptions':
        return await getExchangeOptions()
      case 'rewardAdWatch':
        return await rewardAdWatch(openid)
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

function checkMemberStatus(user) {
  const level = user.memberLevel || 'none'
  const expireDate = user.memberExpireDate ? new Date(user.memberExpireDate) : null
  const now = new Date()

  let isValid = false

  if (level !== 'none' && expireDate) {
    if (level === 'lifetime') {
      isValid = true
    } else if (expireDate > now) {
      isValid = true
    }
  }

  return {
    level,
    expireDate: expireDate ? expireDate.toISOString() : null,
    isValid
  }
}

async function checkIn(openid) {
  const today = formatDate(new Date())
  const yesterday = formatDate(new Date(Date.now() - 86400000))

  let userRes = await db.collection('user_points').where({ _openid: openid }).get()
  let user

  if (userRes.data.length === 0) {
    const now = new Date()
    user = {
      _openid: openid,
      points: 0,
      totalPoints: 0,
      checkInDays: 0,
      totalCheckInDays: 0,
      lastCheckInDate: '',
      memberLevel: 'none',
      memberExpireDate: null,
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
      points: newPoints,
      totalPoints: newTotalPoints,
      checkInDays: newCheckInDays,
      totalCheckInDays: newTotalCheckInDays,
      lastCheckInDate: today,
      updatedAt: new Date()
    }
  })

  await createPointRecord(openid, 'checkIn', totalReward, newPoints, `每日签到 +${totalReward}积分`, newCheckInDays)

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

async function addPoints(openid, amount, type, description) {
  if (!amount || amount <= 0) {
    return { success: false, error: '积分数量必须大于0' }
  }

  try {
    let userRes = await db.collection('user_points').where({ _openid: openid }).get()
    let user

    if (userRes.data.length === 0) {
      const now = new Date()
      user = {
        _openid: openid,
        points: 0,
        totalPoints: 0,
        checkInDays: 0,
        totalCheckInDays: 0,
        lastCheckInDate: '',
        memberLevel: 'none',
        memberExpireDate: null,
        createdAt: now,
      }
      const addRes = await db.collection('user_points').add({ data: user })
      user._id = addRes._id
    } else {
      user = userRes.data[0]
    }

    const newPoints = user.points + amount
    const newTotalPoints = user.totalPoints + amount

    await db.collection('user_points').doc(user._id).update({
      data: {
        points: newPoints,
        totalPoints: newTotalPoints,
        updatedAt: new Date()
      }
    })

    await createPointRecord(openid, type, amount, newPoints, description || `${type} +${amount}积分`)

    return {
      success: true,
      data: {
        points: newPoints,
        totalPoints: newTotalPoints,
        addedAmount: amount
      }
    }
  } catch (e) {
    console.error('addPoints 错误:', e)
    return { success: false, error: e.message }
  }
}

async function deductPoints(openid, amount, type, description) {
  if (!amount || amount <= 0) {
    return { success: false, error: '积分数量必须大于0' }
  }

  try {
    let userRes = await db.collection('user_points').where({ _openid: openid }).get()
    let user

    if (userRes.data.length === 0) {
      return { success: false, error: '用户不存在' }
    }

    user = userRes.data[0]

    if (user.points < amount) {
      return { success: false, error: '积分不足', currentPoints: user.points }
    }

    const newPoints = user.points - amount

    await db.collection('user_points').doc(user._id).update({
      data: {
        points: newPoints,
        updatedAt: new Date()
      }
    })

    await createPointRecord(openid, type, -amount, newPoints, description || `${type} -${amount}积分`)

    return {
      success: true,
      data: {
        points: newPoints,
        deductedAmount: amount
      }
    }
  } catch (e) {
    console.error('deductPoints 错误:', e)
    return { success: false, error: e.message }
  }
}

async function createPointRecord(openid, type, amount, balance, description, extraData = {}) {
  try {
    await db.collection('point_records').add({
      data: {
        _openid: openid,
        type,
        amount,
        balance,
        description,
        ...extraData,
        createdAt: new Date()
      }
    })
  } catch (e) {
    console.error('创建积分记录失败:', e)
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

async function exchangeMember(openid, level) {
  const config = MEMBER_CONFIG[level]
  if (!config) {
    return { success: false, error: '无效的会员等级' }
  }

  const pointsNeeded = POINTS_CONFIG[`member${capitalize(level)}Points`]

  try {
    let userRes = await db.collection('user_points').where({ _openid: openid }).get()
    let user

    if (userRes.data.length === 0) {
      return { success: false, error: '用户不存在' }
    }

    user = userRes.data[0]

    if (user.points < pointsNeeded) {
      return { success: false, error: '积分不足', currentPoints: user.points, neededPoints: pointsNeeded }
    }

    let newExpireDate
    const currentExpireDate = user.memberExpireDate ? new Date(user.memberExpireDate) : null

    if (level === 'lifetime') {
      newExpireDate = new Date('2099-12-31')
    } else if (currentExpireDate && currentExpireDate > new Date()) {
      newExpireDate = new Date(currentExpireDate.getTime() + config.days * 24 * 60 * 60 * 1000)
    } else {
      newExpireDate = new Date(Date.now() + config.days * 24 * 60 * 60 * 1000)
    }

    await db.collection('user_points').doc(user._id).update({
      data: {
        points: user.points - pointsNeeded,
        memberLevel: level,
        memberExpireDate: newExpireDate,
        updatedAt: new Date()
      }
    })

    await createPointRecord(openid, 'exchangeMember', -pointsNeeded, user.points - pointsNeeded, `兑换${config.name}`)

    await db.collection('member_records').add({
      data: {
        _openid: openid,
        memberLevel: level,
        startDate: new Date(),
        expireDate: newExpireDate,
        pointsCost: pointsNeeded,
        source: 'points_exchange',
        createdAt: new Date()
      }
    })

    return {
      success: true,
      data: {
        memberLevel: level,
        memberName: config.name,
        expireDate: newExpireDate.toISOString(),
        pointsSpent: pointsNeeded
      }
    }
  } catch (e) {
    console.error('exchangeMember 错误:', e)
    return { success: false, error: e.message }
  }
}

async function getMemberStatus(openid) {
  try {
    let userRes = await db.collection('user_points').where({ _openid: openid }).get()

    if (userRes.data.length === 0) {
      return {
        success: true,
        data: {
          isMember: false,
          memberLevel: 'none',
          memberName: '',
          expireDate: null,
          daysRemaining: 0
        }
      }
    }

    const user = userRes.data[0]
    const status = checkMemberStatus(user)

    let daysRemaining = 0
    if (status.expireDate) {
      const expireDate = new Date(status.expireDate)
      const now = new Date()
      daysRemaining = Math.max(0, Math.ceil((expireDate - now) / (1000 * 60 * 60 * 24)))
    }

    return {
      success: true,
      data: {
        isMember: status.isValid,
        memberLevel: status.level,
        memberName: status.level !== 'none' ? MEMBER_CONFIG[status.level]?.name || '' : '',
        expireDate: status.expireDate,
        daysRemaining
      }
    }
  } catch (e) {
    console.error('getMemberStatus 错误:', e)
    return { success: false, error: e.message }
  }
}

async function recordDownload(openid, resourceId, resourceType, downloadMethod) {
  try {
    const userRes = await db.collection('user_points').where({ _openid: openid }).get()
    let user = userRes.data[0]
    
    let actualMethod = downloadMethod
    let usedBonus = false
    
    // 检查是否使用免费下载
    if (downloadMethod === 'free') {
      const freeUsed = await isFreeDownloadUsedToday(openid)
      if (freeUsed) {
        return { success: false, error: '今日免费下载次数已用完' }
      }
    }
    
    // 检查是否使用奖励下载
    if (user && user.bonusDownloads > 0 && downloadMethod === 'points') {
      usedBonus = true
      actualMethod = 'bonus'
      await db.collection('user_points').doc(user._id).update({
        data: {
          bonusDownloads: user.bonusDownloads - 1,
          updatedAt: new Date()
        }
      })
    }
    
    await db.collection('download_records').add({
      data: {
        _openid: openid,
        resourceId: resourceId || '',
        resourceType: resourceType || 'wallpaper',
        downloadMethod: actualMethod,
        pointsCost: actualMethod === 'points' ? POINTS_CONFIG.downloadPoints : 0,
        usedBonus: usedBonus,
        createdAt: new Date()
      }
    })

    await recordInviteAction(openid)

    return { success: true, usedBonus, downloadMethod: actualMethod }
  } catch (e) {
    console.error('recordDownload 错误:', e)
    return { success: false, error: e.message }
  }
}

async function getConfigs() {
  return {
    success: true,
    data: POINTS_CONFIG
  }
}

async function rewardAdWatch(openid) {
  try {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const limit = POINTS_CONFIG.watchAdDailyLimit || 15
    const reward = POINTS_CONFIG.watchAdPoints || 20

    // 查询今日 watchAd 记录次数
    const countRes = await db.collection('point_records')
      .where({
        _openid: openid,
        type: 'watchAd',
        createdAt: _.gte(todayStart)
      })
      .count()

    if ((countRes.total || 0) >= limit) {
      return { success: false, error: '今日观看次数已达上限' }
    }

    const addRes = await addPoints(openid, reward, 'watchAd', `观看激励视频 +${reward}积分`)
    if (!addRes || !addRes.success) {
      return { success: false, error: addRes?.error || '积分发放失败' }
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

async function getDownloadStatus(openid) {
  const today = formatDate(new Date())

  try {
    const userRes = await db.collection('user_points').where({ _openid: openid }).get()
    let user = userRes.data[0]

    const memberStatus = checkMemberStatus(user || {})

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const downloadRes = await db.collection('download_records')
      .where({
        _openid: openid,
        createdAt: _.gte(todayStart)
      })
      .count()

    const todayDownloads = downloadRes.total || 0

    const freeDownloadUsed = await isFreeDownloadUsedToday(openid)

    return {
      success: true,
      data: {
        todayDownloads,
        freeDownloadUsed,
        canFreeDownload: !freeDownloadUsed && !memberStatus.isValid,
        isMember: memberStatus.isValid,
        memberLevel: memberStatus.level,
        currentPoints: user?.points || 0,
        bonusDownloads: user?.bonusDownloads || 0,
        dailyDownloadLimit: memberStatus.isValid ? MEMBER_CONFIG[memberStatus.level]?.dailyDownloads || Infinity : 0,
        pointsRequired: POINTS_CONFIG.downloadPoints,
        downloadCost: POINTS_CONFIG.downloadPoints,
        pointsRequiredFor3: POINTS_CONFIG.downloadPoints * 3 - 5,
        pointsRequiredFor10: POINTS_CONFIG.downloadPoints * 10 - 30
      }
    }
  } catch (e) {
    console.error('getDownloadStatus 错误:', e)
    return { success: false, error: e.message }
  }
}

async function isFreeDownloadUsedToday(openid) {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const downloadRes = await db.collection('download_records')
    .where({
      _openid: openid,
      downloadMethod: 'free',
      createdAt: _.gte(todayStart)
    })
    .count()

  return downloadRes.total > 0
}

async function canDownload(openid) {
  try {
    const statusRes = await getDownloadStatus(openid)
    const status = statusRes.data

    if (status.isMember) {
      if (status.todayDownloads >= status.dailyDownloadLimit) {
        return {
          success: true,
          data: {
            canDownload: false,
            reason: 'member_limit',
            message: '今日下载次数已用完'
          }
        }
      }
      return {
        success: true,
        data: {
          canDownload: true,
          method: 'member',
          message: '会员无限下载'
        }
      }
    }

    if (!status.freeDownloadUsed) {
      return {
        success: true,
        data: {
          canDownload: true,
          method: 'free',
          isFree: true,
          message: '今日首次免费下载'
        }
      }
    }

    return {
      success: true,
      data: {
        canDownload: true,
        method: 'points',
        message: '需要消耗积分下载'
      }
    }
  } catch (e) {
    console.error('canDownload 错误:', e)
    return { success: false, error: e.message }
  }
}

const INVITE_CONFIG = {
  rewardPoints: POINTS_CONFIG.inviteRewardPoints || 50,
  dailyInviteLimit: POINTS_CONFIG.inviteDailyLimit || 5,
  newUserRequiredActions: 3
}

async function getInviteStatus(openid) {
  try {
    const userRes = await db.collection('user_points').where({ _openid: openid }).get()
    let user = userRes.data[0]

    const today = formatDate(new Date())
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const inviteRecordRes = await db.collection('invite_records')
      .where({
        inviterOpenid: openid,
        createdAt: _.gte(todayStart)
      })
      .count()

    const todayInvites = inviteRecordRes.total || 0

    const totalInviteRes = await db.collection('invite_records')
      .where({
        inviterOpenid: openid
      })
      .count()

    const totalInvites = totalInviteRes.total || 0

    const inviteRecords = await db.collection('invite_records')
      .where({
        inviterOpenid: openid
      })
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get()

    let validInvites = 0
    if (inviteRecords.data && inviteRecords.data.length > 0) {
      for (const record of inviteRecords.data) {
        if (record.isValid) validInvites++
      }
    }

    return {
      success: true,
      data: {
        rewardPoints: INVITE_CONFIG.rewardPoints,
        dailyInviteLimit: INVITE_CONFIG.dailyInviteLimit,
        todayInvites,
        canInvite: todayInvites < INVITE_CONFIG.dailyInviteLimit,
        totalInvites,
        validInvites,
        newUserRequiredActions: INVITE_CONFIG.newUserRequiredActions,
        rules: [
          `每成功邀请1位新用户可获得${INVITE_CONFIG.rewardPoints}积分`,
          `每日最多可邀请${INVITE_CONFIG.dailyInviteLimit}位新用户`,
          `新用户需完成${INVITE_CONFIG.newUserRequiredActions}次下载或${INVITE_CONFIG.newUserRequiredActions}天签到才算有效邀请`
        ]
      }
    }
  } catch (e) {
    console.error('getInviteStatus 错误:', e)
    return { success: false, error: e.message }
  }
}

async function bindInviter(openid, inviterOpenid) {
  try {
    if (!inviterOpenid || openid === inviterOpenid) {
      return { success: false, error: '无效的邀请人' }
    }

    const existingRes = await db.collection('invite_records')
      .where({
        inviteeOpenid: openid
      })
      .get()

    if (existingRes.data && existingRes.data.length > 0) {
      return { success: true, rewarded: false, message: '已绑定邀请人' }
    }

    await db.collection('invite_records').add({
      data: {
        inviterOpenid: inviterOpenid,
        inviteeOpenid: openid,
        isValid: false,
        completedActions: 0,
        rewardPoints: 0,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    })

    return { success: true, rewarded: false, message: '绑定成功' }
  } catch (e) {
    console.error('bindInviter 错误:', e)
    return { success: false, error: e.message }
  }
}

async function getInviteRecords(openid) {
  try {
    const records = await db.collection('invite_records')
      .where({
        inviterOpenid: openid
      })
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get()

    return {
      success: true,
      data: records.data || []
    }
  } catch (e) {
    console.error('getInviteRecords 错误:', e)
    return { success: false, error: e.message }
  }
}

async function checkInviteValid(inviteeOpenid) {
  try {
    const records = await db.collection('invite_records')
      .where({
        inviteeOpenid: inviteeOpenid,
        isValid: false
      })
      .get()

    if (records.data && records.data.length > 0) {
      const record = records.data[0]
      const actions = record.completedActions || 0

      if (actions >= INVITE_CONFIG.newUserRequiredActions) {
        await db.collection('invite_records').doc(record._id).update({
          data: {
            isValid: true,
            rewardPoints: INVITE_CONFIG.rewardPoints,
            updatedAt: db.serverDate()
          }
        })

        await addPoints(record.inviterOpenid, INVITE_CONFIG.rewardPoints, 'invite', '邀请新用户奖励')

        return true
      }
    }
    return false
  } catch (e) {
    console.error('checkInviteValid 错误:', e)
    return false
  }
}

async function recordInviteAction(openid) {
  try {
    const records = await db.collection('invite_records')
      .where({
        inviteeOpenid: openid,
        isValid: false
      })
      .get()

    if (records.data && records.data.length > 0) {
      const record = records.data[0]
      const newActions = (record.completedActions || 0) + 1

      await db.collection('invite_records').doc(record._id).update({
        data: {
          completedActions: newActions,
          updatedAt: db.serverDate()
        }
      })

      if (newActions >= INVITE_CONFIG.newUserRequiredActions) {
        await checkInviteValid(openid)
      }
    }
  } catch (e) {
    console.error('recordInviteAction 错误:', e)
  }
}

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

async function exchangeDownloads(openid, count) {
  const countMap = {
    1: { points: POINTS_CONFIG.singleDownloadPoints, name: '单次下载' },
    3: { points: POINTS_CONFIG.threeDownloadPoints, name: '3次下载' },
    10: { points: POINTS_CONFIG.tenDownloadPoints, name: '10次下载' }
  }

  const config = countMap[count]
  if (!config) {
    return { success: false, error: '无效的下载次数' }
  }

  try {
    let userRes = await db.collection('user_points').where({ _openid: openid }).get()
    if (userRes.data.length === 0) {
      return { success: false, error: '用户不存在' }
    }

    const user = userRes.data[0]
    if (user.points < config.points) {
      return { success: false, error: '积分不足', currentPoints: user.points, neededPoints: config.points }
    }

    const newDownloadsRemaining = (user.downloadsRemaining || 0) + count

    await db.collection('user_points').doc(user._id).update({
      data: {
        points: user.points - config.points,
        downloadsRemaining: newDownloadsRemaining,
        updatedAt: new Date()
      }
    })

    await createPointRecord(openid, 'exchangeDownloads', -config.points, user.points - config.points, `兑换${config.name}`)

    return {
      success: true,
      data: {
        count,
        name: config.name,
        pointsSpent: config.points,
        downloadsRemaining: newDownloadsRemaining
      }
    }
  } catch (e) {
    console.error('exchangeDownloads 错误:', e)
    return { success: false, error: e.message }
  }
}

async function getExchangeOptions() {
  return {
    success: true,
    data: {
      members: [
        { level: 'weekly', name: '周卡会员', points: POINTS_CONFIG.memberWeeklyPoints, days: 7, benefits: ['无限下载', '去除所有广告'] },
        { level: 'monthly', name: '月卡会员', points: POINTS_CONFIG.memberMonthlyPoints, days: 30, benefits: ['无限下载', '去除所有广告'] },
        { level: 'quarterly', name: '季卡会员', points: POINTS_CONFIG.memberQuarterlyPoints, days: 90, benefits: ['无限下载', '去除所有广告', '性价比更高'] },
        { level: 'yearly', name: '年卡会员', points: POINTS_CONFIG.memberYearlyPoints, days: 365, benefits: ['无限下载', '去除所有广告', '超值优惠'] },
        { level: 'lifetime', name: '终身会员', points: POINTS_CONFIG.memberLifetimePoints, days: null, benefits: ['无限下载', '去除所有广告', '永久有效', '专属标识'] }
      ],
      downloads: [
        { count: 1, name: '单次下载', points: POINTS_CONFIG.singleDownloadPoints },
        { count: 3, name: '3次下载', points: POINTS_CONFIG.threeDownloadPoints, bonus: '节省3积分' },
        { count: 10, name: '10次下载', points: POINTS_CONFIG.tenDownloadPoints, bonus: '节省15积分' }
      ],

      downloadPoints: POINTS_CONFIG.downloadPoints
    }
  }
}
