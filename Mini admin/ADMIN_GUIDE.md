# 小辣椒头像 · 管理后台功能文档

> 技术栈：Vue 3 + TypeScript + Vite + Naive UI + CloudBase JS SDK
> 访问入口：`https://missonce.cc`（Hash 路由 `#/`）
> 登录方式：账号密码登录 / 手机号验证码登录（均需经 `adminAuth` 云函数校验）
> 权限体系：`admin`（普通管理员）/ `superadmin`（超级管理员），超级管理员专属菜单仅对其可见

---

## 菜单结构总览

后台侧边栏按业务分为 4 个一级菜单组，共 30 个页面入口：

| 菜单组 | 页面数 | 说明 |
|--------|--------|------|
| 总览 | 2 | 数据概览与智能运营助手 |
| 去水印精灵 | 8 | 去水印小程序的解析服务、热门榜单、Cookie、白名单等运维 |
| 壁纸头像 | 14 | 主业务：素材、用户、AI、广告、专题、分类标签等 |
| 系统 | 2 | 管理员账号管理（仅超管）、日志管理 |

---

## 一、总览

### 1. 概览（数据看板）
- **路径**：`/`
- **用途**：小程序整体运营数据一目了然
- **主要功能**：
  - 核心指标卡片：素材总数（已发布/待审）、收藏/下载量、PV/UV、分类/标签数
  - 近 7 天访问量趋势折线图（PV/UV，ECharts）
  - 素材状态分布饼图
  - 会员统计（总数、周/月/季/年卡、即将到期数）
  - 积分签到统计（日均）
  - 热门素材 TOP10（可切换下载量/收藏量排序）
  - 系统健康状态与运营建议
- **关键操作**：刷新、下载量/收藏量切换、各卡片快捷跳转
- **数据来源**：`downloads`、`favorites`、`categories`、`tags`、`events` 集合 + `adminUserManager`、`managePointsConfig` 云函数

### 2. 智能运营助手
- **路径**：`/operations-dashboard`
- **用途**：AI 驱动的运营决策面板
- **主要功能**：
  - 运营看板：总用户、活跃用户、总资源、总浏览量
  - 近 7 天 PV/UV 趋势图（云函数优先，失败回退直接查询）
  - 热门资源卡片网格（分页，带热度进度条）
  - 趋势预测（上升分类/标签、预测文案）
  - 内容质量检查（近 7 天新增、需优化、待 AI 分析）
  - 收藏/下载行为记录详情弹窗（分页）
  - 资源详情弹窗、批量处理与编辑
- **关键操作**：刷新数据、分页翻页、查看详情
- **数据来源**：`operationsAssistant` 云函数（dashboard/trendPrediction/qualityCheck/favoriteRecords/downloadRecords/behaviorStats）+ `events`、`resources`、`users` 集合

---

## 二、去水印精灵

> 去水印系列页面统一通过 `mediaApi` 调用外部 HTTP 服务（`https://api.missonce.cc`），不直接使用 CloudBase 数据库。

### 3. 解析工具
- **路径**：`/media`
- **用途**：在线解析视频/图片/音频链接
- **主要功能**：
  - 粘贴链接解析（支持抖音、小红书、快手、B 站等）
  - 一键 Demo 测试（抖音/小红书/快手）
  - 展示解析结果（平台、作者、标题、封面、视频、图片列表）
  - 视频在线预览 + 下载 + 复制链接
  - 图片网格点击大图预览
  - 代理签名 URL 处理防盗链
- **关键操作**：解析、Demo 测试、下载视频、复制链接
- **API**：`POST /api/parse`、`POST /api/getProxySign`、`GET /api/proxyDownload`

### 4. 热门榜单
- **路径**：`/media-trending`
- **用途**：管理去水印小程序的热门内容榜单
- **主要功能**：
  - 同步抖音/快手/小红书热门数据
  - 手动添加单条 + 批量导入
  - 编辑/删除单条热门
  - 按来源筛选（全部/手动/抖音/快手/小红书）
  - 按最新/热度/随机排序
  - 按平台清空 / 清空全部
- **关键操作**：同步抖音、同步快手、同步小红书、手动添加、批量导入、清空全部
- **API**：`/api/trending`、`/api/admin/trending/*`

### 5. 平台监控
- **路径**：`/media-platforms`
- **用途**：各平台解析器运行状态监控
- **主要功能**：
  - 统计卡片：已支持平台数、待实现数、覆盖率、服务在线状态
  - 解析器列表（全部/已实现/待实现筛选）
  - 每 30 秒轮询健康状态
  - API 端点参考表
  - 图标加载失败自动用首字母 SVG 兜底
- **关键操作**：全部、已实现、待实现
- **API**：`GET /api/admin/platforms`

### 6. Cookie 配置
- **路径**：`/media-cookies`
- **用途**：配置抖音、小红书登录 Cookie，用于获取视频直链
- **主要功能**：
  - 分平台卡片展示状态（未配置/已配置/已过期）
  - 输入 Cookie 值与过期时间并保存
  - 删除指定平台 Cookie
  - 显示上次更新时间
  - 使用说明（获取 Cookie 步骤）
- **关键操作**：保存、删除
- **API**：`GET/POST/DELETE /api/admin/cookies`

### 7. 域名白名单
- **路径**：`/media-whitelist`
- **用途**：管理代理下载与音频提取的域名白名单
- **主要功能**：
  - 代理下载域名白名单增删
  - 音频提取域名白名单增删
  - 恢复默认白名单
  - Tag 形式展示，支持单个删除
- **关键操作**：添加、删除、恢复默认
- **API**：`/api/admin/whitelist/*`

### 8. 运维工具
- **路径**：`/media-ops`
- **用途**：解析服务运维（定时任务、代理 IP、下载统计）
- **主要功能**：
  - 定时同步任务开关、间隔（5-1440 分钟）、同步平台勾选
  - 代理 IP 配置（地址、端口、用户名、密码、启用开关）
  - 下载统计展示（总下载量、今日下载、活跃平台数、各平台下载量）
  - 清空下载统计
- **关键操作**：保存配置、刷新、清空统计
- **API**：`/api/admin/scheduler`、`/api/admin/proxy`、`/api/admin/stats`

### 9. 页面管理
- **路径**：`/media-page-config`
- **用途**：控制小程序页面的显示/隐藏
- **主要功能**：
  - 加载页面配置并按 TabBar / 子页面分组
  - 每个页面通过开关切换启用/禁用
  - 单页保存（仅更新 enabled 字段）
- **关键操作**：每行开关切换
- **API**：`GET/POST /api/admin/pageConfig`

### 10. 解析公告
- **路径**：`/media-announcement`
- **用途**：管理去水印小程序首页公告
- **主要功能**：
  - 预览当前公告（内容、跳转链接、优先级、弹窗标识）
  - 编辑公告内容、跳转链接
  - 设置优先级（高/普通/低）
  - 弹窗显示开关
- **关键操作**：保存公告、重置
- **API**：`GET/POST /api/admin/announcement`

---

## 三、壁纸头像

### 11. 资源管理
- **路径**：`/resources`
- **用途**：头像/壁纸素材的增删改查与审核
- **主要功能**：
  - 分页列表展示素材（头像/壁纸，含封面、标题、状态、下载数）
  - 上传素材（通过 ResourceUploader 组件，支持拖拽、多文件、文件名去重校验）
  - 筛选（类型、状态、分类、标签、关键词）
  - 一键通过所有待审素材
  - 编辑/删除素材、触发 AI 识别
  - 批量选择与删除
- **关键操作**：上传素材、一键通过待审、筛选、重置、编辑、删除、AI 识别
- **数据来源**：`resources` 集合 + `updateResource`、`deleteResources`、`analyzeResource` 云函数 + `categoryService`、`tagService`、`resourceService`

### 12. 用户管理
- **路径**：`/user-manager`
- **用途**：管理小程序用户与会员
- **主要功能**：
  - 用户列表（分页，含 openid、昵称、会员等级、到期时间）
  - 搜索用户（按昵称/openid）
  - 编辑用户：修改会员等级、到期时间、跳广告、积分
  - 重置观看广告次数
  - 会员价格配置（周/月/季/年卡价格）
  - 会员统计
- **关键操作**：搜索、加载全部、编辑、保存、重置广告次数、保存价格
- **数据来源**：`adminUserManager` 云函数（getMemberStats/getMemberPrices/updateMemberPrices/list/update/delete 等）

### 13. AI 配置
- **路径**：`/ai-config`
- **用途**：AI 智能配置中心（3 个 Tab）
- **主要功能**：
  - **状态总览**：显示视觉模型配置、文案生成配置、API Keys、文案库的配置状态与详情
  - **模型配置**（AIKeyManager 组件）：选厂商→选模型→填 API Key/URL→测试连接→保存
  - **文案配置**（AIQuotesConfig 组件）：配置文案生成模型、系统提示词、精选文案库
  - 支持厂商：火山方舟、阿里云百炼、智谱AI、零一万物、小米、自定义
- **关键操作**：测试连接、保存配置、生成文案、Tab 切换
- **数据来源**：`sys_config` 集合（ai_config / ai_writer_config）+ `testAiConnection` 云函数 + `aiGenerateText` 云函数 + `api_keys` 集合 + `customProvidersStore`

### 14. 广告管理
- **路径**：`/page-ads`
- **用途**：管理小程序各页面的广告位
- **主要功能**：
  - 按页面管理广告列表（列表广告 + 信息流广告）
  - 创建/编辑/删除广告位
  - 批量启用/禁用
  - 批量为多个页面添加广告（3 步向导）
  - 广告单元管理（adUnit）
- **关键操作**：管理、批量添加、创建、编辑、删除、批量启用/禁用、全选/清空、上一步/下一步
- **数据来源**：`adConfigManager` 云函数（adUnit:list/create/update/delete/backup）+ `configStore`（listAdConfig）

### 15. 下载管理
- **路径**：`/download-manager`
- **用途**：配置下载相关参数
- **主要功能**：
  - 下载频率限制
  - 下载次数限制
  - 是否需要登录
  - 等等下载相关配置
- **关键操作**：保存配置
- **数据来源**：`configStore`（downloadConfig）

### 16. 首页 Tab
- **路径**：`/home-tabs`
- **用途**：管理小程序首页 Tab 布局
- **主要功能**：
  - Tab 列表展示（名称、图标、排序、状态）
  - 添加/编辑/删除 Tab
  - 拖拽排序
  - 启用/禁用
- **关键操作**：添加、编辑、删除、排序
- **数据来源**：`configStore`（homeTabsConfig）

### 17. 专题管理
- **路径**：`/topics`
- **用途**：管理专题合集
- **主要功能**：
  - 专题列表（标题、封面、状态、排序）
  - 创建/编辑/删除专题
  - 批量删除、批量上下架
  - 进入可视化布局设计器（TopicLayoutDesigner）
- **关键操作**：创建、编辑、删除、批量删除、批量上下架
- **数据来源**：`manageTopics` 云函数 + `getTopics` 云函数

### 18. 专题布局设计器
- **路径**：`/topic-layout/:id`
- **用途**：专题页面可视化布局设计
- **主要功能**：
  - 基础设置：标题、描述、封面（选图→裁剪→上传）、资源类型、筛选规则、排序
  - 布局组件：页面样式（背景色、内边距）、添加模块（封面头图/资源网格）
  - 模块配置：边距、头图高度、网格数据来源（自动/手动）、数量、列数、间距、圆角
  - 画布拖拽排序模块
  - 资源选择器 + 图片裁剪器
  - 快速模板（默认/情侣/头像合集）
  - 历史版本管理与回滚
- **关键操作**：快速模板、保存发布、返回、添加模块、删除、自动修复、回滚
- **数据来源**：`getTopics`、`manageTopics`、`manageTopicLayout` 云函数 + `resources` 集合 + 云存储

### 19. 动态头像框
- **路径**：`/avatar-frames`
- **用途**：管理动态头像框
- **主要功能**：
  - 头像框列表（缩略图、名称、状态）
  - 添加/编辑/删除头像框
  - 上传头像框素材
  - 启用/禁用
- **关键操作**：添加、编辑、删除
- **数据来源**：`manageAvatarFrames` 云函数（list/create/update/delete）

### 20. 分类标签
- **路径**：`/categories-tags`
- **用途**：管理素材分类与标签
- **主要功能**：
  - 分类管理：列表、添加/编辑/删除、排序、批量删除
  - 标签管理：列表、添加/编辑/删除、批量启用/禁用、批量删除
  - 启用/禁用切换
- **关键操作**：添加、编辑、删除、批量删除、批量启用
- **数据来源**：`categoryService`、`tagService`（封装 `categories`、`tags` 集合操作）

### 21. 公告管理
- **路径**：`/notifications`
- **用途**：管理小程序内公告与通知
- **主要功能**：
  - 公告列表（标题、类型、状态、时间）
  - 创建/编辑/删除公告
  - 设置公告类型、优先级、跳转链接
  - 启用/禁用
- **关键操作**：添加、编辑、删除
- **数据来源**：`notificationService`（封装 `notifications` 集合）

### 22. 联系方式
- **路径**：`/contact-config`
- **用途**：管理小程序内的联系方式与客服二维码
- **主要功能**：
  - 联系方式列表（QQ、微信、邮箱等）
  - 添加/编辑/删除联系方式
  - 上传客服二维码图片
  - 启用/禁用
- **关键操作**：添加、编辑、删除、保存
- **数据来源**：`manageContactConfig` 云函数（list/save/delete）+ 云存储上传

### 23. 积分配置
- **路径**：`/points-config`
- **用途**：配置积分规则与签到奖励
- **主要功能**：
  - 积分规则配置（签到积分、分享积分、邀请积分等）
  - 签到奖励配置（连续签到加成）
  - 积分明细查询
  - 签到统计
- **关键操作**：保存配置
- **数据来源**：`managePointsConfig` 云函数（getConfig/updateConfig/getCheckInStats/getPointsLog 等）

### 24. 每日精选
- **路径**：`/daily-picks`
- **用途**：管理每日精选素材
- **主要功能**：
  - 每日精选列表（按日期）
  - 手动添加精选素材
  - 自动精选配置（规则、数量）
  - 编辑/删除精选
- **关键操作**：添加、编辑、删除、保存自动配置
- **数据来源**：`manageDailyPicks` 云函数（list/add/update/delete/getAutoConfig/updateAutoConfig）+ `getResources` 云函数

### 25. 分享码管理
- **路径**：`/share-codes`
- **用途**：管理用户分享码与统计
- **主要功能**：
  - 分享码列表（用户、分享码、使用次数、时间）
  - 分享码统计（总分享码数、总使用次数、活跃用户）
  - 删除分享码
  - 分页查询
- **关键操作**：查询、刷新、删除、上一页/下一页
- **数据来源**：`shareCode` 云函数（adminStats/adminList/adminDelete）

### 26. 文案库
- **路径**：`/quotes`
- **用途**：管理 AI 文案生成与文案库
- **主要功能**：
  - 精选文案列表展示
  - AI 一键生成文案
  - 编辑/删除文案
  - 批量生成
- **关键操作**：生成文案、编辑、删除
- **数据来源**：`managePointsConfig` 云函数（getConfig/updateConfig）+ `aiGenerateText` 云函数

---

## 四、系统

### 27. 管理员管理（仅超级管理员）
- **路径**：`/admins`（`meta: { requireRole: 'superadmin' }`）
- **用途**：管理后台管理员账号
- **主要功能**：
  - 管理员列表（用户名、手机号、角色、创建时间）
  - 添加管理员（用户名、密码、手机号、角色）
  - 编辑管理员（修改角色/手机号/新密码，禁止改用户名）
  - 删除管理员（不可删除自己）
  - 密码服务端 bcrypt 哈希
  - 操作审计日志
- **关键操作**：添加管理员、编辑、删除、保存、取消
- **数据来源**：`admins` 集合 + `adminAuth` 云函数（manageAdmins: create/update/delete）

### 28. 日志管理
- **路径**：`/logs`
- **用途**：查看错误日志与事件日志
- **主要功能**：
  - 多维筛选：日志来源（错误/事件）、类型、时间范围（1h/24h/7d/30d）、页面路径
  - 合并 `error_logs` 与 `events` 两个集合并按时间倒序
  - 分页加载更多（每页 20）
  - 日志详情弹窗（JSON 展示）
  - 类型正则前缀匹配
- **关键操作**：刷新列表、应用筛选、查看详情、加载更多
- **数据来源**：`error_logs`、`events` 集合

---

## 五、工具与特殊页面

### 29. 数据库索引工具
- **路径**：`/tools-index`
- **用途**：数据库索引维护
- **主要功能**：
  - 进入页面自动调用云函数创建/更新索引
  - 展示执行结果（成功项、失败项）
  - 失败时提示需在 CloudBase 控制台手动创建的索引建议
- **关键操作**：无按钮（自动执行）
- **数据来源**：`updateDatabaseIndexes` 云函数

### 30. 登录 / 注册
- **路径**：`/login`、`/register`
- **用途**：后台登录与注册
- **主要功能**：
  - 账号密码登录（调 `adminAuth.loginByAccount`）
  - 手机号验证码登录（CloudBase SDK verifyOtp + `adminAuth.loginByPhone`）
  - 注册（CloudBase SDK + 自动添加管理员）
- **关键操作**：发送验证码、登录、切换登录方式
- **数据来源**：`adminAuth` 云函数 + CloudBase SDK

---

## 附录 A：数据库集合一览

| 集合名 | 用途 | 主要使用页面 |
|--------|------|-------------|
| `resources` | 素材主表 | 资源管理、每日精选、专题、运营助手 |
| `categories` | 分类 | 分类标签、资源管理 |
| `tags` | 标签 | 分类标签、资源管理 |
| `admins` | 管理员账号 | 管理员管理 |
| `error_logs` | 错误日志 | 日志管理 |
| `events` | 事件日志（PV/UV/行为） | 日志管理、概览、运营助手 |
| `downloads` | 下载记录 | 概览 |
| `favorites` | 收藏记录 | 概览、运营助手 |
| `users` | 小程序用户 | 用户管理、运营助手 |
| `sys_config` | 系统配置（ai_config/ai_writer_config/downloadConfig/listAdConfig/homeTabsConfig） | AI 配置、下载管理、广告管理、首页 Tab |
| `api_keys` | AI API Keys | AI 配置 |
| `ad_units` / `ad_units_backups` | 广告单元及备份 | 广告管理 |
| `notifications` | 公告 | 公告管理 |
| `topics` / `topic_layouts` / `topic_layout_history` | 专题及布局历史 | 专题管理、布局设计器 |

---

## 附录 B：云函数一览

| 云函数名 | 用途 | 主要调用页面 |
|---------|------|-------------|
| `adminAuth` | 管理员鉴权（登录/注册/manageAdmins/verifyToken） | 登录、管理员管理 |
| `analyzeResource` | AI 图片识别 | 资源管理 |
| `updateResource` | 更新素材 | 资源管理 |
| `deleteResources` | 删除素材 | 资源管理 |
| `getResources` | 查询素材 | 每日精选 |
| `adminUserManager` | 用户管理（list/update/delete/getMemberStats/getMemberPrices） | 用户管理、概览 |
| `adConfigManager` | 广告管理（adUnit:CRUD/backup） | 广告管理 |
| `manageAvatarFrames` | 头像框管理 | 动态头像框 |
| `manageContactConfig` | 联系方式管理 | 联系方式 |
| `managePointsConfig` | 积分配置（getConfig/updateConfig/getCheckInStats） | 积分配置、文案库、概览 |
| `manageDailyPicks` | 每日精选管理 | 每日精选 |
| `manageTopics` | 专题管理 | 专题管理 |
| `getTopics` | 查询专题 | 专题管理、布局设计器 |
| `manageTopicLayout` | 专题布局（getHistory/save/rollback） | 布局设计器 |
| `operationsAssistant` | 智能运营助手 | 运营助手 |
| `shareCode` | 分享码管理 | 分享码管理 |
| `testAiConnection` | AI 连接测试代理 | AI 配置 |
| `aiGenerateText` | AI 文案生成 | 文案库、AI 配置 |
| `updateDatabaseIndexes` | 数据库索引维护 | 工具页 |

---

## 附录 C：数据访问分层架构

后台数据访问分三层，不同页面采用不同方式：

| 层级 | 方式 | 说明 | 典型页面 |
|------|------|------|---------|
| **L1** | `db.collection()` 直接操作 | 前端 SDK 直连数据库，受集合权限限制 | 日志管理（error_logs/events） |
| **L2** | Service 封装 | 对 db 操作的封装，含分页/排序/时间戳 | 资源管理、分类标签（resourceService/categoryService） |
| **L3** | 云函数调用 | `callCloudFunction` / `callFunctionWithAuth`，走服务端，不受前端权限限制 | 管理员管理、AI 配置、用户管理 |

> **安全提示**：敏感操作（管理员 CRUD、AI 配置、用户会员）均走 L3 云函数 + `withAdmin` 鉴权；普通数据查询走 L1/L2。
