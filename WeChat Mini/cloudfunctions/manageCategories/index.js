/**
 * manageCategories - 分类/标签管理（仅限 categories / tags 集合）
 *
 * 安全说明：原前端 utils/api.js 的 manageCategories 接受客户端传入的任意集合名，
 * 可对数据库内任意集合执行增删改。本云函数将集合名限制在白名单内，杜绝「任意集合写代理」。
 */

const cloud = require('wx-server-sdk')
const { withAdmin } = require('./withAdmin.js')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const ALLOWED = new Set(['categories', 'tags'])

exports.main = withAdmin(async (event, context, admin) => {
  try {
    const { action, data } = event || {}
    const { collection: colName, id, item, ids } = data || {}

    if (!ALLOWED.has(colName)) {
      return { success: false, message: '不允许操作的集合: ' + colName }
    }
    const col = db.collection(colName)

    switch (action) {
      case 'create':
        return { success: true, data: await col.add({
          data: { ...(item || {}), createdAt: db.serverDate(), updatedAt: db.serverDate() }
        }) }
      case 'update':
        if (!id) return { success: false, message: '缺少 id' }
        return { success: true, data: await col.doc(id).update({
          data: { ...(item || {}), updatedAt: db.serverDate() }
        }) }
      case 'delete':
        if (!id) return { success: false, message: '缺少 id' }
        await col.doc(id).remove()
        return { success: true }
      case 'batchDelete':
        if (!Array.isArray(ids) || ids.length === 0) return { success: false, message: '缺少 ids' }
        if (ids.length > 100) return { success: false, message: '单次批量上限 100 条' }
        await Promise.all(ids.map(i => col.doc(i).remove()))
        return { success: true }
      default:
        return { success: false, message: '未知操作: ' + action }
    }
  } catch (e) {
    return { success: false, message: e.message || '服务器错误' }
  }
})
