const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// HMAC-SHA256 签名密钥（生产环境建议通过环境变量注入）
// 可在云函数环境变量中设置 SESSION_SECRET 覆盖默认值
const SECRET = process.env.SESSION_SECRET
if (!SECRET) {
  throw new Error('SESSION_SECRET environment variable is required. Set it in CloudBase console.')
}

// Token 有效期：24 小时（毫秒）
const TOKEN_TTL = 24 * 60 * 60 * 1000

/**
 * HMAC-SHA256 签名
 */
function sign(data) {
  return crypto
    .createHmac('sha256', SECRET)
    .update(data)
    .digest('hex')
}

/**
 * 生成管理员 Session Token
 *
 * 格式: ${adminId}.${timestamp}.${signature}
 * signature = HMAC-SHA256(adminId + "." + timestamp, SECRET)
 *
 * 返回给前端的 token 中包含签名，前端无法伪造
 */
function generateToken(adminId) {
  const timestamp = Date.now()
  const payload = `${adminId}.${timestamp}`
  const signature = sign(payload)

  return {
    token: `${payload}.${signature}`,
    expiresAt: timestamp + TOKEN_TTL,
    adminId
  }
}

/**
 * 验证 Token 有效性
 *
 * 检查项：
 * 1. 格式是否正确（三段式）
 * 2. 签名是否匹配（防止篡改）
 * 3. 是否过期（默认 24h）
 *
 * 验证通过后从数据库查询完整 admin 信息返回
 */
async function verifyAndGetAdmin(db, token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'TOKEN_EMPTY' }
  }

  const parts = token.split('.')
  if (parts.length !== 3) {
    return { valid: false, reason: 'TOKEN_FORMAT_INVALID' }
  }

  const [adminId, timestampStr, providedSignature] = parts

  // 重构 payload 并验证签名
  const payload = `${adminId}.${timestampStr}`
  const expectedSignature = sign(payload)

  if (providedSignature !== expectedSignature) {
    return { valid: false, reason: 'TOKEN_SIGNATURE_MISMATCH' }
  }

  // 检查过期时间
  const timestamp = parseInt(timestampStr, 10)
  if (isNaN(timestamp)) {
    return { valid: false, reason: 'TOKEN_TIMESTAMP_INVALID' }
  }

  if (Date.now() - timestamp > TOKEN_TTL) {
    return { valid: false, reason: 'TOKEN_EXPIRED' }
  }

  // 签名和时间都有效，查询 admin 信息
  try {
    // 支持 _id 或自定义 uid 作为标识
    let adminRes
    if (adminId.match(/^[a-f0-9]{24}$/i)) {
      // MongoDB ObjectId 格式，用 _id 查询
      adminRes = await db.collection('admins').doc(adminId).get()
    } else {
      // 其他格式用字段查询
      adminRes = await db.collection('admins').where({
        _id: adminId
      }).get()
    }

    if (!adminRes.data || adminRes.data.length === 0) {
      return { valid: false, reason: 'ADMIN_NOT_FOUND' }
    }

    const admin = adminRes.data[0] || adminRes.data

    // 检查账号是否被禁用
    if (admin.status === 'disabled' || admin.status === 'banned') {
      return { valid: false, reason: 'ADMIN_DISABLED' }
    }

    return {
      valid: true,
      admin: {
        _id: admin._id,
        username: admin.username,
        role: admin.role || 'admin',
        phone: admin.phone || '',
        email: admin.email || '',
        createdAt: admin.createdAt,
        // 不返回 password、openid 等敏感字段
      }
    }
  } catch (err) {
    console.error('[adminSession] 查询 admin 失败:', err)
    return { valid: false, reason: 'DB_ERROR', error: err.message }
  }
}

exports.main = async (event, context) => {
  const db = cloud.database()
  const { action, token, adminId } = event

  switch (action) {
    // --------------------------------------------------
    // 生成 Token（登录成功后调用）
    // --------------------------------------------------
    case 'generateToken': {
      if (!adminId) {
        return { success: false, message: '缺少 adminId 参数' }
      }

      const result = generateToken(adminId)

      console.log(`[adminSession] Token generated for admin: ${adminId}`)

      return {
        success: true,
        data: result
      }
    }

    // --------------------------------------------------
    // 验证 Token（路由守卫/鉴权时调用）
    // --------------------------------------------------
    case 'verifyToken': {
      if (!token) {
        return { success: false, message: '缺少 token 参数', reason: 'TOKEN_MISSING' }
      }

      const result = await verifyAndGetAdmin(db, token)

      if (!result.valid) {
        console.warn(`[adminSession] Token verification failed:`, result.reason)
        return {
          success: false,
          message: getFailMessage(result.reason),
          reason: result.reason
        }
      }

      return {
        success: true,
        data: {
          admin: result.admin,
          // 返回剩余有效时间（秒），方便前端做续期提示
          expiresIn: Math.floor((result.expiresAt || 0 - Date.now()) / 1000)
        }
      }
    }

    // --------------------------------------------------
    // 刷新 Token（快过期时获取新 token）
    // --------------------------------------------------
    case 'refreshToken': {
      if (!token) {
        return { success: false, message: '缺少 token 参数' }
      }

      // 先验证旧 token
      const checkResult = await verifyAndGetAdmin(db, token)
      if (!checkResult.valid) {
        return {
          success: false,
          message: getFailMessage(checkResult.reason),
          reason: checkResult.reason
        }
      }

      // 生成新 token
      const newToken = generateToken(checkResult.admin._id)

      console.log(`[adminSession] Token refreshed for admin: ${checkResult.admin._id}`)

      return {
        success: true,
        data: newToken
      }
    }

    default:
      return { success: false, message: `未知 action: ${action}` }
  }
}

/**
 * 根据失败原因返回用户友好的消息
 */
function getFailMessage(reason) {
  const messages = {
    'TOKEN_EMPTY': '登录凭证为空',
    'TOKEN_FORMAT_INVALID': '登录凭证格式无效',
    'TOKEN_SIGNATURE_MISMATCH': '登录凭证无效',
    'TOKEN_TIMESTAMP_INVALID': '登录凭证时间戳无效',
    'TOKEN_EXPIRED': '登录已过期，请重新登录',
    'ADMIN_NOT_FOUND': '账号不存在或已被删除',
    'ADMIN_DISABLED': '账号已被禁用',
    'DB_ERROR': '系统错误，请稍后重试',
    'TOKEN_MISSING': '未提供登录凭证'
  }
  return messages[reason] || '认证失败'
}
