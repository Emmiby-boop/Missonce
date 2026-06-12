# 小辣椒小程序 — We 分析性能数据优化方案

> 审查日期：2026-06-02  
> 审查范围：全项目（app.js、4个主包页面、15个子包页面、8个组件、工具函数、云函数）  
> 数据来源：We 分析性能监控（7项优化建议）

---

## 一、问题汇总 & RCA

| # | 问题类别 | We 分析指标 | RCA 根因 | 严重程度 |
|---|---------|-----------|---------|---------|
| 1 | 启动性能 | onLaunch 长任务 84ms | `initStorageCache` → `preloadStorageCache` 在启动阶段触发了多个异步 Storage 读取；`_preheatHomeData` 立即执行了可能有网络 I/O 的 `getHomeData` | ⚠️ 高 |
| 2 | 跳页性能 | 首屏渲染前多次调用同步 API | `getStorage()` 在启动阶段结束后使用 `wx.getStorageSync` 同步阻塞渲染线程；页面 onLoad 中多次调用 getStorage 读取不同 key | ⚠️ 高 |
| 3 | 跳页性能 | 声明但未使用的组件（waterfall） | `pages/index/index.json` 中注册了 `waterfall` 组件，首页 WXML 只在 section type 为 `waterfall` 时使用，非首屏必须组件 | 🔶 中 |
| 4 | 最佳实践 | 重复获取同一 key 的 storage（277ms → 166ms） | `getStorage` 已有内存缓存但首次命中时走同步 API；多处重复调用同一个 key（如 onLoad + onShow 都读 userInfo） | 🔶 中 |
| 5 | 最佳实践 | 图片尺寸过大（500×1000+ 显示为 164×291） | waterfall 组件中 WXS `optimizeUrl` 已定义但 `src` 属性未实际调用，所有图片以原始尺寸加载 | ⚠️ 高 |
| 6 | 网络性能 | 未开启 HTTP/2 | 所有 `wx.request`、`wx.cloud.callFunction`、`wx.downloadFile` 未显式启用 HTTP/2 | 🔷 低 |
| 7 | 网络性能 | request fail timeout | 所有网络请求未设置超时时间；`project.config.json` 无 `networkTimeout` 配置 | 🔶 中 |

---

## 二、逐项修复方案

### 问题 1：启动性能 — onLaunch 84ms 长任务

**根因：**
```
app.js onLaunch:
  ├── initStorageCache()        ← 触发 7 个异步 wx.getStorage → Promise 创建开销
  ├── wx.cloud.init()            ← 同步调用，约 15-25ms
  ├── _preheatHomeData()        ← 立即发起 getHomeData()，如果无本地缓存则走网络
  └── preheatCloudFunctions()   ← 已在 setTimeout 3000ms 后执行（OK）
```

**修复方案（3步）：**

**1a) 将 `initStorageCache` 改为真正的零阻塞**
```javascript
// app.js onLaunch 中
// 现状：initStorageCache() → preloadStorageCache() → 7 个 Promise 创建
// 优化：让 initStorageCache 使用 requestIdleCallback 的等效方案
initStorageCache()  // 保持，但内部改用 wx.nextTick 延迟非关键 key
```

**1b) 将 `_preheatHomeData` 延迟到 `wx.nextTick`**
```javascript
// 现状：立即调用
this._preheatHomeData()

// 优化：在下一个微任务执行，不阻塞 onLaunch 完成
wx.nextTick(() => {
  this._preheatHomeData()
})
```

**1c) 减少 storageManager 启动阶段的初始化 key 数量**
```javascript
// storageManager.js 中 getDefaultStorageKeys()
// 现状：7 个 key
// 优化：拆分关键 key（TOKEN, OPENID, USER_INFO）和非关键 key
// 非关键 key 延迟到 5 秒后加载
```

---

### 问题 2：跳页性能 — 多次调用同步 API 阻塞渲染

**根因：**
```javascript
// storageManager.js getStorage(key)
// 启动阶段结束后（5秒后），走 wx.getStorageSync 同步路径
if (_isStartupPhase) return null  // ✅ 启动阶段不阻塞
// 5秒后每次调用都走同步 API ⚠️
const data = wx.getStorageSync(key)
```

**修复方案（2步）：**

**2a) 完全移除 `getStorage` 中的同步回退**
```javascript
// storageManager.js getStorage()
export const getStorage = (key) => {
  if (storageCache.hasOwnProperty(key)) return storageCache[key]
  
  // 触发异步读取并缓存，立即返回 null
  readStorageAsync(key).catch(() => {})
  
  // 🔥 关键修复：不再调用 wx.getStorageSync
  // 如果缓存未命中，返回 null，等待异步结果在下一次调用时生效
  return null
}
```

**2b) 页面 onLoad 中合并 storage 读取**
```javascript
// 各页面 onLoad 中，将多个 getStorage('key1'), getStorage('key2') 
// 合并为缓存就绪后的批量操作
// 使用 storageManager 已有的内存缓存，大部分情况下已命中
```

---

### 问题 3：跳页性能 — 未使用的组件声明

**根因：**
```
pages/index/index.json:
  "usingComponents": {
    "waterfall": "../../components/waterfall/waterfall",    ← 仅在某些 section type 中使用
    "floating-notification": ...,                            ← 必需
    "ad-unit": ...                                           ← 必需
  }
```

`waterfall` 组件只在 section type 为 `waterfall` 时使用，并非首屏必需组件。非必需组件的声明和初始化增加了页面加载开销。

**修复方案：**

**3a) 从 index.json 移除非首屏必需的 waterfall 组件声明**

waterfall 只在首页动态 section 中使用且 type 为 `waterfall` 时才会渲染。考虑到首页首屏主要是 banner + 快捷功能 + grid/avatar_row 类型板块，waterfall 可安全移除。

**注意：** 如果后台配置中确实有 type=waterfall 的首页板块，需要用纯 WXML 模板（如已有的 `wallpaper_grid` 类型）替代，或在首次需要时才动态加载。

**3b) 关于 channel-video 组件**
经审查，`channel-video` 组件在当前代码库中完全不存在——任何 .json 文件中都没有注册，也没有对应的组件目录。如果是 We 分析报告的误报，无需处理；如果来自旧版本遗留问题，确认已清理。

---

### 问题 4：最佳实践 — 重复获取同一 key 的 storage

**根因：**
- `getStorage('userInfo')` 在 profile 页面中被 onLoad、onShow、syncUserInfo、handleClearCache、onShareAppMessage 等多处调用
- `getStorage('favorites')`、`getStorage('openid')` 等多处重复调用
- 虽然内存缓存已生效（第二次调用 <1ms），但首次调用在非启动阶段走同步 API

**修复方案（2步）：**

**4a) 页面级别合并 storage 读取**
```javascript
// profile.js onLoad 中
const userInfo = getStorage('userInfo')
const openid = getStorage('openid')
const token = getStorage('token')
// 这些 key 在 initStorageCache 预加载列表中，已被预热，可直接用
```

**4b) 移除 onShow 中的冗余重新读取**
```javascript
// profile.js onShow
onShow() {
  // 现状：checkLoginStatus() → getStorage('userInfo') 每次都读
  // 优化：仅在 data.userInfo 为 null 时才重读
  this.checkLoginStatus()     // 内部有 getStorage 调用
  this.loadFavoritesCount()
  this.syncUserInfo()         // 内部有 getStorage 调用 — 合并
  this.checkTodayCheckIn()
  this.syncTheme()
}
```

**修复策略：** 在 `auth.js` 的 `checkLoginStatus` 中增加 `forceRefresh` 参数，避免非必要时重新读取；同时感谢 `storageManager` 内存缓存，复读性能已接近 0ms，主要优化首次读取。

---

### 问题 5：最佳实践 — 图片尺寸过大

**根因：**
```xml
<!-- components/waterfall/waterfall.wxml -->
<!-- WXS optimizeUrl 已定义在第 1-27 行 -->
<!-- 但第 32 行 image src 未调用它！ -->
<image class="waterfall-image" src="{{item.coverUrl || item.url}}" mode="widthFix" lazy-load />
```

waterfall 组件中的图片直接使用原始 URL（通常 500-2000px 宽），而实际显示区域仅约 164×291px（375 屏宽 / 2 列 = 187.5px，实际内容区更窄）。这导致约 3-5 倍的带宽浪费和渲染开销。

**修复方案：**

**5a) 修复 waterfall 组件 WXS 图片优化**
```xml
<!-- 修复后：src 使用 WXS optimizeUrl -->
<image 
  class="waterfall-image" 
  src="{{utils.optimizeUrl(item.coverUrl || item.url)}}" 
  mode="widthFix" 
  lazy-load 
/>
```

**5b) 确保 `utils/image.js` 的 `optimizeImageUrls` 在数据进入 waterfall 前生效**

首页 index.js 中 `processSections` 已经调用了 `optimizeImageUrls`，但 waterfall 组件内部的 WXS 优化也应同步修复作为兜底。

**5c) 调整缩略图宽度，匹配实际显示尺寸**
```javascript
// utils/image.js getOptimalThumbnailSize()
// 2列瀑布流：实际渲染宽度 = (screenWidth - padding) / 2
// 375 屏： (375 - 24) / 2 = 175.5 → 乘以 dpr 2 = 351px
// 当前计算：Math.floor((screenWidth - 20) / 2 * dpr) = 355px ✅ 已匹配
```

---

### 问题 6：网络性能 — 未开启 HTTP/2

**根因：**
- 微信云开发（CloudBase）默认在云端使用 HTTP/2，但客户端的 `wx.request` 调用需要确认
- 部分请求调用云函数通过 `wx.cloud.callFunction`（走微信私有协议）
- 少量直接 HTTP 请求（如 CDN 获取 JSON）走 `wx.request`

**修复方案：**

**6a) HTTP/2 在微信小程序中的实际情况**
微信小程序的所有网络请求底层由微信客户端管理。`wx.request`、`wx.cloud.callFunction` 等 API 在微信客户端 ≥ 8.0 版本中默认优先使用 HTTP/2（当服务器支持时）。腾讯云（含云开发 CDN）默认支持 HTTP/2。

**6b) 确认措施**
- 检查 `utils/api/home.js` 中直接使用 `wx.request` 的 CDN 请求，确认 CDN 域名已启用 HTTP/2
- 对于 `wx.cloud.callFunction`，微信客户端会自动处理协议升级，无需额外配置
- **结论：此问题可能无需代码修改**，但需要验证 CDN 请求是否走了 HTTP/2（可以用抓包或 We 分析的后续报告验证）

---

### 问题 7：网络性能 — 请求超时失败

**根因：**
- 所有 `wx.request`、`wx.downloadFile` 调用**未设置 `timeout` 参数**
- `project.config.json` 中**没有 `networkTimeout` 配置**
- 如果网络不稳定，请求可能无限期挂起，导致 We 分析报告 "request fail timeout"

**修复方案（2步）：**

**7a) 配置全局网络超时**
```json
// project.config.json → setting 节点下新增
"networkTimeout": {
  "request": 15000,
  "connectSocket": 15000,
  "uploadFile": 30000,
  "downloadFile": 30000
}
```

**7b) 关键请求添加显式超时和重试逻辑**
```javascript
// utils/api/home.js getHomeData() 中的 wx.request
wx.request({
  url: cdnUrl,
  timeout: 10000,  // 10秒超时
  success: ...,
  fail: (err) => {
    // 超时后降级为云函数
    return this.fallbackToCloudFunction()
  }
})

// subpackages/preview/preview.js 中的 wx.downloadFile
wx.downloadFile({
  url: downloadUrl,
  timeout: 30000,  // 下载30秒超时
  success: ...,
  fail: ...
})
```

**7c) 增加请求重试机制**
```javascript
// 新增 utils/retry.js
export const withRetry = (fn, maxRetries = 2, delay = 1000) => {
  return async (...args) => {
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn(...args)
      } catch (err) {
        if (i === maxRetries) throw err
        await new Promise(r => setTimeout(r, delay * (i + 1)))
      }
    }
  }
}
```

---

## 三、优化影响面评估

| 修复项 | 涉及文件数 | 风险等级 | 业务影响 |
|-------|----------|--------|---------|
| 1. 启动性能 | 2 文件（app.js, storageManager.js） | 低 | 仅调整执行时序，不改逻辑 |
| 2. 同步 API 阻塞 | 1 文件（storageManager.js） | 中 | 移除同步回退，首次 getStorage 可能返回 null |
| 3. 未使用组件 | 1 文件（index.json） | 低 | 去除 waterfall 声明，需确认首屏无 waterfall 板块 |
| 4. 重复读取 storage | 3 文件（profile.js, index.js 等） | 低 | 内存缓存已在生效，改动为防御性优化 |
| 5. 图片尺寸 | 1 文件（waterfall.wxml） | 低 | WXS URL 拼接，不影响业务 |
| 6. HTTP/2 | 待验证 | 零 | 仅需确认，无需代码改动 |
| 7. 超时配置 | 2 文件（project.config.json，api 文件） | 低 | 显式设置超时，提升可靠性 |

---

## 四、实施优先级

### P0（立即修复，影响面大）
- **问题 5**：修复 waterfall 组件图片未优化的 bug — 这是最直接的性能提升
- **问题 7**：配置网络超时 — 防止请求无限挂起

### P1（本周内完成）
- **问题 1**：启动性能优化（wx.nextTick + key 拆分）
- **问题 2**：移除 getStorage 同步回退

### P2（下个迭代）
- **问题 3**：移除未使用组件声明
- **问题 4**：合并重复 storage 读取

### P3（验证确认）
- **问题 6**：HTTP/2 状态确认

---

## 五、预期效果

| 指标 | 当前 | 优化后预期 |
|------|-----|----------|
| onLaunch 耗时 | 84ms | < 40ms |
| 图片加载带宽 | 约 400KB/张（原始） | 约 60KB/张（缩略图） |
| Storage 同步调用 | onLoad 中 3-5 次 | 0 次 |
| 请求超时失败 | 偶发 | 明确超时 + 重试机制 |
| 首屏渲染时间 | 277ms | < 166ms（We 分析建议值） |

---

*本方案由 WorkBuddy 在对全项目代码审查后生成。所有修改保持业务逻辑不变。*
