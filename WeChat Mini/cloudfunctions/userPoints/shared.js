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

/**
 * 辣度值兑换会员的定价（2026-10-10 重定）
 * ------------------------------------------------------------
 * ⚠️ 重定原因：原定价与现金价严重失衡 ——
 *    原倍率（积分价/现金价）周卡 1.32x → 终身7.27x，
 *   终身卡要攒 50000 分（纯签到需13.9 年，全勤也要714 天），
 *    等于在告诉用户「积分没用，宁可不用」，页面也因此显得复杂。
 *
 * 新定价原则：短档贴近现金价（1:1 略上浮），长档给积分优惠（倍率递减），
 * 让「攒积分换长档」在数学上真的划算 —— 每千积分换到天数随档位递增。
 *
 * 档位      现金价    积分价    倍率     每千积分可换
 * 周卡      ¥3.80     400      1.053x18 天
 * 月卡      ¥8.80     900      1.023x    33 天
 * 季卡      ¥18.80   1800      0.957x    50 天
 * 年卡      ¥38.80   3500      0.902x   104 天
 * 终身      ¥68.80   5900      0.858x   619 天（按 10 年折算）
 *
 * ⚠️ 改价纪律：MP 后台 virtual_pay_config.products（现金价）与这里是两条独立定价，
 *    **改任何一边都必须同步另一边**，并同步 agreementContent.js 第三/四条的价格表述，
 *    否则协议与实际支付不一致会被判误导。
 */
const POINTS_CONFIG = {
  checkInPoints: 10,
  checkInBonus: 30,
  checkInMaxBonus: 100,
  sharePoints: 10,
  shareDailyLimit: 5,
  inviteRewardPoints: 25,
  inviteDailyLimit: 5,
  downloadPoints: 6,
  dailyFreeDownload: 1,
  watchAdPoints: 20,
  watchAdDailyLimit: 15,
  memberWeeklyPoints: 400,
  memberMonthlyPoints: 900,
  memberQuarterlyPoints: 1800,
  memberYearlyPoints: 3500,
  memberLifetimePoints: 5900,
  singleDownloadPoints: 6,
  threeDownloadPoints: 15,
  tenDownloadPoints: 45,
  newUserPoints: 25
}

const DOWNLOAD_CONFIG_DEFAULTS = {
  rewardAdEnabled: true,
  freeDownloadsAfterAd: 1,
  downloadCostPoints: 6,
  pointsPerAdWatch: 20,
  dailyAdWatchLimit: 15,
  newUserPoints: 25
}

const INVITE_CONFIG = {
  rewardPoints: POINTS_CONFIG.inviteRewardPoints || 50,
  dailyInviteLimit: POINTS_CONFIG.inviteDailyLimit || 5,
  newUserRequiredActions: 3
}

let _cachedDownloadConfig = null
let _cachedDownloadConfigTime = 0
const CONFIG_CACHE_TTL = 60 * 1000

async function getDownloadConfig() {
  const now = Date.now()
  if (_cachedDownloadConfig && (now - _cachedDownloadConfigTime) < CONFIG_CACHE_TTL) {
    return _cachedDownloadConfig
  }

  try {
    const res = await db.collection('config').where({ key: 'downloadConfig' }).limit(1).get()
    const item = res.data && res.data[0]
    if (item && item.value) {
      _cachedDownloadConfig = { ...DOWNLOAD_CONFIG_DEFAULTS, ...item.value }
    } else {
      _cachedDownloadConfig = { ...DOWNLOAD_CONFIG_DEFAULTS }
    }
  } catch (e) {
    console.error('[shared] 加载下载配置失败，使用默认值:', e.message)
    _cachedDownloadConfig = { ...DOWNLOAD_CONFIG_DEFAULTS }
  }
  _cachedDownloadConfigTime = now
  return _cachedDownloadConfig
}

function formatDate(date) {
  // 云函数运行在 UTC 时区，需强制转换为北京时间（UTC+8）计算日期
  // 否则北京时间 0 点时云函数仍认为"今天"是前一天，导致签到状态不刷新
  const beijingOffset = 8 * 60 * 60 * 1000
  const beijingDate = new Date(date.getTime() + beijingOffset)
  const year = beijingDate.getUTCFullYear()
  const month = String(beijingDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(beijingDate.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 获取北京时间今天 0 点对应的 Date 对象（用于数据库查询的 createdAt >= 边界）
 * 云函数运行在 UTC 时区，直接 new Date().setHours(0,0,0,0) 得到的是 UTC 0 点，
 * 对应北京时间早上 8 点，会导致凌晨 0-8 点的记录被算到前一天。
 */
function getBeijingTodayStart() {
  const now = new Date()
  const beijingOffset = 8 * 60 * 60 * 1000
  const beijingNow = new Date(now.getTime() + beijingOffset)
  return new Date(Date.UTC(
    beijingNow.getUTCFullYear(),
    beijingNow.getUTCMonth(),
    beijingNow.getUTCDate(),
    0, 0, 0, 0
  ))
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
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

  return { level, expireDate: expireDate ? expireDate.toISOString() : null, isValid }
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
    console.error('创建辣度值记录失败:', e)
  }
}

async function getOrCreateUser(openid) {
  const userRes = await db.collection('user_points').where({ _openid: openid }).limit(1).get()
  if (userRes.data.length > 0) return userRes.data[0]

  // 🔥 新用户注册即赠送辣度值（后台可配置 newUserPoints，默认 25）
  const dc = await getDownloadConfig()
  const newUserPoints = (typeof dc.newUserPoints === 'number' && dc.newUserPoints > 0)
    ? dc.newUserPoints
    : (POINTS_CONFIG.newUserPoints || 25)

  const now = new Date()
  const user = {
    _openid: openid,
    points: newUserPoints,
    totalPoints: newUserPoints,
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

  // 🔥 记录新用户赠送辣度值流水
  if (newUserPoints > 0) {
    try {
      await createPointRecord(openid, 'newUser', newUserPoints, newUserPoints, `新用户注册赠送 ${newUserPoints} 辣度值`)
    } catch (e) {
      console.error('[getOrCreateUser] 记录新用户赠送流水失败:', e)
    }
  }

  return user
}

async function addPoints(openid, amount, type, description) {
  if (!amount || amount <= 0) {
    return { success: false, error: '辣度值数量必须大于0' }
  }

  try {
    const user = await getOrCreateUser(openid)

    await db.collection('user_points').doc(user._id).update({
      data: {
        points: _.inc(amount),
        totalPoints: _.inc(amount),
        updatedAt: new Date()
      }
    })

    await createPointRecord(openid, type, amount, user.points + amount, description || `${type} +${amount}辣度值`)

    const updatedPoints = user.points + amount
    return {
      success: true,
      data: {
        points: updatedPoints,
        totalPoints: user.totalPoints + amount,
        addedAmount: amount
      }
    }
  } catch (e) {
    console.error('addPoints 错误:', e)
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

module.exports = {
  db, _, MEMBER_CONFIG, POINTS_CONFIG, DOWNLOAD_CONFIG_DEFAULTS, INVITE_CONFIG,
  formatDate, getBeijingTodayStart, capitalize, checkMemberStatus,
  createPointRecord, getOrCreateUser, getDownloadConfig,
  addPoints, checkInviteValid, recordInviteAction
}
