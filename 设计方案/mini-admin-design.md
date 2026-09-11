## Missonce Admin Mini Program — 设计方案

### 一、产品定位

将现有 Web 管理后台（Mini admin）的核心功能迁移至独立的微信小程序，让管理员在移动端也能快速完成日常运营操作。定位为"轻量移动管理工具"，不追求完整复刻 Web 端所有功能，而是筛选出移动端高频场景做精做好。

**项目名称：** Missonce Admin  
**技术栈：** 微信原生小程序 + 云开发  
**后端方案：** 复用现有云函数（adminAuth、getResources、adminUserManager 等 ~18 个）  
**云开发环境：** missonce-99  

---

### 二、功能范围（核心功能优先）

#### 纳入小程序的功能（10 个模块）

| 模块 | 对应 Web 页面 | 移动端场景 |
|------|-------------|-----------|
| 数据概览 | DashboardPage | 随时查看关键指标、快速掌握运营状态 |
| 资源管理 | ResourcesPage | 直接管理资源 CRUD、上下架、编辑元数据（无审核流程） |
| 专题管理 | TopicsPage | 发布/下架专题、调整排序 |
| 分类标签 | CategoriesTagsPage | 新增/调整分类标签 |
| 首页 Tab | HomeTabsPage | 管理小程序首页 Tab 排序、启用/禁用、配置 |
| 广告配置 | PageAdsManager | 广告位 CRUD、批量配置、启用/暂停、数据查看 |
| 用户管理 | UserManagerPage | 查看用户信息、调整会员等级 |
| 通知管理 | NotificationsPage | 发布/管理站内通知 |
| AI 配置 | AIConfigPage（简化版） | 查看 AI 服务状态、基础配置 |
| 系统设置 | AdminsPage + LogsPage + 账号 | 查看日志、管理管理员、修改密码 |

#### 暂不纳入的功能（延后到 Phase 2+）

| 功能 | 原因 |
|------|------|
| 专题布局设计器 | Canvas 拖拽操作在手机上体验差，建议用 Web 端 |
| 去水印工具组（8 页） | 独立小程序已有，且偏消费者功能 |
| 运营仪表盘 | AI 驱动的深度分析，更适合大屏 |
| 积分配置 / 每日精选 / 分享码 | 低频操作，Web 端足够 |
| 语录管理 / 头像框管理 | 低频辅助功能 |

---

### 三、导航架构

```
TabBar（4 个标签）
├── 概览        →  pages/dashboard/dashboard
├── 内容        →  pages/content/content
├── 运营        →  pages/ops/ops
└── 设置        →  pages/settings/settings
```

**子页面（通过 navigateTo 进入）：**

```
pages/
├── login/login                          ← 登录页
├── dashboard/dashboard                  ← 概览（Tab 1）
├── content/content                      ← 内容中心（Tab 2）
│   ├── resource-list/resource-list      ← 资源列表
│   ├── resource-detail/resource-detail  ← 资源详情/编辑
│   ├── resource-upload/resource-upload  ← 上传资源
│   ├── topic-list/topic-list            ← 专题列表
│   ├── category-tags/category-tags      ← 分类标签管理
│   ├── home-tabs/home-tabs             ← 首页 Tab 管理
│   └── ad-config/ad-config              ← 广告配置
├── ops/ops                              ← 运营中心（Tab 3）
│   ├── user-list/user-list              ← 用户列表
│   ├── user-detail/user-detail          ← 用户详情
│   ├── notification-list/...            ← 通知列表
│   └── notification-edit/...            ← 通知编辑
└── settings/settings                    ← 设置（Tab 4）
    ├── admin-list/admin-list            ← 管理员管理
    ├── logs/logs                        ← 日志查看
    ├── ai-config/ai-config              ← AI 配置
    └── profile/profile                  ← 个人设置
```

---

### 四、UI 设计系统

#### 4.1 设计方向：「清晰运营」风格

融合"现代原生感"和"高效工具感"。不花哨、不堆砌装饰，让管理员在手机上也能快速定位和操作。

**核心原则：**

- 信息密度适中：比 Web 端更克制，突出关键数据和操作
- 操作直达：减少跳转层级，重要操作一屏可达
- 数据可视化简化：图表只做关键指标，不做复杂交互
- 状态完备：每个页面都有 loading、empty、error、permission 四态

#### 4.2 色彩系统

```
Primary（主色）
  primary:           #07C160    微信绿，品牌色
  primary-light:     #E8F8EE    浅绿底、选中态
  primary-dark:      #06AD56    按压态

Semantic（语义色）
  success:           #07C160    同主色
  danger:            #FA5151    删除、错误
  warning:           #FFC300    待审、警告
  info:              #10AEFF    信息、链接

Neutral — Light Mode
  bg-page:           #F5F6F8    页面底色
  bg-card:           #FFFFFF    卡片/面板
  bg-elevated:       #FFFFFF    浮层
  text-primary:      #1A1A2E    标题、正文
  text-secondary:    #8C8CA1    辅助文字、时间戳
  text-tertiary:     #B8B8C8    占位符
  border:            #F0F0F5    分割线
  divider:           #EBEBF0    细线

Neutral — Dark Mode
  bg-page:           #0F1117    页面底色
  bg-card:           #1A1D28    卡片/面板
  bg-elevated:       #242836    浮层
  text-primary:      #E8E8ED    标题、正文
  text-secondary:    #6B7080    辅助文字
  text-tertiary:     #4A4E5C    占位符
  border:            #2A2E3A    分割线
  divider:           #222636    细线
```

#### 4.3 字体系统

```
Page Title:          36rpx / font-weight: 700 / line-height: 1.3
Section Header:      32rpx / font-weight: 600 / line-height: 1.4
Body:                28rpx / font-weight: 400 / line-height: 1.6
Caption:             24rpx / font-weight: 400 / color: text-secondary
Data Number:         48rpx / font-weight: 700 / font-feature-settings: "tnum"
Data Label:          22rpx / font-weight: 400 / color: text-secondary
```

字体族使用系统默认，不加载自定义字体以减小包体积：
```css
font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', 
             'PingFang SC', 'Noto Sans CJK SC', sans-serif;
```

#### 4.4 间距系统

```
Page Padding:        32rpx（左右边距）
Section Gap:         40rpx（模块间距）
Card Padding:        32rpx（卡片内边距）
Card Gap:            24rpx（卡片间距）
List Item Height:    112rpx（列表项高度）
Border Radius:       20rpx（卡片圆角）
Border Radius Small: 12rpx（按钮/标签圆角）
```

#### 4.5 组件模式

**卡片（Card）**
- 全宽无侧边距（沉浸式）
- 白底 + 20rpx 圆角 + 极淡阴影 `0 2rpx 12rpx rgba(0,0,0,0.03)`
- 深色模式用 bg-card 填充，无阴影

**列表项（List Item）**
- 左侧 icon（48rpx 方形）+ 文字区 + 右侧辅助信息 + 箭头
- 点击反馈：背景短暂变灰

**状态标签（Status Badge）**
- 胶囊形状（pill），语义色填充
- 已发布 = 绿色底 + 绿色字
- 待审核 = 橙色底 + 橙色字
- 已下架 = 灰色底 + 灰色字

**底部操作栏（Bottom Action Bar）**
- 固定底部，safe-area-inset 适配
- 主按钮占满宽度，次要按钮文字链
- 高度 120rpx（含安全区）

**筛选栏（Filter Bar）**
- 横向滚动标签组，选中态 primary-light 底 + primary 字
- 或下拉选择器（picker）

**数据卡片（Metric Card）**
- 数字 + 标签布局
- 支持环比箭头（绿涨红跌）
- 2 列或 4 列网格排列

**空状态（Empty State）**
- 居中 icon + 描述文案 + 操作按钮（如有）
- 插画风格保持简洁线条

#### 4.6 导航栏

使用微信默认导航栏（非自定义），减少开发成本并保持一致性：
- 标题 = 页面名称
- 背景色随主题切换
- 仅在首页隐藏返回按钮

#### 4.7 图表

使用 `wx-charts` 或 `echarts-for-weixin`（按需引入）：
- 仪表盘只做 2 个核心图：7 日 PV/UV 折线图 + 资源状态饼图
- 简化交互：只支持点击查看数值，不做缩放/拖拽
- 数据卡片用纯 CSS 实现，不依赖图表库

---

### 五、认证方案

复用现有 `adminAuth` 云函数，流程：

```
小程序启动
  → wx.login() 获取 code
  → 检查本地 sessionToken
  → 有 token → adminAuth.verifyToken
    → 有效 → 进入首页
    → 无效 → 跳转登录页
  → 无 token → 跳转登录页

登录页
  → 账号密码登录（adminAuth.loginByAccount）
  → 成功 → 存 sessionToken → 进入首页
```

**Token 管理：** 复用 storageManager 的内存缓存 + wx.storage 双层存储。

---

### 六、云函数复用映射

| 小程序功能 | 复用的云函数 | 是否需要修改 |
|-----------|------------|------------|
| 登录认证 | adminAuth | 不需要 |
| 数据概览 | operationsAssistant(dashboard) | 不需要 |
| 资源列表 | getResources | 不需要 |
| 资源操作 | updateResource, deleteResources | 不需要 |
| AI 识别 | analyzeResource | 不需要 |
| 用户管理 | adminUserManager | 不需要 |
| 专题管理 | manageTopics, getTopics | 不需要 |
| 分类标签 | getCategories (读) + 新增 manageCategories (写) | 需新增写操作函数 |
| 首页 Tab | manageHomeTabs | 不需要 |
| 广告配置 | adConfigManager | 不需要 |
| 通知管理 | adminNotifications (已有) | 不需要 |
| AI 配置 | manageAIConfig, manageApiKeys, testAiConnection | 不需要 |
| 管理员管理 | addAdmin + adminAuth(manageAdmins) | 不需要 |
| 日志查看 | 直接读 error_logs + events 集合 | 可能需要增加查询云函数 |
| 修改密码 | adminAuth(changePassword) | 不需要 |

---

### 七、实施路线

#### Phase 1 — 基础架构 + 登录（预计 2-3 天）

- 项目脚手架搭建（app.json, tabBar, 主题变量, 公共样式）
- 公共工具层（storageManager, api 封装, auth, logger）
- 登录页面
- TabBar 框架 + 页面骨架

#### Phase 2 — 概览 + 资源管理 + 首页Tab + 广告（预计 4-5 天）

- Dashboard 页面（KPI 卡片 + 简易图表 + 快捷操作入口）
- 资源列表页（筛选 + 列表展示 + 直接管理）
- 资源详情页（查看 + 编辑 + 状态变更，无审核）
- 资源上传页（简化版，支持拍照/相册）
- 首页 Tab 管理页（拖拽排序 + 启用/禁用 + 配置编辑）
- 广告配置页（广告位 CRUD + 批量配置 + 启用/暂停 + 数据概览）

#### Phase 3 — 专题 + 用户 + 分类（预计 3-4 天）

- 专题列表 + 发布/下架/排序
- 用户列表 + 搜索 + 详情编辑
- 分类标签管理（Tab 切换 + CRUD）

#### Phase 4 — 通知 + AI + 系统（预计 2-3 天）

- 通知列表 + 创建/编辑
- AI 配置页（状态 + 基础配置）
- 管理员列表 + 添加
- 日志查看页
- 个人设置 + 修改密码

#### Phase 5 — 优化打磨（预计 2 天）

- 深色模式全面适配
- 骨架屏 + 加载动画
- 下拉刷新 + 触底加载统一
- 空状态 / 错误状态 / 权限状态全面覆盖
- 性能优化（图片懒加载、数据缓存）

---

### 八、技术决策

| 决策项 | 选择 | 原因 |
|--------|------|------|
| 框架 | 微信原生 | 与现有小程序保持一致，性能最优 |
| 样式方案 | CSS Variables + WXSS | 不引入框架，包体积最小 |
| 状态管理 | globalData + 事件总线 | 管理后台数据流简单，不需要复杂 store |
| 图表库 | echarts-for-weixin 按需引入 | 仅折线图 + 饼图，按需加载体积小 |
| 图片处理 | wx.chooseMedia + cloud.uploadFile | 原生 API 足够 |
| 包结构 | 主包 + 1 个分包 | 主包放 Tab 页面，分包放子页面 |

---

### 九、预估总量

| 类别 | 数量 |
|------|------|
| Tab 页面 | 4 |
| 子页面 | ~14 |
| 复用云函数 | ~17 |
| 新增云函数 | 1-2 |
| 自定义组件 | 6-8（status-badge, metric-card, filter-bar, bottom-action, empty-state, list-item, tab-config-item, ad-card 等） |
| 总页面数 | ~18 |

---

### 十、图标系统规范

全部使用 **Feather Icons 风格**的线性 SVG 图标，不使用 emoji 或位图图标。

**图标风格：**
- 线性描边，stroke-width: 2
- 圆角线帽（stroke-linecap: round）
- 圆角连接（stroke-linejoin: round）
- 无填充（fill: none）
- 颜色通过 currentColor 继承

**TabBar 图标（4 个）：**
| Tab | 图标 | 描述 |
|-----|------|------|
| 概览 | home | 房屋轮廓 + 门窗 |
| 内容 | grid | 四宫格方块 |
| 运营 | bar-chart | 柱状图三条竖线 |
| 设置 | settings | 齿轮 |

**功能模块图标（10 个）：**
| 模块 | 图标 | 底色 |
|------|------|------|
| 资源管理 | image | 绿色 pri-l |
| 专题管理 | book | 蓝色 blu-l |
| 分类标签 | tag | 紫色 pur-l |
| 首页 Tab | layout | 橙色 org-l |
| 广告配置 | monitor + ad | 红色 red-l |
| 用户管理 | users | 蓝色 blu-l |
| 通知管理 | bell | 绿色 pri-l |
| AI 配置 | cpu | 绿色 pri-l |
| 管理员 | shield | 蓝色 blu-l |
| 操作日志 | file-text | 橙色 org-l |

**实现方式：**
- 小程序中使用 SVG 转 Path 方案（如 `mini-svg-painter`）
- 或直接使用 `<image>` 标签加载本地 SVG 文件
- TabBar 图标需提供选中态（primary 色）和未选中态（灰色）两套
