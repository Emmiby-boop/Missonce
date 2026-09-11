const {
  db, _, MEMBER_CONFIG, POINTS_CONFIG, capitalize, checkMemberStatus,
  createPointRecord
} = require('../shared')

module.exports = async (event, context) => {
  const { action, openid } = event
  switch (action) {
    case 'exchangeMember':
      return await exchangeMember(openid, event.level)
    case 'getMemberStatus':
      return await getMemberStatus(openid)
    case 'getExchangeOptions':
      return await getExchangeOptions()
    default:
      return null
  }
}

async function exchangeMember(openid, level) {
  const config = MEMBER_CONFIG[level]
  if (!config) {
    return { success: false, error: '无效的会员等级' }
  }

  const pointsNeeded = POINTS_CONFIG[`member${capitalize(level)}Points`]

  try {
    let userRes = await db.collection('user_points').where({ _openid: openid }).limit(1).get()
    let user

    if (userRes.data.length === 0) {
      return { success: false, error: '用户不存在' }
    }

    user = userRes.data[0]

    if (user.points < pointsNeeded) {
      return { success: false, error: '辣度值不足', currentPoints: user.points, neededPoints: pointsNeeded }
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
        points: _.inc(-pointsNeeded),
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
    let userRes = await db.collection('user_points').where({ _openid: openid }).limit(1).get()

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
        { count: 3, name: '3次下载', points: POINTS_CONFIG.threeDownloadPoints, bonus: '节省3辣度值' },
        { count: 10, name: '10次下载', points: POINTS_CONFIG.tenDownloadPoints, bonus: '节省15辣度值' }
      ],

      downloadPoints: POINTS_CONFIG.downloadPoints
    }
  }
}
