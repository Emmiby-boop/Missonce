const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const normalizePagePath = (path) => {
  if (!path) return ''
  let p = String(path).trim()
  if (p.startsWith('/')) p = p.slice(1)
  return p
}

exports.main = async (event) => {
  try {
    const { adId, pagePath } = event || {}

    if (!adId && !pagePath) {
      return { success: false, msg: '缺少 adId 或 pagePath 参数', data: null }
    }

    if (adId) {
      const res = await db.collection('adConfig').where({ adId }).limit(1).get()
      const item = (res.data && res.data[0]) || null
      return { success: true, msg: 'ok', data: item }
    }

    const normalized = normalizePagePath(pagePath)
    const res = await db.collection('adConfig').where({ pagePath: _.in([normalized, '/' + normalized]) }).get()
    return { success: true, msg: 'ok', data: res.data || [] }
  } catch (e) {
    return { success: false, msg: e.message || '查询失败', data: null }
  }
}
