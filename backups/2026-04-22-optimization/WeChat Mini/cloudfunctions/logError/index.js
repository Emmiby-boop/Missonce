// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { type, message, detail, deviceInfo, page } = event

  try {
    return await db.collection('error_logs').add({
      data: {
        openid: wxContext.OPENID,
        type: type || 'error', // error, warning, info
        message: message || '未知错误',
        detail: detail || {},
        deviceInfo: deviceInfo || {}, // 客户端设备信息
        page: page || '',
        timestamp: Date.now(),
        createTime: db.serverDate(),
        env: wxContext.ENV
      }
    })
  } catch (e) {
    console.error(e)
    return {
      success: false,
      errMsg: e
    }
  }
}