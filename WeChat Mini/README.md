# 小辣椒动态头像壁纸 - 项目结构文档

> WeChat Mini Program + 腾讯云开发 (CloudBase) 全栈应用
> 环境ID: `missonce-99-1gfaff6n002f6ac1`

---

## 📋 目录结构总览

```
WeChat Mini/
├── app.js                    # 小程序入口，全局逻辑
├── app.json                  # 全局配置（页面路由、TabBar、分包）
├── app.wxss                  # 全局样式
├── project.config.json        # 项目配置
├── sitemap.json              # 搜索索引配置
├── cloudbaserc.json          # 云函数批量部署配置
│
├── pages/                   # 主包页面（4个 TabBar 页面）
├── subpackages/             # 分包页面（14个页面）
├── components/              # 公共组件
├── cloudfunctions/          # 云函数（22+ 个）
├── utils/                   # 工具库
├── behaviors/               # 页面共享 Behavior
├── config/                  # 配置文件
├── images/                  # 静态资源（图标、占位图）
├── scripts/                 # 构建/工具脚本
├── services/                # 后台管理服务（Vue + Vite）
├── miniprogram_npm/        # 小程序 npm 包
└── memory/                 # 开发记忆文件
```

---

## 📂 文件结构详细说明

---

### 🔧 根目录文件

| 文件 | 说明 |
|------|------|
| `app.js` | **小程序入口**。初始化云开发、性能监控、首页数据预热（_preheatHomeData）、存储缓存初始化、邀请链接处理。重写 Page() 注入全局错误捕获。 |
| `app.json` | **全局配置**。定义 4 个主页面 + 14 个分包页面、TabBar（4 Tab）、preloadRule（首页预加载分包）、darkmode 支持。 |
| `app.wxss` | **全局样式**。定义 CSS 变量（--primary-color 等）、dark 主题变量覆盖、全局字体、页面容器样式。 |
| `project.config.json` | **项目配置**。appid、云开发环境、ES6 编译设置、代码保护、基础库版本。 |
| `sitemap.json` | **搜索索引规则**。控制页面是否允许微信搜索收录。 |
| `cloudbaserc.json` | **云函数部署配置**。定义 37 个云函数的本地路径↔云函数名映射，用于 `tcb fn deploy -e <env>` 批量部署。 |

---

### 📱 pages/ — 主包页面（TabBar 4 个）

#### pages/index/ — 首页
| 文件 | 说明 |
|------|------|
| `index.js` | 首页逻辑。动态渲染 `home_sections` 配置的板块（轮播图、推荐、分类入口等）。调用 `getHomeData()` 获取配置数据，支持缓存渲染（10 分钟有效期）。 |
| `index.json` | 页面配置。注册 `ad-unit`、`floating-notification`、`waterfall` 组件。 |
| `index.wxml` | 首页模板。动态渲染各板块（wx:for），支持轮播图、网格列表、瀑布流等多种布局。 |
| `index.wxss` | 首页样式。板块卡片、轮播图、分类入口样式。 |

#### pages/wallpaper/ — 壁纸页
| 文件 | 说明 |
|------|------|
| `wallpaper.js` | 壁纸列表页逻辑。分类筛选、排序（最新/最热）、瀑布流加载、搜索联动。 |
| `wallpaper.json` | 注册 `waterfall`、`ad-unit` 组件。 |
| `wallpaper.wxml` | 壁纸网格/瀑布流布局。 |
| `wallpaper.wxss` | 壁纸卡片样式、分类标签样式。 |

#### pages/avatar/ — 头像页
| 文件 | 说明 |
|------|------|
| `avatar.js` | 头像列表页逻辑。分类网格、排序、分页加载。 |
| `avatar.json` | 注册 `waterfall`、`ad-unit` 组件。 |
| `avatar.wxml` | 头像网格布局。 |
| `avatar.wxss` | 头像卡片样式。 |

#### pages/profile/ — 个人中心
| 文件 | 说明 |
|------|------|
| `profile.js` | 个人中心逻辑。用户信息展示、签到、积分、收藏/下载历史、登录/登出、菜单导航。setData 已优化至 44 次。 |
| `profile.json` | 注册 `poster-share`、`floating-notification` 组件。 |
| `profile.wxml` | 个人中心模板。用户信息卡片、菜单列表、签到按钮、积分显示。 |
| `profile.wxss` | 个人中心样式。用户卡片、菜单项、签到按钮（橙粉/绿色渐变）、空状态样式。 |
| `profile-menu.js` | 菜单项数据配置（含 desc 字段，已替换为具体描述）。 |

---

### 📦 subpackages/ — 分包页面（14 个）

#### subpackages/preview/ — 头像预览
| 文件 | 说明 |
|------|------|
| `preview.js` | 头像预览页逻辑（1270 行，已从 1524 行优化）。轮播查看、下载、收藏、分享海报、互动统计。引用 `preview-base` Behavior。setData 已优化至 43 次。 |
| `preview.json` | 注册 `ad-unit`、`poster-share`、`floating-notification` 组件。 |
| `preview.wxml` | 头像预览模板。swiper 轮播、海报弹窗、下载流程图、激励广告触发。 |
| `preview.wxss` | 预览页样式。swiper 全屏、页面指示器、操作按钮样式。 |

#### subpackages/wallpaper-preview/ — 壁纸预览
| 文件 | 说明 |
|------|------|
| `wallpaper-preview.js` | 壁纸预览页逻辑（1283 行，已从 1533 行优化）。与 preview.js 高度对称，差异在于 isAvatar=false。引用 `preview-base` Behavior。setData 已优化至 44 次。 |
| `wallpaper-preview.json` | 同 preview.json。 |
| `wallpaper-preview.wxml` | 壁纸预览模板。 |
| `wallpaper-preview.wxss` | 壁纸预览样式。 |

#### subpackages/search/ — 搜索页
| 文件 | 说明 |
|------|------|
| `search.js` | 全局搜索逻辑。关键词搜索、搜索历史、热门搜索、结果展示。 |
| `search.json` | 页面配置。 |
| `search.wxml` | 搜索页模板。搜索框、历史标签、结果列表。 |
| `search.wxss` | 搜索页样式。 |

#### subpackages/login/ — 登录页
| 文件 | 说明 |
|------|------|
| `login.js` | 微信一键登录逻辑。获取用户信息、token 管理、登录状态同步。 |
| `login.json` | 页面配置。 |
| `login.wxml` | 登录页模板。头像昵称展示、授权按钮。 |
| `login.wxss` | 登录页样式。 |

#### subpackages/favorites/ — 收藏夹
| 文件 | 说明 |
|------|------|
| `favorites.js` | 收藏列表逻辑。查看已收藏的壁纸/头像、取消收藏。 |
| `favorites.json` | 注册 `waterfall` 或列表组件。 |
| `favorites.wxml` | 收藏列表模板。 |
| `favorites.wxss` | 收藏列表样式。 |

#### subpackages/profile-edit/ — 资料编辑
| 文件 | 说明 |
|------|------|
| `profile-edit.js` | 编辑个人资料逻辑。修改昵称、头像（调用 `updateUserInfo` 云函数）。 |
| `profile-edit.json` | 页面配置。 |
| `profile-edit.wxml` | 资料编辑模板。 |
| `profile-edit.wxss` | 资料编辑样式。 |

#### subpackages/wallpaper-list/ — 壁纸列表（分类/标签筛选）
| 文件 | 说明 |
|------|------|
| `wallpaper-list.js` | 壁纸列表逻辑。按分类/标签筛选、排序、分页。注册了 `ad-unit` 组件（已修复未注册 Bug）。 |
| `wallpaper-list.json` | 注册 `ad-unit`、`waterfall` 组件。 |
| `wallpaper-list.wxml` | 壁纸列表模板。 |
| `wallpaper-list.wxss` | 壁纸列表样式。 |

#### subpackages/resource-list/ — 通用资源列表
| 文件 | 说明 |
|------|------|
| `resource-list.js` | 通用资源列表逻辑。支持 wallpaper/avatar 两种模式。 |
| `resource-list.json` | 页面配置。 |
| `resource-list.wxml` | 资源列表模板。 |
| `resource-list.wxss` | 资源列表样式。 |

#### subpackages/topic/ — 专题详情
| 文件 | 说明 |
|------|------|
| `topic.js` | 专题详情页逻辑。展示专题下的资源列表。 |
| `topic.json` | 页面配置。 |
| `topic.wxml` | 专题详情模板。 |
| `topic.wxss` | 专题详情样式。 |

#### subpackages/topic-list/ — 专题列表
| 文件 | 说明 |
|------|------|
| `topic-list.js` | 专题列表逻辑。展示所有专题。 |
| `topic-list.json` | 页面配置。 |
| `topic-list.wxml` | 专题列表模板。 |
| `topic-list.wxss` | 专题列表样式。 |

#### subpackages/daily-picks/ — 每日精选
| 文件 | 说明 |
|------|------|
| `daily-picks.js` | 每日精选逻辑。展示每日推荐的壁纸/头像。 |
| `daily-picks.json` | 页面配置。 |
| `daily-picks.wxml` | 每日精选模板。 |
| `daily-picks.wxss` | 每日精选样式。 |

#### subpackages/inspiration-writer/ — 灵感文案
| 文件 | 说明 |
|------|------|
| `inspiration-writer.js` | 灵感文案页逻辑（从 git stash 恢复后已修复导航栏和广告）。 |
| `inspiration-writer.json` | 注册 `ad-unit` 组件。 |
| `inspiration-writer.wxml` | 灵感文案模板。 |
| `inspiration-writer.wxss` | 灵感文案样式。 |

#### subpackages/points/ — 积分中心
| 文件 | 说明 |
|------|------|
| `points.js` | 积分中心逻辑。积分记录、签到、激励广告获取积分。 |
| `points.json` | 注册 `ad-unit` 组件。 |
| `points.wxml` | 积分中心模板。 |
| `points.wxss` | 积分中心样式。 |

#### subpackages/notifications/ — 通知中心
| 文件 | 说明 |
|------|------|
| `notifications.js` | 通知列表逻辑。系统通知、公告。 |
| `notifications.json` | 页面配置。 |
| `notifications.wxml` | 通知列表模板。 |
| `notifications.wxss` | 通知列表样式。 |

#### subpackages/web-view/ — 内嵌网页
| 文件 | 说明 |
|------|------|
| `web-view.js` | 内嵌网页逻辑。加载外部链接（如公众号文章）。 |
| `web-view.json` | 页面配置。 |
| `web-view.wxml` | `<web-view>` 组件。 |
| `web-view.wxss` | 样式（通常空）。 |

---

### 🧩 components/ — 公共组件

#### components/ad-unit/ — 激励广告组件
| 文件 | 说明 |
|------|------|
| `ad-unit.js` | **激励视频广告组件**。管理视频广告生命周期（initRewarded、load、show），处理 AbortError（play interrupted by pause），_pageHidden 守卫防止竞态。支持奖励发放（调用云函数）和事件回调（rewarded）。 |
| `ad-unit.json` | 组件配置。 |
| `ad-unit.wxml` | 广告触发按钮模板。 |
| `ad-unit.wxss` | 广告按钮样式。 |

#### components/poster-share/ — 海报分享组件
| 文件 | 说明 |
|------|------|
| `poster-share.js` | **海报生成分享组件**。使用 canvas 绘制分享海报（资源图 + 小程序码），支持保存到相册。 |
| `poster-share.json` | 组件配置。 |
| `poster-share.wxml` | 海报弹窗模板。 |
| `poster-share.wxss` | 海报弹窗样式。 |

#### components/floating-notification/ — 浮动通知组件
| 文件 | 说明 |
|------|------|
| `floating-notification.js` | **浮动通知组件**。页面顶部滑入的通知提示（如"收藏成功"），自动消失。支持条件渲染。 |
| `floating-notification.json` | 组件配置。 |
| `floating-notification.wxml` | 通知条模板。 |
| `floating-notification.wxss` | 通知条样式（滑入动画）。 |

#### components/waterfall/ — 瀑布流组件
| 文件 | 说明 |
|------|------|
| `waterfall.js` | **瀑布流布局组件**。自适应两列布局，图片懒加载，支持分页加载更多。 |
| `waterfall.json` | 组件配置。 |
| `waterfall.wxml` | 瀑布流容器模板。 |
| `waterfall.wxss` | 瀑布流样式。 |

---

### ☁️ cloudfunctions/ — 云函数（22+ 个）

#### 核心数据 API（前端直接调用）

| 云函数 | 说明 |
|---------|------|
| `getHomeData/` | **首页数据**。读取 `home_data_api_cache` 缓存（10 分钟），未命中时从云存储 CDN 获取 `home_prebuilt_v1.json`（由 `prebuildHomepage` 定时生成）。兜底调用云函数自身查询。 |
| `getResources/` | **资源列表**。查询 resources 集合，支持 type 筛选（wallpaper/avatar）、category、tag、keyword 搜索、sort 排序（latest/hot）、分页。结果缓存 5 分钟。 |
| `getCategories/` | **分类列表**。从 resources 集合聚合分类（type 过滤），缓存 10 分钟。 |
| `getTags/` | **标签列表**。从 resources 集合聚合标签（type 过滤），缓存 10 分钟。（2026-05-18 新建） |
| `getBanners/` | **轮播图**。查询 banners 集合（status=active），支持位置筛选。 |
| `getConfig/` | **全局配置**。读取 config 集合的全局配置（如 adConfig、pointsConfig）。 |
| `getDailyPicks/` | **每日精选**。查询 daily_picks 集合，关联 resources 详情。 |
| `getPageSections/` | **页面板块配置**。读取 `page_sections_cache_${page}` 缓存（10 分钟），返回首页/头像/壁纸页的板块配置。 |
| `getQuotes/` | **每日语录**。随机获取一条语录（用于灵感文案页）。 |
| `getRecommendations/` | **推荐资源**。基于用户行为推荐资源。 |
| `getResourceList/` | **资源列表（通用）**。类似 getResources，用于管理后台。 |
| `getTopics/` | **专题列表**。查询 topics 集合。 |

#### 用户相关

| 云函数 | 说明 |
|---------|------|
| `login/` | **用户登录**。创建/更新 users 集合中的用户记录，返回 token（OPENID + 时间戳签名）。 |
| `updateUserInfo/` | **更新用户信息**。更新用户的昵称/头像（由 profile-edit 页面调用）。OPENID 鉴权，只能更新自己。（2026-05-18 新建，需部署） |
| `toggleInteraction/` | **点赞/收藏/浏览**。统一处理用户互动数据，支持 action: add/remove，type: like/favorite/view。 |
| `userPoints/` | **积分管理**。查询/增加/消耗用户积分，支持邀请绑定（bindInviter）。 |

#### 文件与下载

| 云函数 | 说明 |
|---------|------|
| `proxyDownload/` | **代理下载**。生成云存储文件临时 URL，支持域名白名单校验，防止滥用。（已配置白名单） |
| `uploadResource/` | **资源上传**。管理员上传壁纸/头像，支持批量。需 adminAuth 鉴权。 |

#### 日志与统计

| 云函数 | 说明 |
|---------|------|
| `logError/` | **错误日志**。接收前端错误日志，写入 logs 集合。 |
| `logEvent/` | **事件日志**。接收前端自定义事件，写入 events 集合。 |

#### 定时触发器

| 云函数 | 说明 |
|---------|------|
| `prebuildHomepage/` | **定时生成首页缓存**。每 30 分钟执行，查询首页所需数据，生成 `home_prebuilt_v1.json` 存入云存储，供 `getHomeData` 直连读取（CDN 加速）。 |

#### 管理后台 API（需 adminAuth 鉴权）

| 云函数 | 说明 |
|---------|------|
| `adminAuth/` | **管理员认证**。验证管理员密码（bcrypt），返回 JWT token。（已从 SHA256 迁移至 bcrypt） |
| `adminBanners/` | **轮播图管理**。CRUD 轮播图，需鉴权。 |
| `adminHome/` | **首页管理**。管理首页板块配置，需鉴权。 |
| `adminCategories/` | **分类管理**。管理分类/标签，需鉴权。 |
| `adminResources/` | **资源管理**。批量操作资源（审核、删除、推荐），需鉴权。 |
| `adminTopics/` | **专题管理**。CRUD 专题，需鉴权。 |
| `adConfigManager/` | **广告配置管理**。管理各页面的广告位配置，需鉴权。 |
| `getAdConfig/` | **获取广告配置**。前端获取当前页面的广告配置（无需鉴权）。 |
| `manageConfig/` | **全局配置管理**。读写 config 集合，需鉴权。（已添加鉴权） |
| `operationsAssistant/` | **运营助手**。运营数据统计，需鉴权。 |
| `sendEmail/` | **发送邮件**。管理员操作通知（如新资源审核），使用 SMTP 发送。（已移除硬编码密码，改用环境变量 SMTP_HOST/PORT/USER/PASS） |
| `addAdmin/` | **添加管理员**。仅允许已认证的管理员调用。（已添加鉴权） |
| `deleteResource/` | **删除资源**。（已添加鉴权） |
| `batchDeleteResources/` | **批量删除资源**。（已添加鉴权） |

#### 已删除（2026-05-18 清理）

| 云函数 | 说明 |
|---------|------|
| `clearDownloads/` | 前端无调用，已删除。 |
| `customerService/` | 前端无调用，已删除。 |
| `interactionManager/` | 与 toggleInteraction 功能重复，已删除。 |
| `commentManager/` | 前端无调用，已删除。 |

---

### 🔧 utils/ — 工具库

| 文件 | 说明 |
|------|------|
| `api.js` | **API 封装层**（800+ 行）。封装所有云函数调用（getHomeData、getResources、getCategories 等 20+ 个导出函数）。统一处理缓存（getStorageAsync/setStorage）、错误处理、降级方案。 |
| `auth.js` | **认证与用户状态管理**。checkLoginStatus()、loginWithProfile()、logout()、getUserInfo()、getToken()。读写 storageManager 中的 token/userInfo/openid。同步全局状态到 app.globalData。 |
| `storageManager.js` | **存储管理**。（优化版）模块级 storageCache 内存缓存；initStorageCache() 启动时批量预加载（wx.batchGetStorage）；getStorage/setStorage/getStorageAsync 统一入口；startupSyncFallbackDisabled 前 5 秒禁用同步 API（避免阻塞）；home_data_api_cache 同步预读绕过限制。 |
| `logger.js` | **日志工具**。封装 logger.logError()、logger.logEvent()、logger.logPerformance()，调用对应云函数，失败时静默失败不影响主流程。 |
| `image.js` | **图片优化工具**。自动将云存储/HTTP 图片转换为 WebP 格式，自适应缩放，减少流量消耗（提升加载速度 50%+）。 |
| `statsGenerator.js` | **互动统计生成**。generateInteractionStats() 计算资源的浏览/点赞/收藏/下载计数，用于预览页展示。 |
| `theme.js` | **主题管理**。getTheme()/setTheme() 读写 theme 到 storage，支持 dark/light 模式切换。 |

---

### 🧠 behaviors/ — 页面共享 Behavior

| 文件 | 说明 |
|------|------|
| `preview-base.js` | **预览页共享 Behavior**（248 行）。从 preview.js 和 wallpaper-preview.js 提取 17 个完全相同的方法（_computeInteractionData、getTagList、goBack、showLoginModal、checkLogin、saveFavorites、showPoster、hidePoster、onMoreTap、onReachBottom、onNativeAdError、handleThemeChange 等）。两个预览页各减少 ~250 行重复代码。（2026-05-18 新建，曾因 require 路径错误导致白屏，已修复） |

---

### ⚙️ config/ — 配置文件

| 文件 | 说明 |
|------|------|
| `constants.js` | **常量定义**。STORAGE_KEYS（TOKEN、USER、OPENID、USER_INFO 等 storage key 枚举）、API 超时时间、主题默认值。 |
| `theme.json` | **主题变量**。darkmode 下的颜色变量（导航栏、背景、文字色等），被 app.json 引用（`"themeLocation": "config/theme.json"`）。 |

---

### 🖼️ images/ — 静态资源

| 文件 | 说明 |
|------|------|
| `home.png` / `home-active.png` | 首页 TabBar 图标（未选中/选中）。 |
| `avatar.png` / `avatar-active.png` | 头像 TabBar 图标。 |
| `wallpaper.png` / `wallpaper-active.png` | 壁纸 TabBar 图标。 |
| `profile.png` / `profile-active.png` | 我的 TabBar 图标。 |
| `empty.png` | 占位图（200x200 灰色，用于加载失败的资源）。（2026-05-18 生成） |
| `icon-camera.svg` | 相机图标（用于更换头像按钮）。（2026-05-18 生成） |
| `icon-lightning.svg` | 闪电图标（签到未签状态）。（2026-05-18 新建） |
| `icon-check-done.svg` | 勾选图标（签到已签状态）。（2026-05-18 新建） |
| `icon-diamond.svg` | 宝石图标（积分/会员）。（2026-05-18 新建） |
| `icon-empty-heart.svg` | 空心图标（收藏空状态）。（2026-05-18 新建） |
| `icon-empty-download.svg` | 下载图标（下载空状态）。（2026-05-18 新建） |

---

### 🛠️ scripts/ — 工具脚本

| 文件 | 说明 |
|------|------|
| （部署/构建脚本） | 用于云函数批量部署、静态资源处理等。 |

---

### 🖥️ services/ — 后台管理系统

| 文件 | 说明 |
|------|------|
| （Vue + Vite 项目） | 管理后台前端，用于资源管理、首页装修、专题装修、运营管理。与小程序共享云开发环境。 |

---

## 🏗️ 核心架构说明

### 首页加载流程
```
用户打开小程序
  → app.js onLaunch: initStorageCache() 批量预加载 storage
  → app.js: _preheatHomeData() 立即启动（无延迟）
  → 首页 onLoad: getHomeData()
    → 检查 home_data_api_cache（内存缓存，<1ms）
    → 命中：直接渲染（~500ms，热启动）
    → 未命中：云存储 CDN 获取 home_prebuilt_v1.json（~1170ms）
    → 失败兜底：调用云函数 getHomeData
```

### 缓存策略
| 缓存层 | 有效期 | 说明 |
|--------|--------|------|
| storageCache（内存） | 小程序生命周期 | wx.batchGetStorage 启动时批量读取 |
| home_data_api_cache | 10 分钟 | 首页数据，热启动直接渲染 |
| resources_cache_${type}_${tag}_${sort} | 5 分钟 | 资源列表 |
| categories_cache_${type}_${source} | 10 分钟 | 分类/标签列表 |
| page_sections_cache_${page} | 10 分钟 | 页面板块配置 |
| banners_cache_${status} | 5 分钟 | 轮播图 |

### 云函数调用规范
- **所有云函数调用封装在 `utils/api.js`**，页面禁止直接调用 `wx.cloud.callFunction`
- **缓存优先**：api.js 中的每个函数先检查本地缓存，命中则直接返回
- **异步写入缓存**：云函数返回成功后，异步写入缓存（不阻塞渲染）

---

## 📦 依赖与部署

### 小程序端
- 无 npm 依赖（使用小程序原生能力 + 云开发）

### 云函数依赖（部分）
- `wx-server-sdk`（腾讯云开发 SDK）
- `bcryptjs`（管理员密码加密，替换了 SHA256）
- `node-fetch`（代理下载 HTTP 图片）

### 部署步骤
1. **云函数部署**：`cd D:\Missonce\Missonce\WeChat Mini` → `tcb fn deploy -e missonce-99-1gfaff6n002f6ac1`（根据 cloudbaserc.json 配置）
2. **待部署**：`getTags`、`updateUserInfo`（2026-05-18 新建，需手动部署）
3. **SMTP 环境变量**：云开发控制台 → 云函数 → sendEmail → 配置 → 环境变量，添加 `SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASS`，保存后重新部署

---

## 📝 开发记录

详见 `memory/2026-05-18.md`（本文件所在目录的 memory/ 子目录）。

---

## 📜 许可证

本项目仅供学习与交流使用。
