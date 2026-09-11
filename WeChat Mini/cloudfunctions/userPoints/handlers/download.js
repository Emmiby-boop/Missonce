const {
  db, _, POINTS_CONFIG, MEMBER_CONFIG, formatDate, getBeijingTodayStart, checkMemberStatus,
  createPointRecord, getDownloadConfig, recordInviteAction
} = require('../shared')

module.exports = async (event, context) => {
  const { action, openid } = event
  switch (action) {
    case 'recordDownload':
      return await recordDownload(openid, event.resourceId, event.resourceType, event.downloadMethod)
    case 'getDownloadStatus':
      return await getDownloadStatus(openid)
    case 'canDownload':
      return await canDownload(openid)
    case 'exchangeDownloads':
      return await exchangeDownloads(openid, event.count)
    case 'deductPoints': {
      // 🔒 仅限服务端调用（管理员或云函数互调）
      // 客户端禁止直接调用 deductPoints，必须通过 exchangeMember/exchangeDownloads 等业务流程
      if (!event.fromServer) {
        return { success: false, error: '禁止客户端直接调用此接口' }
      }
      return await deductPoints(openid, event.amount, event.type, event.description)
    }
    default:
      return null
  }
}

async function recordDownload(openid, resourceId, resourceType, downloadMethod) {
  try {
    const dc = await getDownloadConfig()
    const userRes = await db.collection('user_points').where({ _openid: openid }).limit(1).get()
    let user = userRes.data[0]

    let actualMethod = downloadMethod
    let usedBonus = false

    if (downloadMethod === 'free') {
      const today = formatDate(new Date())
      const hasAdDate = user && user.lastAdWatchedDate === today
      const hasFreeRecord = await isFreeDownloadUsedToday(openid)
      if (!hasAdDate && !hasFreeRecord) {
        return { success: false, error: '今日未观看广告，无法免费下载' }
      }
    }

    if (user && user.bonusDownloads > 0 && downloadMethod === 'points') {
      usedBonus = true
      actualMethod = 'bonus'
      await db.collection('user_points').doc(user._id).update({
        data: {
          bonusDownloads: _.inc(-1),
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
        pointsCost: actualMethod === 'points' ? dc.downloadCostPoints : 0,
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

async function getDownloadStatus(openid) {
  const today = formatDate(new Date())
  const dc = await getDownloadConfig()

  try {
    const userRes = await db.collection('user_points').where({ _openid: openid }).limit(1).get()
    let user = userRes.data[0]

    const memberStatus = checkMemberStatus(user || {})

    const todayStart = getBeijingTodayStart()

    const downloadRes = await db.collection('download_records')
      .where({
        _openid: openid,
        createdAt: _.gte(todayStart)
      })
      .count()

    const todayDownloads = downloadRes.total || 0

    // 🔥 兼容新旧两种判定：
    //   新：user_points.lastAdWatchedDate === today（markAdWatched 写入）
    //   旧：download_records 中存在今日 downloadMethod='free' 记录（线上存量数据）
    const newFlag = !!(user && user.lastAdWatchedDate === today)
    const oldFlag = await isFreeDownloadUsedToday(openid)
    const freeDownloadUsed = newFlag || oldFlag

    return {
      success: true,
      data: {
        todayDownloads,
        freeDownloadUsed,
        canFreeDownload: memberStatus.isValid || freeDownloadUsed,
        isMember: memberStatus.isValid,
        memberLevel: memberStatus.level,
        currentPoints: user?.points || 0,
        bonusDownloads: user?.bonusDownloads || 0,
        dailyDownloadLimit: memberStatus.isValid ? MEMBER_CONFIG[memberStatus.level]?.dailyDownloads || Infinity : 0,
        pointsRequired: dc.downloadCostPoints,
        downloadCost: dc.downloadCostPoints,
        pointsRequiredFor3: dc.downloadCostPoints * 3 - 5,
        pointsRequiredFor10: dc.downloadCostPoints * 10 - 30,
        freeDownloadsAfterAd: dc.freeDownloadsAfterAd,
        rewardAdEnabled: dc.rewardAdEnabled,
      }
    }
  } catch (e) {
    console.error('getDownloadStatus 错误:', e)
    return { success: false, error: e.message }
  }
}

async function isFreeDownloadUsedToday(openid) {
  const todayStart = getBeijingTodayStart()

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
    const dc = await getDownloadConfig()
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

    if (!dc.rewardAdEnabled) {
      if (dc.downloadCostPoints <= 0) {
        return {
          success: true,
          data: { canDownload: true, method: 'free', isFree: true, message: '免费下载' }
        }
      }
      const userRes = await db.collection('user_points').where({ _openid: openid }).limit(1).get()
      const userPoints = userRes.data[0]?.points || 0
      if (userPoints < dc.downloadCostPoints) {
        return {
          success: true,
          data: { canDownload: false, reason: 'insufficient_points', message: `辣度值不足，需要 ${dc.downloadCostPoints} 辣度值` }
        }
      }
      return {
        success: true,
        data: { canDownload: true, method: 'points', message: `消耗 ${dc.downloadCostPoints} 辣度值下载` }
      }
    }

    if (!status.freeDownloadUsed) {
      return {
        success: true,
        data: {
          canDownload: true,
          method: 'free',
          isFree: true,
          message: dc.freeDownloadsAfterAd > 0 ? `今日免费下载（剩余 ${dc.freeDownloadsAfterAd} 次）` : '请先观看广告获取免费下载'
        }
      }
    }

    return {
      success: true,
      data: {
        canDownload: true,
        method: 'points',
        message: `需要消耗 ${dc.downloadCostPoints} 辣度值下载`
      }
    }
  } catch (e) {
    console.error('canDownload 错误:', e)
    return { success: false, error: e.message }
  }
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
    let userRes = await db.collection('user_points').where({ _openid: openid }).limit(1).get()
    if (userRes.data.length === 0) {
      return { success: false, error: '用户不存在' }
    }

    const user = userRes.data[0]
    if (user.points < config.points) {
      return { success: false, error: '辣度值不足', currentPoints: user.points, neededPoints: config.points }
    }

    const newDownloadsRemaining = (user.downloadsRemaining || 0) + count

    await db.collection('user_points').doc(user._id).update({
      data: {
        points: _.inc(-config.points),
        downloadsRemaining: _.inc(count),
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

async function deductPoints(openid, amount, type, description) {
  if (!amount || amount <= 0) {
    return { success: false, error: '辣度值数量必须大于0' }
  }

  try {
    let userRes = await db.collection('user_points').where({ _openid: openid }).limit(1).get()
    let user

    if (userRes.data.length === 0) {
      return { success: false, error: '用户不存在' }
    }

    user = userRes.data[0]

    if (user.points < amount) {
      return { success: false, error: '辣度值不足', currentPoints: user.points }
    }

    await db.collection('user_points').doc(user._id).update({
      data: {
        points: _.inc(-amount),
        updatedAt: new Date()
      }
    })

    await createPointRecord(openid, type, -amount, user.points - amount, description || `${type} -${amount}辣度值`)

    return {
      success: true,
      data: {
        points: user.points - amount,
        deductedAmount: amount
      }
    }
  } catch (e) {
    console.error('deductPoints 错误:', e)
    return { success: false, error: e.message }
  }
}
