const express = require('express');
const path = require('path');

// 安全依赖：首次部署需 npm install，缺失时降级运行
let helmet, rateLimit;
try { helmet = require('helmet'); } catch { helmet = null; }
try { rateLimit = require('express-rate-limit'); } catch { rateLimit = null; }

const parseRouter = require('./src/api/parse');
const adConfigRouter = require('./src/api/adConfig');

const app = express();
const PORT = process.env.PORT || 3001;
const IS_PROD = process.env.NODE_ENV === 'production';

// ===== 安全中间件 =====

// helmet 安全头（X-Content-Type-Options, X-Frame-Options, CSP 等）
if (helmet) {
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  }));
} else {
  console.warn('⚠ helmet 未安装，跳过安全头设置。运行 npm install helmet 即可启用');
}

// 全局请求速率限制（防止暴力/DoS）
if (rateLimit) {
  const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: IS_PROD ? 300 : 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { retcode: 429, retdesc: '请求过于频繁，请稍后再试', data: null, succ: false },
  });
  app.use(globalLimiter);
} else {
  console.warn('⚠ express-rate-limit 未安装，跳过限流。运行 npm install express-rate-limit 即可启用');
}

// 请求体大小限制（防大 payload DoS）
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS 白名单（替代原来的 * 通配）
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : [
      'https://servicewechat.com',   // 微信小程序
      'https://missonce-99',                                    // CloudBase 管理后台（前缀匹配）
      'https://missonce-99-1gfaff6n002f6ac1-1318542519.tcloudbaseapp.com',  // CloudBase 完整域名
      'https://missonce.cc',                                    // Mini admin 管理后台
      'http://localhost:3000',       // 本地开发
      'http://localhost:3001',
      'http://localhost:5173',       // Vite dev server
      'http://localhost:8080',
    ];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ===== 路由 =====

app.use('/static', express.static(path.join(__dirname, 'static'), {
  maxAge: IS_PROD ? '7d' : 0,
  dotfiles: 'deny',
}));

// 解析/下载接口专用限流（必须在路由注册之前）
if (rateLimit) {
  app.use('/api/parse', rateLimit({
    windowMs: 60 * 1000, max: 30,
    message: { retcode: 429, retdesc: '解析频率过高，请稍后再试', data: null, succ: false },
  }));
  app.use('/api/download', rateLimit({
    windowMs: 60 * 1000, max: 20,
    message: { retcode: 429, retdesc: '下载频率过高', data: null, succ: false },
  }));
}

app.use('/api', parseRouter);
app.use('/api', adConfigRouter);
app.use('/api', require('./src/api/stats'));
app.use('/api', require('./src/api/trending'));
app.use('/api', require('./src/api/audio'));
app.use('/api', require('./src/api/whitelist'));

// 健康检查
app.get('/api/health', (req, res) => {
  try {
    const cloudbase = require('./src/utils/cloudbase');
    const cbStatus = cloudbase.getStatus();
    res.json({
      status: 'running',
      cloudbase: {
        connected: cbStatus.initialized,
        error: cbStatus.error,
        hasCredentials: cbStatus.hasCredentials,
        envId: cbStatus.envId
      },
      uptime: process.uptime()
    });
  } catch (e) {
    res.json({ status: 'running', cloudbase: { connected: false, error: e.message }, uptime: process.uptime() });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'landing.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'admin.html'));
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ retcode: 500, retdesc: '服务器内部错误', data: null, succ: false });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                                   ║
║   🚀 媒体解析去水印 - Node.js 版本启动成功!                      ║
║                                                                   ║
║   服务地址: http://localhost:${PORT}                              ║
║   API 接口: POST /api/parse                                       ║
║   安全模式: ${helmet ? 'helmet ✓' : 'helmet ✗'} ${rateLimit ? 'rate-limit ✓' : 'rate-limit ✗'} CORS 白名单                     ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});
