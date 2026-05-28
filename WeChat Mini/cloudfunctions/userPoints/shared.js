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

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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
    console.error('创建积分记录失败:', e)
  }
}

async function getOrCreateUser(openid) {
  const userRes = await db.collection('user_points').where({ _openid: openid }).limit(1).get()
  if (userRes.data.length > 0) return userRes.data[0]

  const now = new Date()
  const user = {
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
  return user
}

module.exports = {
  db, _, MEMBER_CONFIG, POINTS_CONFIG,
  formatDate, capitalize, checkMemberStatus,
  createPointRecord, getOrCreateUser
}
