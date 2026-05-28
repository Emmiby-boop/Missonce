// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    // 批量删除该用户的所有下载记录
    const result = await db.collection('downloads').where({
      _openid: openid
    }).remove()

    return {
      success: true,
      removed: result.stats.removed,
      msg: '下载记录已清空'
    }
  } catch (err) {
    console.error('清空下载记录失败:', err)
    return {
      success: false,
      error: err
    }
  }
}
