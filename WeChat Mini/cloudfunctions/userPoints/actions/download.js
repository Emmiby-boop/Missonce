const { db, _, POINTS_CONFIG, MEMBER_CONFIG, formatDate, checkMemberStatus } = require('../shared')

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

async function recordDownload(openid, resourceId, resourceType, downloadMethod) {
  try {
    const userRes = await db.collection('user_points').where({ _openid: openid }).limit(1).get()
    let user = userRes.data[0]
    
    let actualMethod = downloadMethod
    let usedBonus = false
    
    if (downloadMethod === 'free') {
      const freeUsed = await isFreeDownloadUsedToday(openid)
      if (freeUsed) {
        return { success: false, error: '今日免费下载次数已用完' }
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
        pointsCost: actualMethod === 'points' ? POINTS_CONFIG.downloadPoints : 0,
        usedBonus: usedBonus,
        createdAt: new Date()
      }
    })

    return { success: true, usedBonus, downloadMethod: actualMethod }
  } catch (e) {
    console.error('recordDownload 错误:', e)
    return { success: false, error: e.message }
  }
}

async function getDownloadStatus(openid) {
  try {
    const userRes = await db.collection('user_points').where({ _openid: openid }).limit(1).get()
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

async function canDownload(openid) {
  try {
    const statusRes = await getDownloadStatus(openid)
    const status = statusRes.data

    if (status.isMember) {
      if (status.todayDownloads >= status.dailyDownloadLimit) {
        return {
          success: true,
          data: { canDownload: false, reason: 'member_limit', message: '今日下载次数已用完' }
        }
      }
      return {
        success: true,
        data: { canDownload: true, method: 'member', message: '会员无限下载' }
      }
    }

    if (!status.freeDownloadUsed) {
      return {
        success: true,
        data: { canDownload: true, method: 'free', isFree: true, message: '今日首次免费下载' }
      }
    }

    return {
      success: true,
      data: { canDownload: true, method: 'points', message: '需要消耗积分下载' }
    }
  } catch (e) {
    console.error('canDownload 错误:', e)
    return { success: false, error: e.message }
  }
}

module.exports = { recordDownload, getDownloadStatus, canDownload }
