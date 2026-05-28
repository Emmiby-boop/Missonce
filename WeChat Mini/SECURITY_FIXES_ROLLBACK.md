# 🔙 安全修复回滚指南

**修复日期**: 2026-05-17  
**备份**: Git stash `pre-security-fixes-backup`  

---

## 快速回滚（恢复到修复前状态）

### 方法 1: Git Stash 恢复（推荐）

```bash
cd "D:\Missonce\Missonce"
git stash pop stash@{0}
# 注意：这会恢复修复前的所有未提交更改
```

### 方法 2: 逐个文件回滚

如果只想回滚特定文件，从 Git stash 中恢复：

```bash
cd "D:\Missonce\Missonce"

# 回滚单个文件
git checkout stash@{0} -- "WeChat Mini/cloudfunctions/addAdmin/index.js"
git checkout stash@{0} -- "WeChat Mini/cloudfunctions/deleteResource/index.js"
git checkout stash@{0} -- "WeChat Mini/cloudfunctions/batchDeleteResources/index.js"
git checkout stash@{0} -- "WeChat Mini/cloudfunctions/manageConfig/index.js"
git checkout stash@{0} -- "WeChat Mini/cloudfunctions/adminAuth/index.js"
git checkout stash@{0} -- "WeChat Mini/cloudfunctions/adminAuth/package.json"
git checkout stash@{0} -- "WeChat Mini/cloudfunctions/sendEmail/index.js"
git checkout stash@{0} -- "WeChat Mini/cloudfunctions/operationsAssistant/index.js"
git checkout stash@{0} -- "WeChat Mini/cloudfunctions/proxyDownload/index.js"
git checkout stash@{0} -- "WeChat Mini/config/database_rules.json"
```

---

## 修改清单

### 新增文件
| 文件 | 说明 |
|------|------|
| `cloudfunctions/shared/adminAuth.js` | 共享管理员鉴权模块 |

### 修改文件
| 文件 | 修改类型 | 说明 |
|------|----------|------|
| `cloudfunctions/addAdmin/index.js` | 🔒 鉴权 | 添加管理员身份验证（首次初始化除外） |
| `cloudfunctions/deleteResource/index.js` | 🔒 鉴权 | 添加管理员身份验证 |
| `cloudfunctions/batchDeleteResources/index.js` | 🔒 鉴权 | 添加管理员身份验证 |
| `cloudfunctions/manageConfig/index.js` | 🔒 鉴权 | 读操作公开，写操作需管理员 |
| `cloudfunctions/adminAuth/index.js` | 🔒 升级 | SHA256→bcrypt 密码迁移（向后兼容） |
| `cloudfunctions/adminAuth/package.json` | 📦 依赖 | 新增 `bcryptjs` |
| `cloudfunctions/sendEmail/index.js` | 🔒 移除 | 硬编码凭据→环境变量 + 频率限制 |
| `cloudfunctions/operationsAssistant/index.js` | 🔒 鉴权 | 所有操作需管理员验证 |
| `cloudfunctions/proxyDownload/index.js` | 🔒 限制 | 添加域名白名单 |
| `config/database_rules.json` | 🛡️ 规则 | 扩展至 20 个集合 |

---

## 📋 部署前必须完成的配置

### 1. 安装 bcryptjs 依赖

在微信开发者工具中，右键 `cloudfunctions/adminAuth` → 上传并部署（云端安装依赖）。

或在项目根目录执行：
```bash
cd "D:\Missonce\Missonce\WeChat Mini\cloudfunctions\adminAuth"
npm install
```
然后上传云函数。

### 2. 设置 sendEmail 环境变量

在微信云开发控制台 → 云函数 → sendEmail → 编辑 → 环境变量：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `SMTP_HOST` | `smtp.mail.me.com` | iCloud SMTP 服务器 |
| `SMTP_PORT` | `587` | SMTP 端口 |
| `SMTP_USER` | `emmiby@icloud.com` | 发件邮箱 |
| `SMTP_PASS` | ⚠️ 新的 App 专用密码 | 旧密码已撤销，需重新生成 |

> ⚠️ **重要**: 旧密码已暴露在代码历史中。请立即：
> 1. 登录 https://appleid.apple.com
> 2. 登录和安全 → App 专用密码 → 撤销旧密码
> 3. 生成新的 App 专用密码并设置为环境变量

### 3. 密码迁移说明

- 旧管理员密码（SHA256）在首次登录成功后将**自动升级**为 bcrypt
- 无需手动操作，迁移是透明的
- 建议所有管理员尽快登录一次以触发迁移

### 4. 数据库安全规则

更新 `config/database_rules.json` 后，在云开发控制台 → 数据库 → 安全规则 中更新。

---

## ⚠️ 注意事项

1. **首次管理员创建**: `addAdmin` 在 `admins` 集合为空时允许直接创建（首次初始化引导），之后需要已有管理员鉴权
2. **proxyDownload 白名单**: 如果前端使用了不在白名单内的图源，需要添加到 `ALLOWED_DOMAINS`
3. **错误消息**: 所有云函数的错误消息现在统一隐藏内部细节（返回 `操作失败，请稍后重试`），详情仅记录在云函数日志中
