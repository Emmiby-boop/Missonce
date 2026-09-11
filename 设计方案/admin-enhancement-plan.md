# 米森 Admin（后台管理）功能完善与新增方案

> 依据：壁纸小程序前端 `WeChat Mini`（53 个云函数、42 个集合）与后台 `miniprogramadmin`（23 页）的逐项对照。
> 结论：后台 CRUD 框架已较完整，但存在 **5 个前端有数据/功能、后台无入口** 的明确缺口，以及若干"有页面但可增强"的运营能力。

---

## 一、现状对照表

| 功能模块 | 前端数据/能力 | 后台现状 | 结论 |
|---|---|---|---|
| 资源（壁纸/头像） | `resources` 四态 + AI 分析 | content / resource-list / detail / upload ✅ | 已覆盖 |
| 分类 / 标签 | `categories`/`tags` | category-tags ✅ | 已覆盖 |
| 专题 | `topics` + 布局版本 | topic-list（列表/CRUD）✅ | **需增强**：缺可视化布局+回滚 |
| 首页装修 Tab | `home_tabs` | home-tabs ✅ | 已覆盖 |
| 公告 / 通知 | `notifications` | notification-list / edit ✅ | 已覆盖 |
| 广告 | `adConfig` + `ad_units` | ad-config ✅ | **需增强**：是否覆盖 `ad_units`+页面位映射待确认 |
| 语录 / 海报文案 | `quotes`/`poster_quotes` | quotes-manage / poster-quotes ✅ | 已覆盖 |
| 头像 DIY 框 | `avatar_frames` | ❌ 无页面 | **缺口** |
| 每日精选 | `daily_picks` + 算法生成 | ❌ 无页面 | **缺口（高价值）** |
| 积分 / 辣度值配置 | `points_config` + 完整积分体系 | ❌ 无页面 | **缺口（高价值）** |
| 应用通用配置 | `config`（小店商品/联系方式/群二维码/下载/工具箱显隐） | 仅 ai-config 管密钥，无统一配置页 | **缺口** |
| 分享码 | `share_codes`（list/stats/delete） | ❌ 无页面 | 缺口（低优先） |
| 用户 / 会员 | `users`/`user_points`/会员 | user-list / detail ✅ | 已覆盖 |
| 管理员 / 权限 | `admins` + 防暴破 | admin-list ✅ | 已覆盖 |
| 运营看板 | `operationsAssistant`（概览/趋势/分布/质检/预测/行为） | ops 页 ✅ | 已覆盖（可增强） |
| 操作日志 | `admin_operation_logs` | logs ✅ | 已覆盖 |

---

## 二、明确缺失的新增模块（P0/P1）

### ① 积分 / 辣度值配置页  `points-config`　【P0】
- **痛点**：前端积分体系极完整（签到+10/分享+10/邀请+25/看广告+20/下载-6/兑换会员），规则全在 `points_config` 集合；但**后台没有任何入口改规则**，调积分策略必须手动改库。
- **做什么**：基于现有 `managePointsConfig` 云函数，新增页面管理：签到奖励、分享/邀请奖励、看广告积分与每日上限、下载扣分、新用户赠送、会员积分价。含"手动调分"与"积分流水"查看。
- **价值**：运营最高频的调控手段，投入小、收益大。

### ② 每日精选管理  `daily-picks`　【P0/P1】
- **痛点**：前端 `getDailyPicks` 按"头像30%/壁纸70%、热60%/新40%"算法生成每日推荐，写入 `daily_picks`；但**后台无法人工干预/预览/回退**某天的精选。
- **做什么**：基于 `manageDailyPicks`，新增页面：按日期查看当日精选、手动增删条目、一键重算、历史回溯。
- **价值**：运营可针对节日/活动做人工置顶，提升首页转化。

### ③ 应用通用配置页  `app-config`　【P1】
- **痛点**：前端大量依赖 `config` 集合：`storeProducts`（微信小店商品）、`groupQr`（粉丝群二维码）、`contactEmail`/`officialAccountName`、`downloadConfig`（下载开关/免费次数）、`toolsConfig`（工具箱显隐）。目前后台**没有统一入口**，且这些散落在 `manageConfig`/`manageContactConfig` 等云函数里、无页面。
- **做什么**：新增"应用配置"页，集中管理：微信小店商品 ID 列表、粉丝群二维码上传、联系邮箱/公众号、下载配置开关、工具箱显隐。
- **价值**：把分散的开关收口到一个页面，避免改库。

### ④ 头像框管理  `avatar-frames`　【P1】
- **痛点**：前端 `avatar-diy` 用 `avatar_frames` 作装饰框，由 `manageAvatarFrames` 管理；后台无页面，只能改库。
- **做什么**：基于 `manageAvatarFrames` 新增页面：头像框列表/上传（图+名称）/启停/批删。
- **价值**：支撑头像 DIY 内容的持续运营。

### ⑤ 分享码管理  `share-codes`　【P2】
- **痛点**：`shareCode` 云函数已支持 list/stats/delete，但后台无页面。
- **做什么**：分享码列表、统计（生成/使用）、失效清理。
- **价值**：低优先，运营复盘用。

---

## 三、已有模块建议增强

### ⑥ 内容审核工作流（review 队列）　【P0】
- 资源状态机已有 `published/draft/review/offline`，但后台 `content` 是否提供"待审"独立队列 + "通过/驳回"按钮未知（待确认）。
- **增强**：新增"待审"筛选视图、`review → published` 一键过审、驳回理由；与 `imgSecCheck` 内容安全联动展示。

### ⑦ 专题可视化布局编辑器 + 版本回滚　【P1】
- `manageTopicLayout` + `topic_layout_versions` 已支持布局模块（resource-grid 等）与历史版本，但 `topic-list` 是否提供**可视化编辑 + 回滚 UI** 未知。
- **增强**：专题内模块拖拽/增删、保存即生成版本、可回滚到任一历史版本。

### ⑧ 广告单元 `ad_units` + 页面位映射　【P1】
- `adConfigManager` 同时管 `adConfig`/`ad_units`/`mini_program_pages`，需确认 `ad-config` 页是否已覆盖 `ad_units`（广告单元：位置/类型/启停）与页面位绑定。
- **增强**：若未覆盖，补齐广告单元 CRUD 与"页面→广告位"映射管理。

### ⑨ AI 一键分析与白名单管理　【P1】
- `analyzeResource` 调通义千问自动打分类/标签/主色；白名单 `tags_whitelist`/`categories_whitelist` 存于 `sys_config`。
- **增强**：资源详情/上传页加"一键 AI 分析"按钮；`ai-config` 页增加标签/分类白名单维护。

### ⑩ 批量操作 / 数据导出 / 角色细分　【P2】
- content 页补：批量上/下线、批量改分类、批量打标签（批删已有）。
- 用户/资源列表支持 CSV 导出（运营报数常用）。
- `admins` 的 `role`（admin/superadmin）在 `admin-list` 落实角色分配与"敏感操作仅超管可见"。

---

## 四、工程与稳定性（结合近期迁移）

1. **App(iOS) 后台登录打通**：前几轮已定位 `adminAuth` 在 App 端因"调用权限=需登录"造成 `unauthenticated` 死锁。建议云端把 `adminAuth` 设为"允许未登录调用"（loginByAccount 免凭证直达，其他 action 仍靠 adminToken 兜底），使 uni-app 版 Missonce admin 能在 iOS/Android 登录。
2. **云函数去重/清理**：后台 `cloudfunctions/` 目录存在死函数副本（`adminSession`/`batchDeleteResources`/`deleteResource`/`getStoreProducts`/`getTags`/`manageAIConfig`/`manageApiKeys`/`searchAvatars`/`updateDatabaseIndexes`/`initCollections`），与前端共用同环境同名函数、最后部署覆盖线上；应清理避免误部署污染线上。
3. **运营看板增强**：`operationsAssistant` 已较全，可补：实时在线数、次日/7 日留存、注册→登录→下载转化漏斗。

---

## 五、建议实施顺序（分批）

**Phase 1（P0，本周可落）**
- ① 积分配置页
- ② 每日精选管理
- ⑥ 内容审核工作流（若 content 尚未支持）

**Phase 2（P1，次批）**
- ③ 应用通用配置页
- ④ 头像框管理
- ⑦ 专题布局编辑器 + 回滚
- ⑧ 广告单元管理
- ⑨ AI 分析与白名单

**Phase 3（P2，收尾）**
- ⑤ 分享码管理
- ⑩ 批量操作 / 导出 / 角色细分
- 运营看板增强 + 云函数清理

---

## 六、需要你确认的两点（决定动手方向）

1. **目标工程**：新功能加在 **uni-app 版 `Missonce admin`**（已支持 iOS/Android，但 App 登录待打通）还是先补 **微信版 `miniprogramadmin`**（23 页最完整、可直接上线）？建议两者最终都要有，但先落地哪一个？
2. **起手优先级**：是否按上面 Phase 1（积分配置 + 每日精选 + 审核流）先开干？还是你更看重某块（比如应用配置/头像框）？

> 注：文档所列为"前端有、后台缺"的真实缺口，未纳入前端自身未实现的规划项（banner 轮播、评论/反馈、站内 push 等），那些需先在前端落地后再补后台。
