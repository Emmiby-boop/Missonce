# 实施计划 — Mini Admin 前端 UI 全面焕新

## 阶段 0：令牌地基（先落地，低风险）
- [ ] 1. 将 `src/design-system/tokens.css` 引入 `src/style.css` 或 `main.ts`
  - 在 `:root` 注入；确认 `.dark` 切换链路（`App.vue` → `localStorage('theme_preference')`）
  - _Requirement: 1, 2_
- [ ] 2. 用 `src/design-system/naive-theme.ts` 替换 `src/plugins/naive.ts` 的 light/dark overrides
  - `App.vue` 的 `NConfigProvider` 按主题取 `themeOverrides.light/dark`
  - _Requirement: 1_
- [ ] 3. 填充 `tailwind.config.js` 语义色映射（primary/accent/surface/border/text…）
  - 全局替换 `text-[var(--text-sub)]` 等任意值为语义类
  - _Requirement: 6_

## 阶段 1：布局骨架
- [ ] 4. 重写 `AdminSidebar.vue`：活动项绿条指示、可收起、分组导航对齐令牌
  - _Requirement: 5_
- [ ] 5. 重写 `AdminTopbar.vue`：新增面包屑；用户 pill / 主题切换 / 搜索对齐令牌
  - _Requirement: 1_
- [ ] 6. 统一 `PageHeader`：标题+副标题+actions 槽，全页复用
  - _Requirement: 4_

## 阶段 2：核心组件统一（收敛到 Naive）
- [ ] 7. 弃用自研 `.btn-*`/`.card`/`.input`，映射到 Naive 或令牌类（保留别名兼容期）
  - _Requirement: 1, 3_
- [ ] 8. 建立状态规范：Empty / Loading(骨架) / Error 占位组件
  - _Requirement: 4_

## 阶段 3：重点页面焕新
- [ ] 9. `DashboardPage` / `OperationsDashboardPage`：KPI StatCard + 图表 + 最近动态
  - _Requirement: 2, 3_
- [ ] 10. 列表类页（`ResourcesPage`/`UserManagerPage` 等）：统一筛选栏 + DataTable + 状态 Tag
  - _Requirement: 2, 3_
- [ ] 11. 表单/配置类页（`AIConfigPage`/`PointsConfigPage` 等）：统一表单布局 + Dialog
  - _Requirement: 3_

## 阶段 4：收尾
- [ ] 12. 清理 `components/animations/` 未用组件，保留的接入令牌动效
  - _Requirement: 1_
- [ ] 13. 全站明暗回归 + 响应式（<1024px）验证 + Lighthouse 抽查
  - _Requirement: 1, 5_

## 确认门（Gate）
- 原型页（Dashboard / 列表 / 表单）视觉确认通过后，再进入阶段 0 的实代码改造。
