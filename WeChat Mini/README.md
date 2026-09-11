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
│   ├── resource-list/          # 通用资源列表
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

## ☁️ 云函数清单（cloudfunctions/）

> 共 51 个云函数（不含 `shared/` 共享模块目录）。`shared/withAdmin.js` 是统一管理员鉴权高阶函数，支持两条路径——① Web 后台传 `adminToken`（走 `adminSession.verifyToken`）；② 小程序端通过 `OPENID` 查 `admins` 集合。

### 一、后台管理类（admin* / manage*）

| 云函数 | 功能 | action 列表 | 触发方式 | 主要调用方 | 依赖集合 | 疑似未使用 |
|--------|------|------------|----------|------------|----------|-----------|
| **adConfigManager** | 广告位配置管理（adConfig 集合 + ad_units 目录），禁止小程序调用 | listByPage/create/batchCreate/update/delete/batchEnable/getMiniProgramPages/setMiniProgramPages/ensureCollections/adUnit:* | callFunction | 后台 Web | adConfig、ad_units、sys_config | 否 |
| **adminAuth** | 管理员账号密码登录/改密，bcrypt 哈希 + 防暴力破解（5 次锁定 15 分钟） | loginByAccount/changePassword | callFunction | 后台 Web | admins、login_attempts | 否 |
| **adminBanners** | 首页轮播图 CRUD | add/update/delete/list | callFunction（withAdmin） | 后台 Web | banners | 否 |
| **adminHome** | 首页板块 CRUD | get/add/update/delete | callFunction（withAdmin） | 后台 Web | home_sections | 否 |
| **adminNotifications** | 公告 CRUD + 批量启停 + 排序降级获取 | getAll/batchToggleStatus/add/update/delete | callFunction（withAdmin） | 后台 Web | notifications | 否 |
| **adminSession** | 管理员会话 Token（HMAC-SHA256 签名，24h 有效，恒定时间比较防时序攻击） | generateToken/verifyToken/refreshToken | callFunction | 云函数互调（adminAuth、withAdmin）+ 后台 Web | admins | 否 |
| **adminUserManager** | **终端用户**管理（搜索、会员等级、重置广告次数），非管理员账号 | searchUser/updateMembership/getUserList/resetWatchAdCount | callFunction（withAdmin） | 后台 Web | users、user_points | 否 |
| **manageAvatarFrames** | 头像框 CRUD + 批删 | list/add/delete/batchDelete | callFunction（withAdmin） | 后台 Web | avatar_frames | 否 |
| **manageConfig** | 通用 config 集合读写（读无需鉴权，写需管理员） | get/getAll/set/delete | callFunction | 后台 Web（写）+ 小程序（读） | config、admins | 否 |
| **manageContactConfig** | 联系方式（公众号二维码等）配置管理 | add/update/delete/list | callFunction（admin 鉴权） | 后台 Web | contact_config、admins | 否 |
| **manageHomeTabs** | 首页 Tab CRUD + 固定 Tab 兜底 | add/update/delete/list/reorder | callFunction（withAdmin） | 后台 Web | home_tabs | 否 |
| **manageTopicLayout** | 专题布局保存（写 topics.layout + 历史版本 topic_layout_versions） | save/history/rollback | callFunction（withAdmin） | 后台 Web | topics、topic_layout_versions、admin_operation_logs | 否 |
| **manageTopics** | 专题 CRUD + 状态批量更新 | create/update/updateStatus/batchUpdateStatus/delete/list | callFunction（withAdmin） | 后台 Web | topics | 否 |
| **operationsAssistant** | 运营数据看板（用户/资源/事件统计、趋势、Top 分类/标签） | getDashboardStats/... | callFunction | 后台 Web | users、resources、events | 否 |

### 二、资源管理类（增删改 + 批量）

| 云函数 | 功能 | 触发方式 | 主要调用方 | 依赖集合 | 疑似未使用 |
|--------|------|----------|------------|----------|-----------|
| **uploadResource** | 资源上传（标签/分类白名单校验 + 微信内容安全 imgSecCheck + 云函数互调 analyzeResource） | callFunction（withAdmin） | 后台 Web | resources、sys_config | 否 |
| **updateResource** | 按白名单字段更新单条资源（title/type/status/categories/tags/hotScore/coverUrl 等） | callFunction（withAdmin） | 后台 Web | resources | 否 |
| **deleteResource** | 删除单条资源 + 清云存储文件 | callFunction（admin 鉴权） | 后台 Web | resources、admins | 否 |
| **batchDeleteResources** | 批量删除资源 + 批量清云存储文件 | callFunction（admin 鉴权） | 后台 Web | resources、admins | 否 |
| **analyzeResource** | 调通义千问 qwen-vl-plus 视觉模型识别资源分类/标签 | callFunction | 云函数互调（uploadResource） | sys_config | 否 |
| **batchUpdateStats** | 批量自增资源统计字段（viewCount/favorites/downloads，纯统计无状态记录） | callFunction | 小程序前端（utils/api/interactions.js） | resources | 否 |

### 三、AI / 生成类

| 云函数 | 功能 | 触发方式 | 主要调用方 | 依赖集合 | 疑似未使用 |
|--------|------|----------|------------|----------|-----------|
| **aiGenerateText** | 调通义千问 qwen-turbo 生成文本（语录/文案），从 sys_config/ai_config 读配置 | callFunction | 后台 Web / 小程序 | sys_config | ⚠️ 不确定（需确认调用方） |
| **generateDynamicAvatar** | 合成动态头像 GIF（静态/GIF 底图 + 装饰层 + 头像框 + 滤镜，sharp + gifencoder） | callFunction | 小程序前端 | 无（仅云存储） | 否 |
| **generatePosterQuotes** | 调 AI（OpenAI 兼容接口）生成海报语录文案，从 sys_config/ai_writer_config 读配置 | callFunction | 后台 Web / 小程序 | sys_config、poster_quotes | 否 |

### 四、读取/查询类（getXxx）

| 云函数 | 功能 | 触发方式 | 主要调用方 | 依赖集合 | 疑似未使用 |
|--------|------|----------|------------|----------|-----------|
| **getAdConfig** | 按 adId/pagePath 读取广告配置 | callFunction | 小程序前端 | adConfig | 否 |
| **getCategories** ⚠️ | **命名易误解**：实际是从 resources 聚合提取**标签**列表（unwind tags → group），失败降级 tags 集合 | callFunction | 小程序前端 | resources、tags | ⚠️ 与 getTags 功能重叠，建议二选一 |
| **getConfig** | 按 key 读取单条 config 集合配置（前端读 rewardAdEnabled 等开关） | callFunction | 小程序前端（多处） | config | 否 |
| **getDailyPicks** | 每日精选（优先读 daily_picks 当日数据，缺失时按算法生成 头像30%+壁纸70%） | callFunction | 小程序前端（utils/api/home.js） | daily_picks、resources | 否 |
| **getHomeTabs** | 读取首页 Tab 列表 + 自动补齐固定 Tab（推荐/最新） | callFunction | 小程序前端 | home_tabs | 否 |
| **getNotifications** | 前端公告读取 + 标记已读（写 user_notifications） | getActiveNotifications/markAsRead | callFunction | 小程序前端 | notifications、user_notifications | 否 |
| **getPosterQuotes** | 读取海报语录（首次自动播种 30 条默认语录） | callFunction | 小程序前端 | poster_quotes | 否 |
| **getProxySign** | 为 proxyDownload 生成 HMAC-SHA256 签名（5 分钟有效） | callFunction | 小程序前端 | 无（仅签名计算） | 否 |
| **getQRCode** | 调 wxacode.getUnlimited 生成小程序码 + 上传云存储 | callFunction | 小程序前端（poster-share.js） | 无（仅云存储） | 否 |
| **getQuotes** | 语录分页查询（支持分类/关键词筛选，10 分钟内存缓存） | callFunction | 小程序前端 | quotes | 否 |
| **getResourceList** ⚠️ | 通用资源列表查询（type/category/tag/keyword/排序/分页，无缓存层） | callFunction | 小程序前端 | resources | ⚠️ 与 getResources 功能重叠，建议合并 |
| **getResources** ⚠️ | 资源列表查询（带内存+数据库双层缓存 resources_cache，5 分钟 TTL） | callFunction | 小程序前端 | resources、resources_cache | ⚠️ 与 getResourceList 功能重叠，建议合并 |
| **getTags** ⚠️ | 从 resources 聚合提取标签列表（10 分钟缓存，返回 {name, count}） | callFunction | 小程序前端 | resources | ⚠️ 与 getCategories 功能重叠，建议二选一 |
| **getTopics** | 专题列表/详情查询（支持自动筛选模式，解析封面 fileID） | callFunction | 小程序前端 | topics、resources | 否 |

### 五、用户 / 互动 / 登录类

| 云函数 | 功能 | 触发方式 | 主要调用方 | 依赖集合 | 疑似未使用 |
|--------|------|----------|------------|----------|-----------|
| **login** | 微信登录（code2Session 换 openid + 自动创建/更新用户 + 内联会员状态判定） | callFunction | 小程序前端 | users | 否 |
| **updateUserInfo** | 更新当前登录用户头像/昵称（按 openid 限制只能改自己） | callFunction | 小程序前端 | users | 否 |
| **toggleInteraction** | 收藏/点赞切换（带事务保证一致性，写 favorites/likes 集合并更新 resources 统计与热度） | add/remove | callFunction | 小程序前端 | favorites、likes、resources | 否 |
| **userPoints** | 用户积分/会员体系核心（签到、扣/加积分、兑换会员、下载次数、邀请、广告奖励、分享等。deductPoints/addPoints 仅服务端可调） | getUserInfo/getMemberStatus/checkIn/deductPoints/addPoints/exchangeMember/exchangeDownloads/recordDownload/getInviteStatus/bindInviter/rewardAdWatch/recordShare/... | callFunction | 小程序前端 + 云函数互调 | user_points、member_records、download_records、share_records | 否 |

### 六、日志 / 埋点类

| 云函数 | 功能 | 触发方式 | 主要调用方 | 依赖集合 | 疑似未使用 |
|--------|------|----------|------------|----------|-----------|
| **logEvent** | 事件埋点（写 events 集合；PV 事件同步自增 resources 的 viewCount/hotScore） | callFunction | 小程序前端（app.js） | events、resources | 否 |
| **logError** | 前端错误日志上报（含 openid/类型/设备信息/页面） | callFunction | 小程序前端（utils/logger.js） | error_logs | 否 |

### 七、工具 / 运维 / 初始化类

| 云函数 | 功能 | 触发方式 | 主要调用方 | 依赖集合 | 疑似未使用 |
|--------|------|----------|------------|----------|-----------|
| **shareCode** | 分享码生成/解析（encode 生成 8 位短码绑 resourceId，7 天有效；decode 解析） | encode/decode | callFunction | 小程序前端（poster-share、index） | share_codes | 否 |
| **proxyDownload** | 图片代理下载（域名白名单 20 个图床 CDN + 内网/云存储协议禁止 + HMAC 签名验证 + 每 IP 每分钟 20 次限流） | callFunction | 小程序前端 | 无（纯代理） | 否 |
| **initDatabase** | 数据库初始化脚本（创建集合 + 初始化积分系统配置 + 更新会员配置） | 一次性脚本 | 运维手动调用 | download_records/member_records/share_records/user_points/member_levels/system_configs/likes/views/comments | 否（部署时使用） |
| **initInteractionCollections** ⚠️ | 创建互动相关集合（likes/views/comments，临时文档创建后删除方式建集合） | 一次性脚本 | 运维手动调用 | likes、views、comments | ⚠️ 与 initDatabase.initCollections 部分重叠，建议合并 |
| **updateDatabaseIndexes** | 运维工具（按预定义创建数据库复合索引：resources 多个查询模式索引、banners、home_sections 等） | 一次性脚本 | 运维手动调用 | resources、banners、home_sections 等 | 否（运维工具） |

### 八、定时触发类

| 云函数 | 功能 | cron 表达式 | 含义 | 依赖集合 | 疑似未使用 |
|--------|------|------------|------|----------|-----------|
| **prebuildHomeFeed** | 预构建首页数据缓存（拉取 home_tabs + 各 Tab 第一页 20 条资源 → 写 home_cache 单文档 _id='v1'） | `0 */10 * * * * *` | 每 10 分钟 | home_tabs、resources、home_cache | 否（产出 home_cache 被首页 L3 直读） |
| **prebuildTopics** | 预构建专题列表缓存（拉取 active 专题 + 批量解析封面 fileID → 写 topics_cache 单文档 _id='v1'，超时 20s） | `0 */10 * * * * *` | 每 10 分钟 | topics、topics_cache | 否（产出 topics_cache 被专题页直读） |
| **resetDailyHotScore** | 每日热度重置（将所有 dailyHotScore>0 的资源归零，每批 50 条） | `0 0 0 * * * *` | 每日 0 点 | resources | 否 |

### 九、专项关系分析

#### ① adminAuth vs adminSession vs adminUserManager（无重叠）
- **adminAuth**：管理员**身份认证**（账号密码登录、改密、防暴力破解），返回 Token
- **adminSession**：管理员**会话管理**（Token 生成/验证/刷新），被 adminAuth 和 withAdmin 互调
- **adminUserManager**：**终端用户**管理（搜索业务用户、调会员等级、重置广告次数），操作 users/user_points，与管理员账号无关

#### ② 读/写配对关系（均无冗余）
- `getHomeTabs` ↔ `manageHomeTabs`（home_tabs 集合）
- `getNotifications` ↔ `adminNotifications`（notifications 集合）
- `getAdConfig` ↔ `adConfigManager`（adConfig 集合）
- `getPosterQuotes` ↔ `generatePosterQuotes`（poster_quotes 集合）
- `uploadResource` ↔ `updateResource`（上传 vs 更新）
- `deleteResource` ↔ `batchDeleteResources`（单删 vs 批删）

#### ③ batchUpdateStats vs toggleInteraction（职责不同，均在使用）
- **batchUpdateStats**：纯统计字段批量自增（无状态记录，无事务，无 likes/favorites 集合写入）
- **toggleInteraction**：带事务的收藏/点赞状态切换（写 favorites/likes 集合 + 更新 resources 统计与热度，保证幂等）
- ⚠️ 注意：若前端同时使用两者可能造成统计双计，建议核查调用时序

#### ④ manageConfig vs getAdConfig vs adConfigManager
- `manageConfig`：操作 **config** 集合（通用 key-value 配置）
- `getAdConfig` / `adConfigManager`：操作 **adConfig** 集合（广告配置专用）
- 三者操作的是**不同集合**，无冗余

### 十、潜在冗余项汇总（待确认）

| 函数对 | 现状 | 建议 |
|--------|------|------|
| `getCategories` vs `getTags` | 均从 resources 聚合 tags，功能高度重叠（getCategories 多一个 tags 集合降级） | ⚠️ 确认前端实际调用，合并为一个 |
| `getResourceList` vs `getResources` | 均为资源列表查询（getResourceList 无缓存，getResources 有双层缓存） | ⚠️ 确认前端用哪个，统一入口 |
| `initDatabase.initCollections` vs `initInteractionCollections` | 都创建 likes/views/comments | ⚠️ 合并到 initDatabase |
| `aiGenerateText` vs `generatePosterQuotes` | 均调 AI 生成文本，但配置来源不同（ai_config vs ai_writer_config） | ⚠️ 若场景不同可保留，否则统一 |

### 十一、鉴权方式分布

| 鉴权方式 | 涉及云函数 |
|----------|-----------|
| withAdmin（统一高阶，支持 Token+openid 双路径） | adminBanners、adminHome、adminNotifications、adminUserManager、manageAvatarFrames、manageHomeTabs、manageTopicLayout、manageTopics、updateResource、uploadResource |
| 手动查 admins 集合 count | deleteResource、batchDeleteResources、manageConfig（仅写）、manageContactConfig |
| 仅限 openid（用户自己） | login、updateUserInfo、toggleInteraction、getProxySign、logEvent、userPoints |
| 禁止小程序调用 | adConfigManager（denyIfMiniProgram） |
| 无鉴权（公开读取） | getAdConfig、getCategories、getConfig、getDailyPicks、getHomeTabs、getPosterQuotes、getQuotes、getResourceList、getResources、getTags、getTopics、getNotifications、shareCode、getQRCode、generateDynamicAvatar、generatePosterQuotes、aiGenerateText、proxyDownload（靠签名）、analyzeResource、batchUpdateStats、operationsAssistant |

---

## 📜 许可证
本项目仅供学习与交流使用。
