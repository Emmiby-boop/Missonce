const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { key } = event || {}

    if (!key) {
      return { success: false, msg: '缺少 key 参数', data: null }
    }

    const res = await db.collection('config').where({ key }).limit(1).get()
    const item = (res.data && res.data[0]) || null

    return { success: true, msg: 'ok', data: item }
  } catch (e) {
    return { success: false, msg: e.message || '查询失败', data: null }
  }
}