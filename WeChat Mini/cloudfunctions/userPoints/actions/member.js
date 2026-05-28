const { db, _, MEMBER_CONFIG, POINTS_CONFIG, capitalize, checkMemberStatus, createPointRecord } = require('../shared')

async function exchangeMember(openid, level) {
  const config = MEMBER_CONFIG[level]
  if (!config) {
    return { success: false, error: '无效的会员等级' }
  }

  const pointsNeeded = POINTS_CONFIG[`member${capitalize(level)}Points`]

  try {
    const userRes = await db.collection('user_points').where({ _openid: openid }).limit(1).get()
    if (userRes.data.length === 0) {
      return { success: false, error: '用户不存在' }
    }

    const user = userRes.data[0]
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
    const userRes = await db.collection('user_points').where({ _openid: openid }).limit(1).get()

    if (userRes.data.length === 0) {
      return {
        success: true,
        data: { isMember: false, memberLevel: 'none', memberName: '', expireDate: null, daysRemaining: 0 }
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

module.exports = { exchangeMember, getMemberStatus }
