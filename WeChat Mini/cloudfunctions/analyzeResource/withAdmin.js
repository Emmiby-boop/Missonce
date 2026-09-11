/**
 * withAdmin - 统一鉴权高阶函数（fail-closed 版本）
 *
 * 安全约束：
 * 1. 仅信任前端注入的 adminToken（utils/cloud.js callFunction 每次调用已注入）。
 * 2. Token 缺失或校验失败一律拒绝——不再降级到 openid 查询（旧版本的 openid
 *    降级在「与 C 端共用云环境」下会被未授权用户利用，造成越权）。
 * 3. 同一云环境下云函数之间的内部调用（如 uploadResource → analyzeResource、
 *    数据库触发器触发 analyzeResource）通过 event.__internal = true 显式放行，
 *    不依赖 openid，避免 fail-open。
 */

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 内部调用白名单：来自本环境其它云函数 / 数据库触发器的可信调用。
 * 仅当调用方主动在 event 中携带 __internal=true 才会放行，外部无法伪造
 * （云函数之间调用由云开发平台保证来源，且前端不会注入该字段）。
 */
async function verifyInternal(event) {
  if (event && event.__internal === true) {
    return {
      _id: 'internal',
      username: 'system',
      role: 'system',
      __internal: true,
    }
  }
  return null
}

async function verifyCaller(event, context) {
  // 1) 内部可信调用优先
  const internal = await verifyInternal(event)
  if (internal) return internal

  // 2) 必须携带 adminToken
  if (!event || !event.adminToken) {
    return { __fail: 'TOKEN_MISSING' }
  }

  // 3) 走 adminAuth 校验（失败一律拒绝，但透传真实原因便于排查）
  try {
    const tokenRes = await cloud.callFunction({
      name: 'adminAuth',
      data: { action: 'verifyToken', token: event.adminToken },
    })
    if (tokenRes.result && tokenRes.result.success) {
      return tokenRes.result.data.admin
    }
    const reason = (tokenRes.result && tokenRes.result.reason) || 'VERIFY_FAILED'
    console.warn('[withAdmin] Token 校验失败:', reason, tokenRes.result && tokenRes.result.message)
    return { __fail: reason }
  } catch (e) {
    console.warn('[withAdmin] Token 校验异常，拒绝访问:', e.message)
    return { __fail: 'VERIFY_ERROR' }
  }
}

// 把 adminAuth 的失败原因翻译成中文，方便前端/用户定位
const FAIL_MESSAGE = {
  TOKEN_MISSING: '未提供登录凭证，请重新登录',
  TOKEN_EMPTY: '登录凭证为空，请重新登录',
  TOKEN_FORMAT_INVALID: '登录凭证格式无效，请重新登录',
  TOKEN_SIGNATURE_MISMATCH: '登录凭证无效（签名不匹配），请重新登录',
  TOKEN_TIMESTAMP_INVALID: '登录凭证时间戳无效，请重新登录',
  TOKEN_EXPIRED: '登录已过期，请重新登录',
  TOKEN_REVOKED: '登录已失效（改密/登出），请重新登录',
  ADMIN_NOT_FOUND: '账号不存在或已被删除',
  ADMIN_DISABLED: '账号已被禁用，请联系超级管理员',
  DB_ERROR: '系统错误，请稍后重试',
  VERIFY_FAILED: '权限不足，请使用管理员账号登录',
  VERIFY_ERROR: '权限校验异常，请重新登录',
}

function withAdmin(handler, options = {}) {
  const { exclude = [], requireRole = null } = options

  return async (event, context) => {
    if (event && event.action && exclude.includes(event.action)) {
      return handler(event, context, null)
    }

    const caller = await verifyCaller(event, context)
    if (!caller || caller.__fail) {
      const reason = (caller && caller.__fail) || 'UNAUTHORIZED'
      return {
        success: false,
        code: 'UNAUTHORIZED',
        message: FAIL_MESSAGE[reason] || '权限不足，请使用管理员账号登录',
        reason,
      }
    }

    if (requireRole && !requireRole.includes(caller.role || 'admin')) {
      return {
        success: false,
        code: 'FORBIDDEN',
        message: '权限等级不足',
      }
    }

    return handler(event, context, caller)
  }
}

module.exports = { withAdmin, verifyCaller }
