const { db, _, POINTS_CONFIG, formatDate } = require('../shared')

const INVITE_CONFIG = {
  rewardPoints: POINTS_CONFIG.inviteRewardPoints || 50,
  dailyInviteLimit: POINTS_CONFIG.inviteDailyLimit || 5,
  newUserRequiredActions: 3
}

async function getInviteStatus(openid) {
  try {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const inviteRecordRes = await db.collection('invite_records')
      .where({ inviterOpenid: openid, createdAt: _.gte(todayStart) })
      .count()

    const todayInvites = inviteRecordRes.total || 0

    const totalInviteRes = await db.collection('invite_records')
      .where({ inviterOpenid: openid })
      .count()

    const totalInvites = totalInviteRes.total || 0

    const inviteRecords = await db.collection('invite_records')
      .where({ inviterOpenid: openid })
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

async function bindInviter(openid, event) {
  const inviterOpenid = event.inviterOpenid
  try {
    if (!inviterOpenid || openid === inviterOpenid) {
      return { success: false, error: '无效的邀请人' }
    }

    const existingRes = await db.collection('invite_records')
      .where({ inviteeOpenid: openid })
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
      .where({ inviterOpenid: openid })
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get()

    return { success: true, data: records.data || [] }
  } catch (e) {
    console.error('getInviteRecords 错误:', e)
    return { success: false, error: e.message }
  }
}

async function checkInviteValid(inviteeOpenid) {
  const { addPoints } = require('./points')
  try {
    const records = await db.collection('invite_records')
      .where({ inviteeOpenid: inviteeOpenid, isValid: false })
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
      .where({ inviteeOpenid: openid, isValid: false })
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

module.exports = { getInviteStatus, bindInviter, getInviteRecords, checkInviteValid, recordInviteAction }
