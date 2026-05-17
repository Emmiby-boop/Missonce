# Missonce 项目审计报告

> 生成时间: 2026-05-18  
> 审计范围: 组件、云函数、工具模块、图片资源、重复代码

---

## 🔴 严重问题 (Bugs)

### 1. `getTags` 云函数不存在 —— 运行时报错
- **位置**: `utils/api.js` 第 90-95 行
- **问题**: `api.js` 中导出了 `getTags()` 函数，调用云函数 `getTags`，但 `cloudfunctions/` 目录下**不存在 `getTags` 云函数**
- **影响**: 任何调用 `getTags()` 的地方都会失败
- **修复**: 
  - 方案 A: 创建 `cloudfunctions/getTags/index.js`（推荐，从 `getCategories` 复用逻辑）
  - 方案 B: 修改 `api.js`，将标签获取合并到 `getCategories` 云函数中

### 2. `empty.png` 图片引用缺失
- **位置**: WXML 文件中引用了 `images/empty.png`
- **问题**: 该文件不在 `images/` 目录下
- **影响**: 页面渲染时显示裂图

### 3. `icon-camera.svg` 图片引用缺失
- **位置**: WXML 文件中引用了 `images/icon-camera.svg`
- **问题**: 该文件不在 `images/` 目录下

---

## 🟡 冗余 / 未使用代码

### 4. 未使用的组件 (3个)

| 组件 | 注册情况 | 建议 |
|------|----------|------|
| `section-avatar-row` | 未在任何页面的 JSON 中注册 | **可删除** |
| `section-card` | 未作为组件使用（仅 CSS 类名有使用） | **可删除组件目录** |
| `section-waterfall` | 未在任何页面的 JSON 中注册 | **可删除** |

> `waterfall` 组件在 `index.json` 和 `wallpaper.json` 中有注册，是实际使用中的。

### 5. 未使用的工具模块 (5个)

| 文件 | 外部引用数 | 建议 |
|------|------------|------|
| `utils/commentGenerator.js` | 0 | **可删除** — 无任何地方 import |
| `utils/previewUtils.js` | 0（仅自身引用） | **可删除** |
| `utils/shareHelper.js` | 0 | **可删除** |
| `utils/wxKeyDiagnostic.js` | 0 | **可删除**（诊断工具，已不需要）|
| `utils/pageHelper.js` | 0 | **可删除** |

### 6. 未使用的图片 (约 7 个)

以下图片在任何 WXML/JS 文件中都没有找到引用：

- `icon-comment.svg` — 未被引用
- `menu-link.svg` — 未被引用（`menu-about.svg`、`menu-clear.svg`、`menu-contact.svg`、`menu-share.svg` 均被引用）
- `preview-favorite.svg` / `preview-favorite-active.svg` — JS 中有引用（preview 页面），**实际可能在使用**
- `share-cover.png` — JS 中有引用

> ⚠️ 注意：图片搜索范围可能未完全覆盖，建议二次确认后再删除。

### 7. 云函数重复 —— `interactionManager` vs `toggleInteraction`

两个云函数功能高度重叠：

| | `interactionManager` | `toggleInteraction` |
|---|---|---|
| 文件 | `cloudfunctions/interactionManager/` | `cloudfunctions/toggleInteraction/` |
| 接口 | `action: 'toggleLike'` 等 | `interactionType: 'favorite'` + `action: 'add'/'remove'` |
| 前端调用 | `api.js` 中通过 `toggleInteraction()` 导入调用 | `api.js` 中直接 `wx.cloud.callFunction({name:'toggleInteraction'})` |

**建议**: 统一为一个云函数，消除重复逻辑。两个函数都在使用，维护成本高。

---

## 🟢 优化建议

### 8. `cloudfunctions/shared/` vs `utils/` 重复工具
- `cloudfunctions/shared/cache.js` 和 `utils/cache.js` 功能类似
- `cloudfunctions/shared/errorMonitor.js` 和 `utils/errorMonitor.js` 功能类似
- `cloudfunctions/shared/performance.js` 和 `utils/performance.js` 功能类似

> 这是合理的分层（云函数共享代码 vs 前端工具），不是真正冗余，但建议确认逻辑是否一致。

### 9. `getHomeData` 云函数 vs 首页 CDN 直连策略
- `api.js` 中首页数据优先从云存储 CDN 读取 `home_data.json`
- 但 `getHomeData` 云函数仍然存在
- **建议**: 确认 `getHomeData` 是否还有被调用的场景，若无则可简化/删除

### 10. `clearDownloads` 云函数无任何外部调用
- 仅存在于自身 `package.json` 中
- 可能是废弃功能，建议确认后删除

### 11. `customerService` 云函数
- 代码中使用了 `cloud.openapi.customerServiceMessage.send()`，但这是云开发 OpenAPI，不是自定义云函数调用
- `customerService` 目录可能是一个误导性的遗留目录，实际功能可能在其他地方实现

---

## 📋 待确认清单

- [ ] `getTags` 云函数是否需要创建
- [ ] `empty.png` 和 `icon-camera.svg` 是否需要补充图片文件
- [ ] `interactionManager` 和 `toggleInteraction` 是否可合并
- [ ] 未使用组件（3个）确认后可删除
- [ ] 未使用工具模块（5个）确认后可删除
- [ ] `clearDownloads` 云函数是否可删除
- [ ] `customerService` 云函数是否真正需要

---

## 📊 统计摘要

| 类别 | 总数 | 未使用/冗余 | 备注 |
|------|------|------------|------|
| 组件 | 7 | 3 | section-avatar-row, section-card, section-waterfall |
| 云函数 | 44 | 2-3 | clearDownloads, customerService, (getTags 缺失) |
| 工具模块 | 17 | 5 | commentGenerator, previewUtils, shareHelper, wxKeyDiagnostic, pageHelper |
| 图片 | 30 | ~7 | 需二次确认 |
| 云函数重复 | 1组 | 2选1 | interactionManager vs toggleInteraction |
