const { db, _, formatDate, getBeijingTodayStart, INVITE_CONFIG } = require('../shared')

module.exports = async (event, context) => {
  const { action, openid } = event
  switch (action) {
    case 'getInviteStatus':
      return await getInviteStatus(openid)
    case 'bindInviter':
      return await bindInviter(openid, event.inviterOpenid)
    case 'getInviteRecords':
      return await getInviteRecords(openid)
    default:
      return null
  }
}

async function getInviteStatus(openid) {
  try {
    const userRes = await db.collection('user_points').where({ _openid: openid }).limit(1).get()
    let user = userRes.data[0]

    const today = formatDate(new Date())
    const todayStart = getBeijingTodayStart()

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
          `每成功邀请1位新用户可获得${INVITE_CONFIG.rewardPoints}辣度值`,
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
