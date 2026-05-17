# 更新日志

## 2026-04-25 ~ 04-26 — 性能优化 & Bug 修复

### 🚀 性能优化

**首页加载速度提升**
- 首页冷启动从 **1502ms → 265ms**（提升 83%）
- 二次打开走本地缓存，加载时间接近 **0ms**
- 实施 Stale-While-Revalidate 缓存策略（过期缓存立即返回 + 后台静默刷新）
- App.onLaunch 同步部分从 >100ms 降至 <30ms

**具体优化项：**

| 优化项 | 改动 |
|--------|------|
| getSystemInfoSync 全局缓存 | 5 次调用 → 1 次，缓存到 storageManager |
| Storage 缓存层 | 13 处同步 Storage 替换为缓存管理器 |
| 同步 API 异步化 | auth.js 19 处 + api.js + services 共数十处 getStorageSync/setStorageSync 改异步 |
| onLaunch 启动拆分 | 关键任务同步执行，非关键任务延迟 3 秒 |
| 开屏广告期间预热 | 广告展示时并行请求首页数据，Promise 复用避免重复请求 |
| 未用组件清理 | 验证并移除未引用的 channel-video 组件 |

### 🐛 Bug 修复

| Bug | 修复 |
|-----|------|
| getApp() 在 onLaunch 返回 undefined | api.js 空值保护，预热不再崩溃 |
| index.js 缺少 getFavoritesCount 导入 | 补充 import，修复真机 ReferenceError |
| profile.js 未使用的 getFavoritesCount 导入 | 清理死代码 |

### 📁 涉及文件

- `app.js` — 启动拆分 + 预热逻辑
- `pages/index/index.js` — 缓存渲染 + 预热复用 + 导入修复
- `pages/avatar/avatar.js` — storageManager 接入
- `pages/wallpaper/wallpaper.js` — storageManager 接入
- `pages/profile/profile.js` — storageManager 接入 + 导入清理
- `utils/api.js` — SWR 缓存 + 预热复用 + 空值保护
- `utils/auth.js` — 同步 API 全部异步化
- `utils/storageManager.js` — 新增：全局缓存管理器
- `services/favoritesService.js` — storageManager 接入
- `services/notificationService.js` — storageManager 接入
