/**
 * 共享管理员鉴权模块
 * 
 * 使用方式:
 *   const { requireAdmin } = require('../shared/adminAuth')
 *   const auth = await requireAdmin(db, openid)
 *   if (!auth.isAdmin) return auth.response
 */

/**
 * 验证调用者是否为管理员
 * @param {Object} db - 云数据库实例
 * @param {String} callerOpenid - 调用者 openid
 * @returns {Object} { isAdmin, response? }
 */
async function verifyAdmin(db, callerOpenid) {
  if (!callerOpenid) {
    return {
      isAdmin: false,
      response: { success: false, message: '未登录' }
    }
  }

  try {
    const res = await db.collection('admins')
      .where({ _openid: callerOpenid })
      .count()
    
    if (res.total === 0) {
      return {
        isAdmin: false,
        response: { success: false, message: '权限不足，仅管理员可执行此操作' }
      }
    }
    return { isAdmin: true }
  } catch (e) {
    return {
      isAdmin: false,
      response: { success: false, message: '鉴权失败' }
    }
  }
}

/**
 * 强制管理员鉴权（非管理员直接返回错误响应）
 * @param {Object} db - 云数据库实例
 * @param {String} callerOpenid - 调用者 openid
 * @returns {Object} 鉴权通过返回 { isAdmin: true }，失败返回 { response: {...} }
 */
async function requireAdmin(db, callerOpenid) {
  return verifyAdmin(db, callerOpenid)
}

/**
 * 检查 admins 集合是否为空（用于首次引导创建管理员）
 * @param {Object} db - 云数据库实例
 * @returns {boolean}
 */
async function isAdminsCollectionEmpty(db) {
  try {
    const res = await db.collection('admins').count()
    return res.total === 0
  } catch (e) {
    console.error('检查管理员集合失败:', e)
    return false
  }
}

module.exports = {
  verifyAdmin,
  requireAdmin,
  isAdminsCollectionEmpty
}
