# 小辣椒动态头像壁纸 (WeChat Mini Program)

## 🤖 AI Context / Project Guidelines (For AI Assistants)

**System Role**: You are working on a **WeChat Mini Program (Native)** using **Tencent CloudBase** (Serverless).

### 1. 🏗 Architecture & Mental Model
- **Framework**: Native WeChat Mini Program (WXML, WXSS, JS, JSON).
- **Backend**: Tencent CloudBase (Cloud Functions + Cloud Database).
- **State Management**:
  - **Global**: `app.globalData` (synced via `utils/auth.js`).
  - **Local**: Standard `Page.data` + `this.setData()`.
- **Navigation**: Standard `wx.navigateTo`, `wx.switchTab`.

### 2. 🔑 Key Modules & Conventions (Follow These!)
- **Authentication (`utils/auth.js`)**:
  - **SSOT**: This is the Single Source of Truth for user state.
  - **Methods**: Use `checkLoginStatus()`, `loginWithProfile()`, `logout()`, `syncUserFromCloud()`.
  - **Storage**: User info is cached in `wx.getStorageSync('userInfo')`.
- **API Layer (`utils/api.js`)**:
  - **Rule**: ALL cloud function calls must be encapsulated here. Do NOT call `wx.cloud.callFunction` directly in pages if possible.
  - **Pattern**: `export const getResources = (params) => wx.cloud.callFunction(...)`.
- **Logger (`utils/logger.js`)**:
  - Use for error reporting and remote logging.
- **UI Components**:
  - **Icons**: SVG icons in `/images/`.
  - **Lists**: Use standard pagination (page/pageSize) handling `onReachBottom`.
  - **Images**: Use `wx.previewImage` for full-screen viewing.

### 3. 📂 Critical Directory Map
- `cloudfunctions/`: Backend logic (Node.js).
  - `getResources`: Main query engine (filters, sorting).
  - `getHomeData`: Dynamic homepage configuration.
- `pages/`: Main TabBar Pages.
  - `index`: Dynamic homepage (driven by DB `home_sections`).
  - `avatar`: Avatar category grid.
  - `wallpaper`: Wallpaper waterfall list.
  - `profile`: User center (Auth, Favorites, History).
- `subpackages/`: Secondary Pages (Subpackaging).
  - `search`: Global search.
  - `preview`: Avatar previewer.
  - `wallpaper-preview`: Wallpaper previewer.
  - `login`, `favorites`, `profile-edit`, `webview`, etc.
- `utils/`: Shared logic.
  - `api.js`: API definitions.
  - `auth.js`: Auth logic.
  - `logger.js`: Logging utility.

---

一个基于微信小程序 + 腾讯云开发 (CloudBase) 的全栈壁纸头像应用。支持动态首页配置、海量资源浏览、图片预览下载、用户收藏等功能，并配套功能完善的后台管理系统。

## 📦 版本记录 (Release Notes)

### v1.2.7 (2026-02-14)
**性能优化与架构升级**

*   **🚀 性能飞跃**:
    *   **智能图片优化**: 引入 `utils/image.js`，自动将所有云存储及 HTTP 图片转换为 **WebP** 格式并进行**自适应缩放**，大幅减少流量消耗，加载速度提升 50% 以上。
    *   **并行加载**: 首页核心数据（轮播图、专题、推荐）改为**并行请求**，首屏渲染耗时显著降低。
    *   **骨架屏优化**: 重构首页与头像页骨架屏，新增流光动画 (Shimmer)，视觉体验更丝滑。
    *   **同步优化**: 优化用户信息同步机制，增加 **5 分钟缓存策略**，消除频繁的数据库读请求。

*   **🧹 架构清理**:
    *   **精简主包**: 确认所有次级页面（搜索、预览、列表、专题等）均已迁移至 `subpackages`，主包体积大幅缩减。
    *   **代码净化**: 移除 `components/guide`（旧版引导）、`market-price-collector.html` 等 5+ 个冗余文件与废弃代码。
    *   **API 升级**: 全局替换已废弃的 `wx.getSystemInfoSync` 为推荐的 `wx.getWindowInfo` / `wx.getAppBaseInfo`，消除控制台黄字警告。
    *   **日志降噪**: 关闭云开发 `traceUser` 选项，解决真机调试下 `cmd=1006` 日志刷屏问题。

*   **🐛 问题修复**:
    *   修复了 **瀑布流组件** 图片加载失败的问题（移除了错误的 URL 拼接逻辑）。
    *   修复了 **专题列表** 点击跳转路径错误导致无法进入详情页的 Bug。
    *   移除了壁纸预览页中已废弃的点赞功能相关代码。

## ✨ 核心功能

### 📱 小程序端
*   **动态首页**: 
    *   支持后台自定义首页布局（轮播图、推荐板块）。
    *   板块内容可灵活配置（如：最新壁纸、热门头像、特定分类）。
*   **壁纸专区**: 
    *   瀑布流展示，支持多种分类（风景、动漫、游戏等）。
    *   支持按最新、最热排序。
*   **头像专区**: 
    *   网格布局，支持分类筛选。
*   **资源预览**: 
    *   高清大图预览。
    *   **一键下载**: 自动处理相册权限，支持云存储/HTTPS图片保存。
    *   **收藏功能**: 用户登录后可收藏喜欢的资源。
*   **用户中心**: 
    *   微信一键登录。
    *   查看我的收藏、下载记录。
    *   个人信息管理。

### 💻 后台管理端 (Web)
*   **资源管理**: 上传/编辑/删除壁纸与头像，支持批量操作。
*   **首页装修**: 可视化配置首页板块。
*   **专题装修**: 可视化拖拽设计专题页布局。
*   **运营管理**: 轮播图管理、分类/标签管理。

## 🏗 技术架构

*   **前端**: 微信小程序原生开发 (WXML, WXSS, JS, JSON)
*   **后端**: 腾讯云开发 (CloudBase)
    *   **云数据库**: 存储资源、用户、配置信息。
    *   **云函数**: 业务逻辑处理。
    *   **云存储**: 存储图片资源。

## 📂 项目结构 (Optimized)

```
WeChat Mini/
├── cloudfunctions/             # 云函数目录
│   ├── getResources/           # [核心] 获取资源列表
│   ├── getHomeData/            # [核心] 获取首页配置
│   ├── manageTopicLayout/      # 专题布局管理
│   ├── uploadResource/         # 资源上传
│   ├── proxyDownload/          # 代理下载
│   └── login/                  # 用户登录
├── components/                 # 公共组件
│   ├── poster-share/           # 海报生成分享
│   └── waterfall/              # 瀑布流组件
├── pages/                      # 主包页面 (TabBar)
│   ├── index/                  # 首页
│   ├── wallpaper/              # 壁纸页
│   ├── avatar/                 # 头像页
│   └── profile/                # 个人中心
├── subpackages/                # 分包页面
│   ├── search/                 # 搜索
│   ├── preview/                # 头像预览
│   ├── wallpaper-preview/      # 壁纸预览
│   ├── wallpaper-list/         # 壁纸列表
│   ├── resource-list/          # 通用资源列表
│   ├── topic/                  # 专题详情
│   ├── topic-list/             # 专题列表
│   ├── favorites/              # 收藏夹
│   ├── profile-edit/           # 资料编辑
│   ├── login/                  # 登录页
│   └── webview/                # 内嵌网页
├── utils/                      # 工具库
│   ├── api.js                  # API 封装
│   ├── auth.js                 # 认证与用户状态
│   ├── image.js                # [新增] 图片优化工具
│   └── logger.js               # 日志工具
├── config/                     # [新增] 配置文件
├── images/                     # 静态资源 (SVG/PNG)
├── app.json                    # 全局配置
└── project.config.json         # 项目配置
```

## 📜 许可证
本项目仅供学习与交流使用。
