const { db, _, POINTS_CONFIG, createPointRecord, getOrCreateUser } = require('../shared')

async function exchangeDownloads(openid, event) {
  const count = event.count
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
    const userRes = await db.collection('user_points').where({ _openid: openid }).limit(1).get()
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

async function rewardAdWatch(openid) {
  const { addPoints } = require('./points')
  try {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const limit = POINTS_CONFIG.watchAdDailyLimit || 15
    const reward = POINTS_CONFIG.watchAdPoints || 20

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

    return { success: true, data: addRes.data }
  } catch (e) {
    console.error('rewardAdWatch 错误:', e)
    return { success: false, error: e.message }
  }
}

module.exports = { exchangeDownloads, getExchangeOptions, rewardAdWatch }
