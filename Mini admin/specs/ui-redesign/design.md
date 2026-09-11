# 设计文档 — Mini Admin 前端 UI 全面焕新

## 1. 设计 DNA（Design DNA）— 以用户自测 redesign 为准
> 用户于 `prototypes/mini-admin-web-redesign.html` 提供了完整 redesign，本方案以其为**唯一权威**，此前 warm-stone 方向作废。

| 维度 | 决策 |
|------|------|
| 调性 | 维持微信绿 `#07C160` 为主色；表面走 **cool slate**（Tailwind slate 调性），现代 SaaS 后台感 |
| 主色 | `--pri: #07C160`；hover `#06AD56`；soft `#E8F8EE` |
| 语义色 | 五色体系：`--red #EF4444` / `--org #F59E0B` / `--blu #3B82F6` / `--pur #8B5CF6` / 绿，用于分类、指标、状态区分 |
| 字体 | Heading: **Figtree**；Body: system-ui / PingFang SC / Noto Sans SC；Mono: **IBM Plex Mono** |
| 圆角 | `--r:10px`（卡片）/ `--rs:6px`（小）/ `--rl:14px`（大）|
| 阴影 | slate 基调低透明分层：`--shadow-s/m/l` |
| 暗色 | cool slate：`--bg #0B0F19` / `--surface #111827` / `--elevated #1E293B`（非暖石）|
| 动效 | standard 曲线 200ms 微交互；尊重 `prefers-reduced-motion` |

## 2. 令牌体系（单一真相源）
- **`src/design-system/tokens.css`**：`:root` 定义全部语义变量（cool slate + 五色体系 + Figtree/IBM Plex Mono），`.dark` 覆盖 cool slate 暗色。已对齐用户 redesign。
- **`src/design-system/naive-theme.ts`**：`GlobalThemeOverrides` 的 light/dark 直接引用同一组色值，在 `App.vue` 的 `NConfigProvider` 中按主题切换。**彻底消除双轨色**。
- **`tailwind.config.js`**：`theme.extend.colors` 映射为 `primary`/`accent`/`success`/`warning`/`danger`/`surface`/`border`/`text` 语义键，业务代码改用 `text-text-sub`、`bg-surface` 等。

## 3. 布局骨架
```
┌─────────┬──────────────────────────────────────┐
│ Sidebar │ Topbar: 面包屑 · 搜索 · 主题切换 · 用户  │
│ 248px   ├──────────────────────────────────────┤
│ 分组导航 │  PageHeader: 标题 + 副标题 + actions     │
│ 活动指示 │  ┌──────────────────────────────────┐  │
│ 可收起   │  │  Content (max 1440px)             │  │
│         │  │  KPI cards · table · form ...      │  │
│         │  └──────────────────────────────────┘  │
└─────────┴──────────────────────────────────────┘
```
- **Sidebar**：分组折叠导航（总览 / 去水印精灵 / 壁纸头像 / 系统），活动项用左侧 3px 绿条 + `--primary-soft` 背景；图标用 `@heroicons/vue`（保持现有）。新增可收起（68px icon-only）。
- **Topbar**：新增面包屑（解决原「无面包屑」痛点）；搜索、刷新、主题切换、改密、退出保留。
- **PageHeader**：标题 + 副标题 + 右侧 actions 槽，统一各页头部。

## 4. 核心组件规范（统一到 Naive）
| 组件 | 规范 |
|------|------|
| Button | 主/次/幽灵/危险 4 级；44px 高；hover 提亮+位移；active scale .97；focus 绿环 |
| Card | elevated（默认）/ filled / outlined 三变体；radius 16；hover 轻微上浮 |
| StatCard | KPI 卡：数值(mono)+标签+趋势徽标；用于 Dashboard |
| Table | Naive `DataTable`；状态用 `Tag`（success/warning/error 语义色）；行 hover 绿底 |
| Form | Label 在上、错误在下；输入 radius 10、focus 绿边 |
| Tag/Badge | 语义色 soft 底；不超 2 色 |
| Modal | Naive `Dialog`；radius 16；统一 footer 操作区 |
| Empty/Loading/Error | 设计系统占位：骨架屏、教育性空状态文案、错误重试 |

## 5. 暗色模式对齐
- `<html class="dark">` 由 `App.vue` 主题开关控制，同时切换 `tokens.css` 变量 **与** `naive-theme.ts` 的 dark overrides（同一开关，两套同步）。
- 暗色表面用 cool slate（`#0B0F19`/`#111827`），**弃用**原 Naive 冷蓝灰（`#111827` 仅作 surface，整体统一为 slate 调性）。

## 6. 原型页（本次交付，供视觉确认）
- `prototypes/index.html` — Dashboard（概览）
- `prototypes/list.html` — 素材/资源管理（列表+表格+筛选）
- `prototypes/form.html` — 编辑/配置（表单+弹窗）
原型使用与生产一致的令牌，可切换明暗，确认后再铺开全量改造。

## 7. 降级与风险
- 令牌切换为渐进式：先落地 `tokens.css` + `naive-theme.ts`，再逐页替换硬编码色与自研类。
- 弃用自研类时保留兼容期（别名映射到 Naive），避免一次性回归。
