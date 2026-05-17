# 🔐 安全审计报告 — 小辣椒动态头像壁纸 微信小程序

**审计日期**: 2026-05-17  
**审计范围**: 全项目（前端小程序 + 云函数）  
**审计标准**: OWASP Top 10:2021  

---

## 📊 总览

| 等级 | 数量 | 说明 |
|------|------|------|
| 🔴 Critical | 5 | 必须立即修复 |
| 🟠 High | 4 | 应尽快修复 |
| 🟡 Medium | 5 | 建议修复 |
| 🟢 Low | 3 | 可后续优化 |

---

## 🔴 CRITICAL（严重 — 必须立即修复）

### 1. [A02:凭据泄露] iCloud App 专用密码硬编码在源代码中

**文件**: `cloudfunctions/sendEmail/index.js:16`  
**风险**: 任何能访问代码仓库的人都可以读取该密码，发送/读取 iCloud 邮件

```javascript
// ❌ 当前代码
const MAIL_CONFIG = {
  host: 'smtp.mail.me.com',
  port: 587,
  user: 'emmiby@icloud.com',
  pass: 'eybw-sgwu-lkfi-isod'  // ⚠️ App专用密码明文暴露！
}
```

**修复**: 立即在 Apple ID 管理页面撤销此 App 专用密码，改用云函数环境变量

```javascript
// ✅ 修复方案
const MAIL_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.mail.me.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS  // 从云函数环境变量读取
}
```

⚠️ **此密码已在此审计报告中暴露，必须立即轮换！**

---

### 2. [A01:权限缺失] addAdmin 云函数无任何鉴权

**文件**: `cloudfunctions/addAdmin/index.js`  
**风险**: 任何用户都可以调用此函数将自己设为 super_admin，从而完全控制后台

```javascript
// ❌ 当前代码：直接添加管理员，无任何身份验证
exports.main = async (event, context) => {
  const uid = event.uid || wxContext.UID || wxContext.OPENID
  // ... 直接插入 admins 集合，role: 'super_admin'
}
```

**修复**:
```javascript
// ✅ 添加调用者身份验证（仅允许已有管理员添加新管理员）
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const callerOpenid = wxContext.OPENID
  
  // 验证调用者是否为现有管理员
  const adminCheck = await db.collection('admins')
    .where({ openid: callerOpenid, role: 'super_admin' }).count()
  if (adminCheck.total === 0) {
    return { success: false, message: '权限不足' }
  }
  // ... 继续添加逻辑
}
```

---

### 3. [A01:权限缺失] deleteResource / batchDeleteResources 无鉴权

**文件**: `cloudfunctions/deleteResource/index.js`, `cloudfunctions/batchDeleteResources/index.js`  
**风险**: 任何用户都可以通过调用云函数删除任意资源（包括他人上传的）

**修复**: 添加管理员身份验证（同 #2 模式）

---

### 4. [A01:权限缺失] manageConfig 无鉴权 — 任何人都可读写系统配置

**文件**: `cloudfunctions/manageConfig/index.js`  
**风险**: 任何用户可读取/修改/删除全局系统配置，包括分类白名单、标签白名单等核心配置

**修复**: 添加管理员身份验证；对于 `get` 操作可放宽为登录用户，但 `set`/`delete` 必须管理员

---

### 5. [A02:弱密码哈希] 管理员密码使用 SHA256（未加盐）

**文件**: `cloudfunctions/adminAuth/index.js:12`  
**风险**: SHA256 不适用于密码存储（无盐、计算快、易彩虹表攻击）

```javascript
// ❌ 当前代码
const CryptoJS = require('crypto-js')
const hashPassword = (pwd) => CryptoJS.SHA256(pwd).toString()
```

**修复**:
```javascript
// ✅ 使用 bcrypt（云函数环境可安装 bcryptjs）
const bcrypt = require('bcryptjs')
const SALT_ROUNDS = 12

const hashPassword = async (pwd) => bcrypt.hash(pwd, SALT_ROUNDS)
const verifyPassword = async (pwd, hash) => bcrypt.compare(pwd, hash)
```

⚠️ 迁移时需对所有现有管理员密码重新哈希。

---

## 🟠 HIGH（高危 — 应尽快修复）

### 6. [A02:Token安全] Token 不是 JWT — 无过期、无签名验证

**文件**: `cloudfunctions/login/index.js:106`  
**风险**: Token 是纯随机字符串。服务端无法验证 Token 有效性/是否过期，无法区分不同实例生成的 Token

```javascript
// ❌ 当前
const token = crypto.randomBytes(32).toString('hex')
```

**修复**: 使用标准 JWT 或至少加入时间戳 + 签名验证。若无服务端 Token 验证逻辑，当前架构风险有限，但建议后续加入过期机制。

---

### 7. [A01:缺少速率限制] 登录/验证码接口无限速

**文件**: `cloudfunctions/adminAuth/index.js` (verifyEmail), `cloudfunctions/sendEmail/index.js`  
**风险**: 攻击者可暴力破解验证码（6位数字仅100万种组合）或滥用邮件发送功能

**修复**: 使用云开发数据库实现简单的速率限制：
- 同一邮箱 1 分钟内最多发送 1 次验证码
- 同一邮箱 5 分钟内最多尝试 5 次验证
- 同一 IP/OpenID 每小时最多请求 10 次

---

### 8. [A01:权限缺失] operationsAssistant 无鉴权 — 数据面板暴露

**文件**: `cloudfunctions/operationsAssistant/index.js`  
**风险**: 任何用户可查看全站统计数据（用户数、下载量、热门资源、趋势预测等），即完整的运营看板

**修复**: 所有 action 均需管理员身份验证

---

### 9. [A05:配置不一致] 环境 ID 不一致

**文件**: `config/constants.js:44` vs `app.js:46`

```javascript
// constants.js
export const ENV_ID = 'prod-2gfd169w229986b8'

// app.js
wx.cloud.init({ env: 'missonce-99-1gfaff6n002f6ac1', ... })
```

**风险**: 如果前端引用 constants.js 的 ENV_ID 而非正确环境，可能导致数据写入错误环境

**修复**: 统一环境 ID 来源，建议仅在 app.js 中定义

---

## 🟡 MEDIUM（中危 — 建议修复）

### 10. [A03:SSRF] proxyDownload 可作为开放代理被滥用

**文件**: `cloudfunctions/proxyDownload/index.js`  
**风险**: 可下载任意 URL 的内容到云存储，被用于代理攻击、违禁内容中转

**修复**: 添加 URL 白名单或域名限制，仅允许已知图源域名

```javascript
// ✅ 添加域名白名单
const ALLOWED_DOMAINS = [
  'example-cdn.com',
  'your-image-source.com'
]
const parsedUrl = new URL(url)
if (!ALLOWED_DOMAINS.some(d => parsedUrl.hostname.endsWith(d))) {
  return { success: false, message: '不允许的域名' }
}
```

---

### 11. [A03:ReDoS] findResourceByUrl 中的用户输入直接拼接正则

**文件**: `utils/api.js:findResourceByUrl`  
**风险**: 用户提供的 URL 片段被直接用于构建正则表达式，可能被精心构造的输入触发 ReDoS

```javascript
// ❌
const escapedFilename = filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
conditions.push({ coverUrl: db.RegExp({ regexp: escapedFilename + '$', options: 'i' }) })
```

**修复**: 限制 filename 长度，或使用 `.where({ coverUrl: db.RegExp({ regexp: '.{0,100}' + shortName + '$' }) })` 限制匹配范围

---

### 12. [A05:配置不完整] 数据库安全规则不完整

**文件**: `config/database_rules.json`  
**风险**: 仅在 6 个集合上设置了安全规则，但项目使用了 `resources`, `users`, `categories`, `tags`, `config`, `browse_history`, `likes`, `admins`, `verify_codes`, `events`, `sys_config` 等大量集合，大部分未受保护

**修复**: 为所有集合添加安全规则，至少覆盖 `admins`, `config`, `sys_config`, `events`

---

### 13. [A05:信息泄露] 错误消息暴露实现细节

**文件**: 多个云函数  
**风险**: 云函数返回原始 `error.message` 给客户端，泄露内部错误详情

```javascript
// ❌ 多处存在
return { success: false, message: error.message || '失败' }
```

**修复**: 生产环境统一返回 "操作失败，请稍后重试"，详细错误仅记录在云函数日志中

---

### 14. [A04:缺少输入验证] 云函数参数未校验

**文件**: 多个云函数  
**风险**: `title`, `category`, `tags` 等用户输入未经校验直接写入数据库，可能导致脏数据或注入

**修复**: 至少验证类型、长度限制、XSS过滤：
- `title`: 类型字符串，长度 ≤ 100
- `tags`: 数组，每项 ≤ 20 字符
- `category`: 字符串，在白名单内

---

### 15. [A07:XSS风险] 前端 userInfo 渲染未转义

**文件**: `pages/profile/profile.wxml`, `subpackages/*/`  
**风险**: 微信小程序中 `{{nickName}}` 默认转义，但若使用 `rich-text` 组件或 `wxParse` 插件可能有 XSS 风险

**缓解**: 微信小程序的 WXML 数据绑定默认 HTML 转义，风险较低，但避免使用 `rich-text` 渲染用户输入

---

## 🟢 LOW（低危 — 可后续优化）

### 16. 未使用的配置值

`config/constants.js:ENV_ID` 定义后可能未被引用，建议清理或确保统一使用

### 17. 生产环境大量 console.log

多个云函数和前端文件中存在详细 `console.log`，生产环境建议使用日志级别控制或条件日志

### 18. 依赖未审计

`package.json` 仅声明少量依赖，`cloudfunctions/sendEmail` 和 `getContactConfig` 有独立 `package-lock.json`，建议定期 `npm audit`

---

## 🛡️ 安全修复优先级路线图

### Phase 1 — 立即执行（今天）
1. 🔴 轮换 iCloud App 专用密码 → 使用环境变量
2. 🔴 为 `addAdmin`、`deleteResource`、`batchDeleteResources`、`manageConfig` 添加管理员鉴权

### Phase 2 — 本周内
3. 🔴 迁移 `adminAuth` 密码哈希从 SHA256 → bcrypt
4. 🟠 为 `operationsAssistant` 添加鉴权
5. 🟠 添加登录/验证码速率限制

### Phase 3 — 本迭代
6. 🟠 统一环境 ID 配置
7. 🟡 `proxyDownload` 添加域名白名单
8. 🟡 完善数据库安全规则
9. 🟡 统一错误消息格式
10. 🟡 添加输入参数校验

### Phase 4 — 后续优化
11. 🟠 JWT Token 标准化
12. 🟢 生产日志优化
13. 🟢 依赖安全审计

---

## 📋 数据库安全规则补充建议

```json
{
  "admins": {
    "read": "doc._openid == auth.openid",
    "write": false
  },
  "config": {
    "read": true,
    "write": false
  },
  "sys_config": {
    "read": true,
    "write": false
  },
  "events": {
    "read": "doc._openid == auth.openid",
    "write": "doc._openid == auth.openid"
  },
  "verify_codes": {
    "read": false,
    "write": false
  },
  "resources": {
    "read": true,
    "write": false
  },
  "users": {
    "read": "doc._openid == auth.openid",
    "write": "doc._openid == auth.openid"
  }
}
```

> ⚠️ 注意：云函数中使用服务端 SDK 时会绕过安全规则，因此**必须**在云函数中自行实现鉴权。数据库安全规则主要防御直接的客户端数据库操作。

---

*审计依据: OWASP Top 10:2021 · OWASP API Security Top 10 · 微信小程序安全规范*
