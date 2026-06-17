/**
 * 管理接口认证中间件
 * 统一管理 API Key 验证，避免各路由文件重复定义
 */

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
const IS_PROD = process.env.NODE_ENV === 'production';

if (IS_PROD && !ADMIN_API_KEY) {
  console.error('⚠️ ADMIN_API_KEY 未设置！管理接口将无法使用。请在 .env 中配置。');
}

function requireAdmin(req, res, next) {
  // 开发模式且未配置 key 时放行
  if (!IS_PROD && !ADMIN_API_KEY) return next();
  if (!ADMIN_API_KEY) return next();

  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  if (!apiKey || apiKey !== ADMIN_API_KEY) {
    return res.status(403).json({
      retcode: 403,
      retdesc: '管理权限验证失败',
      data: null,
      succ: false,
    });
  }
  next();
}

module.exports = { requireAdmin };
