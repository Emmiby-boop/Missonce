# AI 功能部署指南

## 📦 新增功能概览

### 1. 智能推荐系统
- **云函数**: `getRecommendations`
- **功能**: 个性化推荐 + 相关资源推荐
- **算法**: 内容推荐 + 协同过滤 + 热门兜底

### 2. 智能运营助手
- **云函数**: `operationsAssistant`
- **功能**: 数据看板 + 趋势预测 + 内容质量检查
- **管理后台页面**: `OperationsDashboardPage.vue`

---

## 🚀 部署步骤

### 第一步：部署云函数

#### 1.1 部署 getRecommendations

```bash
cd WeChat Mini/cloudfunctions/getRecommendations
npm install
```

然后在微信开发者工具中右键点击 `getRecommendations` 文件夹，选择「上传并部署：云端安装依赖」

#### 1.2 部署 operationsAssistant

```bash
cd WeChat Mini/cloudfunctions/operationsAssistant
npm install
```

同样在微信开发者工具中右键点击 `operationsAssistant` 文件夹，选择「上传并部署：云端安装依赖」

### 第二步：更新小程序前端

前端 API 已自动更新，无需额外修改。推荐功能会通过 `getPersonalizedRecommendations` 和 `getRelatedRecommendations` 调用。

### 第三步：更新管理后台

在管理后台的路由配置中添加运营数据看板页面。

---

## 📊 智能推荐系统详解

### 核心功能

#### 1. 个性化推荐 (`action: 'personalized'`)
- **用户画像构建**: 基于30天内的浏览、收藏行为
- **内容推荐**: 根据分类、标签偏好匹配
- **协同过滤**: 找到相似用户的偏好
- **热门兜底**: 新用户或数据不足时返回热门内容
- **缓存机制**: 5分钟缓存，提升响应速度

#### 2. 相关推荐 (`action: 'related'`)
- 基于当前资源的分类、标签、类型
- 排除当前资源，推荐相似内容
- 按热度排序确保质量

### 使用示例

```javascript
// 获取个性化推荐
const recommendations = await getPersonalizedRecommendations(10)

// 获取相关推荐
const related = await getRelatedRecommendations(resourceId, 6)
```

---

## 🎯 智能运营助手详解

### 核心功能

#### 1. 数据看板 (`action: 'dashboard'`)
- **概览数据**: 总用户、活跃用户、新用户、资源数、浏览量等
- **7天趋势**: 每日浏览、下载、收藏、活跃用户趋势
- **分类分布**: 资源分类统计
- **热门资源**: Top 10 热门资源
- **热门分类/标签**: 近期热门的分类和标签

#### 2. 趋势预测 (`action: 'trendPrediction'`)
- **上升分类**: 近期热度上升的分类
- **上升标签**: 近期热度上升的标签
- **智能建议**: 基于趋势给出运营建议

#### 3. 内容质量检查 (`action: 'qualityCheck'`)
- **低质量资源**: 缺少标签/分类、热度低的资源
- **AI待处理**: AI分析失败或未处理的资源
- **优化建议**: 自动生成需要优化的资源列表

### 使用示例

```javascript
// 获取看板数据
const dashboard = await wx.cloud.callFunction({
  name: 'operationsAssistant',
  data: { action: 'dashboard', days: 7 }
})

// 获取趋势预测
const prediction = await wx.cloud.callFunction({
  name: 'operationsAssistant',
  data: { action: 'trendPrediction' }
})

// 质量检查
const quality = await wx.cloud.callFunction({
  name: 'operationsAssistant',
  data: { action: 'qualityCheck' }
})
```

---

## 🗄️ 数据库集合说明

### 已有集合（无需创建）
- `events`: 用户行为事件（已有）
- `favorites`: 用户收藏（已有）
- `resources`: 资源库（已有）
- `sys_user`: 用户表（已有）

### 推荐系统依赖的字段
- `resources.hotScore`: 热度分数
- `resources.categories`: 分类数组
- `resources.tags`: 标签数组
- `resources.type`: 资源类型（avatar/wallpaper）

---

## ⚙️ 性能优化建议

### 1. 数据库索引
建议为以下字段添加索引：
```javascript
// events 集合
{ _openid: 1, createTime: -1 }

// resources 集合
{ type: 1, hotScore: -1 }
{ categories: 1 }
{ tags: 1 }
```

### 2. 缓存策略
- 推荐结果缓存 5 分钟
- 运营数据缓存 10 分钟
- 可通过云函数代码调整

### 3. API 调用频率
- 个性化推荐：用户进入首页时调用
- 相关推荐：进入资源详情页时调用
- 运营看板：管理员手动刷新或定时更新

---

## 🔧 故障排查

### 问题1: 推荐云函数报错
**检查**: 
- 云函数是否正确部署
- 数据库集合是否存在
- 查看云函数日志

### 问题2: 推荐结果为空
**原因**: 用户行为数据不足
**解决**: 系统会自动返回热门资源作为兜底

### 问题3: 运营数据不准确
**检查**: 
- events 表是否有数据
- 时间范围是否正确
- 确认资源字段完整性

---

## 📈 后续优化方向

### 推荐系统
- [ ] 引入深度学习模型
- [ ] 实时推荐更新
- [ ] A/B 测试框架
- [ ] 推荐结果解释

### 运营助手
- [ ] 定时报告生成
- [ ] 异常检测告警
- [ ] 智能内容推荐
- [ ] 用户分群分析

---

## 📝 注意事项

1. **数据隐私**: 所有用户行为数据均存储在腾讯云开发，符合微信小程序隐私规范
2. **成本控制**: 云函数调用次数会增加，建议监控用量
3. **冷启动**: 新用户前几次推荐以热门内容为主
4. **数据同步**: 确保 events 表正确记录用户行为

---

**部署完成后，即可开始使用智能推荐和运营助手功能！** 🎉
