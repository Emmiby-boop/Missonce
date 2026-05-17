# Missonce 项目全面审计报告 V2

> 生成时间：2026-05-18  
> 审计工具：代码静态分析 + security-auditor + wechat-miniprogram-dev + frontend-performance  
> 项目路径：`D:\Missonce\Missonce\WeChat Mini`

---

## 一、🚨 严重 Bug（需立即修复）

### 1. `getTags` 云函数不存在 → 运行时报错

- **文件**：`utils/api.js` 第 90-95 行
- **问题**：`getTags()` 调用了云函数 `getTags`，但 `cloudfunctions/` 下无此目录
- **影响**：调用即报错，功能失效
- **修复**：
  ```bash
  # 方案：从 getCategories 复用逻辑，创建 getTags 云函数
  cp -r cloudfunctions/getCategories cloudfunctions/getTags
  # 然后修改 index.js 只返回 tags
  ```

### 2. 引用了不存在的图片资源

| 引用位置 | 缺失文件 | 影响 |
|---------|---------|------|
| 多个 WXML | `images/empty.png` | 空状态显示裂图 |
| 多个 WXML | `images/icon-camera.svg` | 图标显示裂图 |

**修复**：补充图片文件，或在 WXML 中移除引用。

---

## 二、🗑️ 冗余代码（可安全删除）

### 3. 未使用的自定义组件（3个）

| 组件目录 | 检查结果 | 建议 |
|---------|---------|------|
| `components/section-avatar-row/` | 无任何页面 JSON 注册，WXML 无引用 | **删除** |
| `components/section-card/` | 仅自身 WXML 引用，页面用的是 CSS 类名 `section-card` | **删除组件目录** |
| `components/section-waterfall/` | 无任何页面 JSON 注册 | **删除** |

> ✅ `waterfall` 组件在 `index.json`、`wallpaper.json` 中正常注册，保留。

### 4. 未使用的工具模块（5个）

| 文件 | 外部引用数 | 建议 |
|------|------------|------|
| `utils/commentGenerator.js` | 0 | **删除** |
| `utils/previewUtils.js` | 0（仅自身引用） | **删除** |
| `utils/shareHelper.js` | 0 | **删除** |
| `utils/wxKeyDiagnostic.js` | 0 | **删除**（调试工具，已无用） |
| `utils/pageHelper.js` | 0 | **删除** |

### 5. 未使用的云函数

| 云函数 | 问题 | 建议 |
|--------|------|------|
| `clearDownloads` | 仅自身 package.json 中有记录，无任何调用 | 确认后删除 |
| `customerService` | 云函数代码中使用的是 `cloud.openapi.customerServiceMessage`（微信开放接口），该目录可能是误导性遗留 | 确认后删除目录 |
| `initDatabase` / `initInteractionCollections` | 一次性初始化函数，正常保留 | 保留（但建议移到 `scripts/` 目录）|

---

## 三、🔁 重复代码（可合并）

### 6. `interactionManager` vs `toggleInteraction` 功能重叠

两个云函数都处理「点赞 / 收藏」交互：

| | `interactionManager` | `toggleInteraction` |
|--|---------------------|---------------------|
| 入口参数 | `action: 'toggleLike'` | `interactionType: 'like'`, `action: 'add'/'remove'` |
| 前端调用 | `api.js` 中 `import { toggleInteraction }` | `api.js` 中 `wx.cloud.callFunction({ name: 'toggleInteraction' })` |

**建议**：统一为一个云函数，消除双倍维护成本。  
**合并方案**：保留 `toggleInteraction`（参数更清晰），废弃 `interactionManager`。

---

## 四、⚡ 性能问题（WeChat 小程序专项）

> 依据：`wechat-miniprogram-dev` 技能规范 + `frontend-performance` 技能规范

### 7. 无分包预下载配置（`preloadRule` 缺失）

- **文件**：`app.json`
- **现状**：13 个分包已配置，但 **`preloadRule` 完全为空**
- **影响**：进入首页后点击「头像」「壁纸」等 tab 时，需要现加载分包，用户感知延迟
- **修复**：在 `app.json` 中添加：
  ```json
  "preloadRule": {
    "pages/index/index": {
      "network": "all",
      "packages": ["subpackages"]
    }
  }
  ```

### 8. 页面 JS 文件过大

| 文件 | 行数 | 大小 | 风险 |
|------|------|------|------|
| `subpackages/preview/preview.js` | 1519 行 | 47 KB | `wechat-miniprogram-dev` 建议单文件 ≤ 500KB，行数过多影响维护 |
| `subpackages/wallpaper-preview/wallpaper-preview.js` | 1531 行 | 47 KB | 同上 |

**建议**：将广告逻辑（`onRewarded`、`ensureRewardedForFirstDownload` 等）抽到独立 mixin 或 `utils/adUtil.js` 中。

### 9. `setData` 调用频繁且可能传大数据

各页面 `setData` 调用次数：
- `preview.js`：47 次
- `wallpaper-preview.js`：49 次  
- `profile.js`：47 次

**建议**：检查是否有 `this.setData({ list: newList })` 全量更新大列表的情况，改为路径更新：
```js
// ❌ 差
this.setData({ list: newList })

// ✅ 好
this.setData({ 'list[3].title': newTitle })
```

---

## 五、🔒 安全问题（续 `SECURITY_AUDIT_REPORT.md`）

### 10. 环境变量未配置（`sendEmail` 修复后的遗留）

- `cloudfunctions/sendEmail/index.js` 已改为从环境变量读取 SMTP 配置
- **但 `cloudbaserc.json` 中没有配置环境变量**，`SMTP_PASS` 等变量在云托管中未设置的话会发送失败
- **修复**：在腾讯云开发控制台 → 云函数 → `sendEmail` → 环境变量，配置：
  ```
  SMTP_HOST=smtp.qq.com
  SMTP_PORT=465
  SMTP_USER=your_email@qq.com
  SMTP_PASS=your_app_password
  ```

### 11. `getTags` 云函数缺失（安全角度）

如果 `getTags` 被补上，注意：
- 需要配置数据库权限（`tags` 集合的读权限）
- 不需要鉴权（标签是公开数据），但建议加频率限制

---

## 六、📦 包体积分析

### 12. `images/` 目录中有未被引用的图片

以下图片在 WXML/JS 中均未找到引用（**需二次确认**）：

- `icon-comment.svg`
- `menu-link.svg`

> ⚠️ 图片搜索可能因路径匹配方式漏报，建议用微信开发者工具的「代码依赖分析」功能二次确认后再删除。

### 13. `node_modules/` 不应提交到 git

检查 `cloudfunctions/` 下各函数的 `node_modules/` 是否在 `.gitignore` 中。

```bash
# 检查是否有 node_modules 被提交
git ls-files | grep "node_modules" | head -5
```

---

## 七、📋 修复优先级排序

| 优先级 | 问题 | 工作量 | 收益 |
|--------|------|--------|------|
| 🔴 P0 | `getTags` 云函数缺失 | 1h | 修复运行时报错 |
| 🔴 P0 | `empty.png`/`icon-camera.svg` 缺失 | 30min | 修复裂图 |
| 🟠 P1 | 添加 `preloadRule` | 30min | 提升分包加载体验 |
| 🟠 P1 | 配置 `sendEmail` 环境变量 | 15min | 修复邮件发送 |
| 🟡 P2 | 删除 3 个未使用组件 | 15min | 减少包体积 |
| 🟡 P2 | 删除 5 个未使用工具模块 | 15min | 减少包体积 |
| 🟡 P2 | 合并 `interactionManager`/`toggleInteraction` | 2h | 降低维护成本 |
| 🟢 P3 | 拆分超大 JS 文件 | 4h | 提升可维护性 |
| 🟢 P3 | 优化 `setData` 调用 | 2h | 提升渲染性能 |

---

## 八、✅ 验证方式

每个修复完成后建议验证：

| 修复项 | 验证方式 |
|--------|---------|
| `getTags` 云函数 | 在预览页面调用标签接口，开发者工具无报错 |
| 图片缺失 | 开发者工具 → 调试器 → Console，无 404 |
| `preloadRule` | 真机预览，分包页面切换无明显延迟 |
| 删除冗余代码 | `git status` 确认无功能文件被误删 |
| `setData` 优化 | 开发者工具 → Performance，渲染耗时下降 |

---

*本报告由代码静态分析 + security-auditor + wechat-miniprogram-dev 技能综合分析生成*
