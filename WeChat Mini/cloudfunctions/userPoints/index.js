const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { checkIn } = require('./actions/checkIn')
const { addPoints, deductPoints, getRecords } = require('./actions/points')
const { exchangeMember, getMemberStatus } = require('./actions/member')
const { recordDownload, getDownloadStatus, canDownload } = require('./actions/download')
const { getInviteStatus, bindInviter, getInviteRecords } = require('./actions/invite')
const { exchangeDownloads, getExchangeOptions, rewardAdWatch } = require('./actions/exchange')
const { getUserInfo, getConfigs } = require('./actions/userInfo')

const ACTIONS = {
  getUserInfo, checkIn, deductPoints, addPoints, getRecords,
  exchangeMember, getMemberStatus, recordDownload, getConfigs,
  getDownloadStatus, canDownload, getInviteStatus, bindInviter,
  getInviteRecords, exchangeDownloads, getExchangeOptions, rewardAdWatch
}

exports.main = async (event, context) => {
  const { action } = event
  const openid = cloud.getWXContext().OPENID

  if (!openid) {
    return { success: false, error: '用户未登录' }
  }

  const handler = ACTIONS[action]
  if (!handler) {
    return { success: false, error: '无效的 action' }
  }

  try {
    return await handler(openid, event)
  } catch (e) {
    console.error('云函数执行失败:', e)
    return { success: false, error: e.message }
  }
}
