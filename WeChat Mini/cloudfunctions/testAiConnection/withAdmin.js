/**
 * withAdmin - 统一鉴权高阶函数（同步副本）
 *
 * 来源：manageTopics/withAdmin.js（唯一数据源）。微信云函数部署时独立上传，
 * 无法跨目录 require，所以这里是一份同步副本。
 *
 * 用法：
 *   exports.main = withAdmin(async (event, context, admin) => { ... })
 *
 * 校验逻辑：
 *   - 优先通过 adminToken 调 adminAuth.verifyToken（Web/小程序后台已登录场景）
 *   - 兼容通过 openid 查 admins 集合（小程序端管理员调用）
 */

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 校验调用者是否为管理员
 * 优先通过 adminSession Token 校验（适用于 Web 后台 / 小程序管理端）
 * 兼容通过 openid 查询 admins 集合（适用于小程序端管理员调用）
 */
async function verifyCaller(event, context) {
  const wxContext = cloud.getWXContext()
  const callerOpenid = wxContext.OPENID

  // 路径 1：通过 adminAuth Token 校验（Web/小程序后台调用）
  if (event.adminToken) {
    try {
      const tokenRes = await cloud.callFunction({
        name: 'adminAuth',
        data: { action: 'verifyToken', token: event.adminToken }
      })
      if (tokenRes.result && tokenRes.result.success) {
        return tokenRes.result.data.admin
      }
    } catch (e) {
      console.warn('[withAdmin] Token 校验失败，降级到 openid 校验:', e.message)
    }
  }

  // 路径 2：通过 openid 查询 admins 集合（小程序端管理员调用）
  if (!callerOpenid) {
    return null
  }

  try {
    const res = await db.collection('admins')
      .where({ _openid: callerOpenid })
      .limit(1)
      .get()
    if (res.data && res.data.length > 0) {
      return res.data[0]
    }
  } catch (e) {
    console.error('[withAdmin] 查询 admins 集合失败:', e.message)
  }

  return null
}

/**
 * 高阶函数：包裹 handler，自动注入管理员鉴权
 * @param {Function} handler - 业务处理函数 (event, context, admin) => result
 * @param {Object} options
 *   - exclude: string[] 不需鉴权的 action 列表
 *   - requireRole: string[] 允许的角色列表（如 ['super_admin']）
 */
function withAdmin(handler, options = {}) {
  const { exclude = [], requireRole = null } = options

  return async (event, context) => {
    // 排除不需鉴权的 action
    if (event && event.action && exclude.includes(event.action)) {
      return handler(event, context, null)
    }

    // 校验调用者身份
    const admin = await verifyCaller(event, context)
    if (!admin) {
      return {
        success: false,
        code: 'UNAUTHORIZED',
        message: '权限不足，请使用管理员账号登录'
      }
    }

    // 角色校验
    if (requireRole && !requireRole.includes(admin.role || 'admin')) {
      return {
        success: false,
        code: 'FORBIDDEN',
        message: '权限等级不足'
      }
    }

    // 通过鉴权，执行业务逻辑
    return handler(event, context, admin)
  }
}

module.exports = { withAdmin, verifyCaller }
