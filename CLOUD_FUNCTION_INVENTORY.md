# 云函数完整清单

## 一、小程序端调用（前端 → 云函数）

### 1. getHomeData
**功能**：获取首页数据（轮播图 + 板块配置 + 板块内容）  
**调用位置**：`app.js`、`utils/api.js`  
**触发场景**：首页加载时调用  
**特点**：多级缓存（预渲染缓存 → 普通缓存 → DB查询）

---

### 2. getBanners
**功能**：获取轮播图列表  
**调用位置**：`app.js`、`utils/api.js`  
**触发场景**：首页轮播图展示  
**特点**：10分钟内存缓存

---

### 3. getCategories
**功能**：获取分类/标签列表  
**调用位置**：`utils/api.js`  
**触发场景**：分类页、筛选功能  
**特点**：内存缓存，从 resources 集合实时聚合提取标签

---

### 4. getTags
**功能**：获取标签列表（别名，内部调用 getCategories）  
**调用位置**：`utils/api.js`  
**触发场景**：标签筛选

---

### 5. getResources
**功能**：高级资源查询（支持 ids 批量查询、关键词搜索、分类筛选、颜色筛选、排序）  
**调用位置**：`utils/api.js`  
**触发场景**：资源列表、搜索结果、相似推荐  
**特点**：优化过（字段投影常量、关键词解析函数、查询条件构建函数）

---

### 6. getResourceList
**功能**：通用资源列表（动态排序、筛选、分页）  
**调用位置**：`utils/api.js`  
**触发场景**：通用的资源列表请求

---

### 7. getRecommendations
**功能**：智能推荐（个性化推荐 + 相关资源推荐）  
**调用位置**：`utils/api.js`  
**触发场景**：推荐板块、相似推荐  
**支持 actions**：`personalized`（个性化）、`related`（相关资源）

---

### 8. getDailyPicks
**功能**：每日精选推荐  
**调用位置**：`utils/api.js`  
**触发场景**：每日推荐板块

---

### 9. getPageSections
**功能**：获取页面板块配置和数据  
**调用位置**：`app.js`、`utils/api.js`  
**触发场景**：各页面板块加载

---

### 10. getNotifications
**功能**：获取通知公告  
**调用位置**：`utils/notificationService.js`、`components/floating-notification.js`、`subpackages/notifications/notifications.js`  
**触发场景**：通知弹窗、通知列表  
**支持 actions**：`getActiveNotifications`、`markAsRead`、`batchMarkAsRead`、`getUserReadStatus`

---

### 11. getTopics
**功能**：获取专题列表/专题详情  
**调用位置**：`subpackages/topic-list/topic-list.js`、`subpackages/topic/topic.js`  
**触发场景**：专题页、专题列表

---

### 12. getQRCode
**功能**：生成小程序码  
**调用位置**：`components/poster-share/poster-share.js`  
**触发场景**：生成分享海报时调用

---

### 13. getQuotes
**功能**：获取激励文案列表  
**调用位置**：`subpackages/inspiration-writer/inspiration-writer.js`  
**触发场景**：灵感写作功能

---

### 14. toggleInteraction
**功能**：收藏/点赞资源（事务保证一致性）  
**调用位置**：`utils/api.js`  
**触发场景**：用户点击收藏/点赞  
**特点**：同时更新 likes/favorites 集合和 resources 统计

---

### 15. batchUpdateStats
**功能**：批量更新资源统计（浏览量、热度的原子增量）  
**调用位置**：`utils/api.js`  
**触发场景**：浏览记录触发时调用

---

### 16. userPoints
**功能**：用户积分系统（签到、积分、会员、下载）  
**调用位置**：`utils/api.js`、`utils/shareHelper.js`、`subpackages/preview/preview.js`、`subpackages/wallpaper-preview/wallpaper-preview.js`、`pages/profile/profile.js`、`pages/index/index.js`  
**触发场景**：积分页、下载、签到、会员  
**支持 actions**：共 16 个（`getUserInfo`、`checkIn`、`deductPoints`、`addPoints`、`getRecords`、`exchangeMember`、`getMemberStatus`、`recordDownload`、`getConfigs`、`getDownloadStatus`、`canDownload`、`getInviteStatus`、`bindInviter`、`getInviteRecords`、`exchangeDownloads`、`getExchangeOptions`、`rewardAdWatch`）

---

### 17. uploadResource
**功能**：上传资源到数据库  
**调用位置**：`utils/api.js`  
**触发场景**：用户上传新资源

---

### 18. proxyDownload
**功能**：服务端代理下载外部图片到云存储  
**调用位置**：`subpackages/preview/preview.js`、`subpackages/wallpaper-preview/wallpaper-preview.js`  
**触发场景**：下载外部链接图片时

---

### 19. interactionManager
**功能**：统一管理点赞、浏览、收藏等交互  
**调用位置**：`utils/previewUtils.js`  
**触发场景**：预览页交互操作  
**支持 actions**：`toggleLike`、`recordView`、`getUserInteraction`、`getStats`

---

### 20. getConfig
**功能**：获取系统配置  
**调用位置**：`subpackages/preview/preview.js`、`subpackages/wallpaper-preview/wallpaper-preview.js`  
**触发场景**：获取系统配置项

---

### 21. getAdConfig
**功能**：获取广告配置  
**调用位置**：`utils/adUtil.js`  
**触发场景**：广告展示时获取配置

---

### 22. login
**功能**：微信登录（code2Session）  
**调用位置**：`utils/auth.js`  
**触发场景**：用户登录小程序

---

### 23. updateUserInfo
**功能**：更新用户信息  
**调用位置**：`utils/auth.js`  
**触发场景**：更新用户头像、昵称等

---

### 24. logError
**功能**：记录前端错误日志  
**调用位置**：`utils/errorMonitor.js`  
**触发场景**：前端异常监控

---

### 25. logEvent
**功能**：记录用户行为事件  
**调用位置**：`app.js`  
**触发场景**：用户行为埋点

---

## 二、Mini Admin 后台调用（后台 → 云函数）

### 26. adminBanners
**功能**：轮播图管理（增删改查、批量操作）  
**调用位置**：`Mini admin/src/pages/BannersPage.vue`、`cloudbase.ts`  
**支持 actions**：`add`、`update`、`delete`、`batchToggleStatus`、`batchDelete`、`getAll`

---

### 27. adminNotifications
**功能**：公告管理  
**调用位置**：`Mini admin/src/pages/NotificationsPage.vue`、`cloudbase.ts`  
**支持 actions**：`getAll`、`batchToggleStatus`、`batchDelete`、`add`、`update`、`delete`

---

### 28. adminHome
**功能**：首页板块管理  
**调用位置**：`Mini admin/src/pages/HomeLayoutPage.vue`、`cloudbase.ts`  
**支持 actions**：`get`、`add`、`update`、`delete`

---

### 29. adConfigManager
**功能**：广告配置管理  
**调用位置**：`Mini admin/src/pages/PageAdsManager.vue`、`Mini admin/src/components/AdUnitConfigDialog.vue`、`Mini admin/src/components/AdPositionDialog.vue`  
**支持 actions**：`listByPage`、`create`、`batchCreate`、`update`、`delete`、`batchEnable`、`getMiniProgramPages`、`setMiniProgramPages`、`ensureCollections`、`adUnit:list/add/update/delete/backup`

---

### 30. manageContactConfig
**功能**：公众号联系方式管理  
**调用位置**：`Mini admin/src/pages/ContactConfigPage.vue`  
**支持 actions**：`add`、`update`、`delete`、`list`

---

### 31. manageTopicLayout
**功能**：专题页面布局管理  
**调用位置**：`Mini admin/src/pages/TopicLayoutDesigner.vue`  
**支持 actions**：`save`、`getHistory`、`rollback`

---

### 32. manageAIConfig
**功能**：AI 配置管理（API Key、分类白名单、标签白名单、文案配置）  
**调用位置**：`Mini admin/src/pages/AIConfigPage.vue`  
**支持 actions**：`get`、`saveAIConfig`、`saveCategories`、`saveTags`、`saveWriterConfig`、`saveFeaturedQuotes`

---

### 33. operationsAssistant
**功能**：运营数据看板  
**调用位置**：`Mini admin/src/pages/OperationsDashboardPage.vue`、`Mini admin/src/pages/ResourcesPage.vue`  
**支持 actions**：`dashboard`、`qualityCheck`、`trendPrediction`、`userBehavior`、`behaviorStats`、`downloadRecords`、`favoriteRecords`

---

### 34. batchDeleteResources
**功能**：批量删除资源  
**调用位置**：`Mini admin/src/pages/ResourcesPage.vue`  
**触发场景**：后台批量删除资源

---

### 35. deleteResource
**功能**：删除单个资源  
**调用位置**：`Mini admin/src/pages/ResourcesPage.vue`  
**触发场景**：后台删除单条资源

---

### 36. updateResource
**功能**：更新资源信息  
**调用位置**：`Mini admin/src/pages/ResourcesPage.vue`  
**触发场景**：后台编辑资源

---

### 37. analyzeResource
**功能**：AI 资源分析（通义千问视觉识别）  
**调用位置**：`Mini admin/src/pages/ResourcesPage.vue`、`Mini admin/src/pages/OperationsDashboardPage.vue`  
**触发场景**：后台触发 AI 分析

---

### 38. uploadResource
**功能**：上传资源（后台管理）  
**调用位置**：`Mini admin/src/pages/ResourcesPage.vue`  
**触发场景**：后台上传资源

---

### 39. updateDatabaseIndexes
**功能**：创建数据库复合索引  
**调用位置**：`Mini admin/src/pages/ToolsIndexPage.vue`  
**触发场景**：后台手动触发索引创建

---

### 40. getTopics
**功能**：获取专题列表  
**调用位置**：`Mini admin/src/pages/TopicsPage.vue`  
**触发场景**：后台专题管理

---

### 41. getBanners
**功能**：获取轮播图  
**调用位置**：`Mini admin/src/pages/BannersPage.vue`  
**触发场景**：后台轮播图列表

---

### 42. getConfig
**功能**：获取配置  
**调用位置**：`Mini admin/src/pages/PageAdsManager.vue`  
**触发场景**：获取广告位配置

---

### 43. manageConfig
**功能**：通用配置管理  
**调用位置**：`Mini admin/src/pages/PageAdsManager.vue`  
**支持 actions**：`get`、`getAll`、`set`、`delete`

---

### 44. addAdmin
**功能**：添加管理员  
**调用位置**：`cloudbase.ts`（底层调用）

---

### 45. adminAuth
**功能**：管理员身份认证（登录、修改密码）  
**调用位置**：`cloudbase.ts`（底层调用）  
**支持 actions**：`loginByAccount`、`changePassword`、`verifyEmail`

---

### 46. sendEmail
**功能**：发送邮件验证码  
**调用位置**：`cloudbase.ts`（底层调用）

---

## 三、定时触发器调度

### 47. prebuildHomepage
**功能**：预渲染首页数据并写入缓存  
**触发频率**：每 5 分钟  
**触发场景**：定时调度

---

### 48. resetDailyHotScore
**功能**：每日凌晨重置所有资源的每日热度  
**触发频率**：每天 00:00  
**触发场景**：定时调度

---

## 四、工具类云函数（无直接调用）

### 49. getContactConfig
**功能**：获取公众号联系方式  
**状态**：未被前端直接调用，可能是旧代码

---

### 50. aiGenerateText
**功能**：调用通义千问生成文本  
**状态**：未被前端直接调用，可能是旧代码

---

## 五、已清理的未使用云函数（备份于 `backups/cloudfunctions_backup_20260423_unused/`）

> 以下云函数已于 2026-04-23 从 cloudfunctions/ 移出，如需恢复可从此备份目录还原。

| 云函数 | 状态 | 说明 |
|--------|------|------|
| `adManager` | ✅ 已移出备份 | 目录为空，无代码 |
| `adSizeManager` | ✅ 已移出备份 | 目录为空，无代码 |
| `customerService` | ✅ 已移出备份 | 存在代码但未被调用（微信客服消息） |
| `initDatabase` | ✅ 已移出备份 | 一次性初始化脚本 |
| `initInteractionCollections` | ✅ 已移出备份 | 一次性初始化脚本 |
| `manageApiKeys` | ✅ 已移出备份 | 存在代码但未被调用 |
| `testConfig` | ✅ 已移出备份 | 存在代码但未被调用 |
| `updateResourceStats` | ✅ 已移出备份 | 存在代码但未被调用 |

---

## 六、数据库集合操作

| 云函数 | 操作的集合 |
|--------|-----------|
| getHomeData | `banners`, `home_sections`, `categories`, `resources`, `cloud_cache` |
| getBanners | `banners` |
| getCategories | `categories`, `tags`, `resources` |
| getResources | `resources`, `categories` |
| getTopics | `topics`, `resources` |
| userPoints | `user_points`, `point_records`, `download_records`, `member_records`, `invite_records` |
| toggleInteraction | `likes`, `favorites`, `resources` |
| batchUpdateStats | `resources` |
| logEvent | `events` |
| login | `users` |
| operationsAssistant | `users`, `resources`, `events`, `downloads`, `favorites` |
| analyzeResource | `resources`, `categories`, `tags` |
| uploadResource | `resources`, `categories`, `tags` |
| adConfigManager | `adConfig`, `sys_config`, `ad_units`, `ad_units_backups` |
| prebuildHomepage | `banners`, `home_sections`, `categories`, `resources`, `cloud_cache` |
| resetDailyHotScore | `resources` |
