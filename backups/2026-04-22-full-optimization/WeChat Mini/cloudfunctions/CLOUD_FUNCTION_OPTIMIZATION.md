# 🚀 云函数全面优化方案

## 📊 一、优化概述

本文档详细说明了云函数的全面优化方案，包括性能提升、缓存策略、监控系统等内容。

---

## 🎯 二、已完成的优化

### 2.1 核心云函数优化

| 云函数 | 优化内容 | 预期提升 |
|---------|---------|
| **getHomeData** | ✅ 性能监控 + 缓存策略 + 字段选择 + 分类预加载 + 并行查询 | ⬆️ 60-80% |
| **getResources** | ✅ 性能监控 + 字段选择 + 查询优化 | ⬆️ 30-50% |
| **getTopics** | ✅ 性能监控 + 字段选择 | ⬆️ 20-40% |

### 2.2 新增工具模块

| 文件 | 功能 |
|------|------|
| `utils/performance.js` | 云函数性能监控工具 |
| `utils/cache.js` | 云函数缓存管理工具 |

---

## 🔧 三、优化详情

### 3.1 性能优化策略

#### 3.1.1 字段选择优化 (Field Projection)

**优化前**：
```javascript
// 查询所有字段，包括不需要的大字段
const res = await db.collection('resources').get()
```

**优化后**：
```javascript
// 只查询需要的字段
const res = await db.collection('resources')
  .field({
    _id: true,
    title: true,
    type: true,
    coverUrl: true,
    // 只选择需要的字段
  })
  .get()
```

**效果**：减少数据传输量 50-70%

---

#### 3.1.2 分类预加载优化

**优化前**：
```javascript
// 每个板块都去查询 categories 表
const catRes = await db.collection('categories').where({ name: category }).get()
```

**优化后**：
```javascript
// 一次性预加载所有分类，构建 Map
const categoriesResult = await db.collection('categories').where({ enabled: true }).get()
const categoryMap = {}
categories.forEach(cat => {
  categoryMap[cat.name] = cat.key
  categoryMap[cat.key] = cat.key
})
```

**效果**：减少数据库查询次数 N → 1

---

#### 3.1.3 并行查询优化

**优化前**：
```javascript
// 串行查询
const wallpaperRes = await wallpaperQuery.limit(totalLimit).get()
const avatarRes = await avatarQuery.limit(neededAvatars).get()
```

**优化后**：
```javascript
// 并行查询
const [wallpaperRes, avatarRes] = await Promise.all([
  wallpaperQuery.limit(totalLimit).get(),
  avatarQuery.limit(neededAvatars).get()
])
```

**效果**：减少查询时间 50%

---

### 3.2 缓存策略

#### 3.2.1 缓存工具使用

```javascript
const CloudCache = require('../utils/cache.js')
const cache = new CloudCache({ defaultTTL: 5 * 60 * 1000 })

// 使用缓存
const cacheKey = 'home_data_v1'
const cachedData = await cache.get(cacheKey)

if (cachedData) {
  return cachedData
}

// 获取新数据
const result = await fetchData()
await cache.set(cacheKey, result, 5 * 60 * 1000)
```

#### 3.2.2 缓存 TTL 建议

| 数据类型 | TTL 建议 |
|---------|-----------|
| 首页数据 | 5-10 分钟 |
| 专题列表 | 2-5 分钟 |
| 分类/标签 | 30 分钟 - 1 小时 |

---

### 3.3 性能监控系统

#### 3.3.1 监控工具使用

```javascript
const CloudFunctionPerformance = require('../utils/performance.js')

exports.main = async (event, context) => {
  const perf = new CloudFunctionPerformance()
  
  try {
    perf.markMilestone('初始化完成')
    
    // ... 业务逻辑
    perf.markMilestone('数据查询完成')
    
    // 跟踪数据库查询
    const queryStart = Date.now()
    const res = await db.collection('xxx').get()
    perf.trackDatabaseQuery('xxx', 'query', queryStart)
    
    perf.markMilestone('处理完成')
    perf.logSummary()
    
    return result
  } catch (err) {
    perf.logSummary()
    return { success: false, error: err }
  }
}
```

#### 3.3.2 监控输出示例

```
[Performance] ⏱️  初始化完成: 5ms
[Performance] ⏱️  数据查询完成: 150ms
[DB Query] 📊 resources.query: 120ms
[Performance] 📈 云函数执行总结
  ├─ 总耗时: 320ms
  ├─ 数据库查询: 2次, 总耗时: 240ms
  └─ 里程碑: {...}
```

---

## ⚙️ 四、云函数配置建议

### 4.1 内存配置

| 云函数 | 建议内存 | 超时时间 |
|---------|----------|---------|
| **getHomeData** | 512MB | 20s |
| **getResources** | 256MB | 15s |
| **getTopics** | 256MB | 10s |
| **其他** | 256MB | 10s |

### 4.2 配置方法 (cloudbaserc.json)

```json
{
  "version": "1.0.0",
  "envId": "your-env-id",
  "functionRoot": "./",
  "functions": [
    {
      "name": "getHomeData",
      "config": {
        "memorySize": 512,
        "timeout": 20,
        "envVariables": {}
      }
    },
    {
      "name": "getHomeData",
      "config": {
        "memorySize": 256,
        "timeout": 15
      }
    }
  ]
}
```

---

## 📈 五、数据库索引优化建议

### 5.1 建议索引

| 集合 | 字段 | 索引类型 | 说明 |
|------|------|---------|------|
| **resources** | `status` + `type` + `createdAt` | 复合索引 | 状态+类型+时间查询 |
| **resources** | `status` + `type` + `hotScore` | 复合索引 | 热度排序查询 |
| **resources** | `categories` | 数组索引 | 分类查询 |
| **resources** | `tags` | 数组索引 | 标签查询 |
| **home_sections** | `enable` + `sort` | 复合索引 | 启用+排序查询 |
| **topics** | `status` + `sort` | 复合索引 | 状态+排序查询 |
| **banners** | `status` + `sort` | 复合索引 | 状态+排序查询 |

### 5.2 索引创建云函数

使用 `updateDatabaseIndexes` 云函数创建索引。

---

## 🔍 六、监控与调试

### 6.1 云函数日志查看

1. 登录微信云开发控制台
2. 选择云函数 → 日志
3. 查看实时日志和历史日志

### 6.2 性能监控指标

| 指标 | 目标值 | 说明 |
|------|--------|------|
| **冷启动时间 | < 500ms | 首次调用时间 |
| **平均响应时间 | < 500ms | 正常调用时间 |
| **P95 响应时间** | < 2s | 95% 请求在 2s 内 |
| **错误率** | < 1% | 错误请求占比 |

---

## 📝 七、部署步骤

### 7.1 部署优化后的云函数

```bash
# 1. 安装依赖
cd cloudfunctions/getHomeData
npm install

# 2. 上传并部署云函数
# 在微信开发者工具中右键云函数文件夹 → 上传并部署：云端安装依赖
```

### 7.2 创建缓存集合

首次使用缓存功能需要先创建 `cloud_cache` 集合：

1. 微信云开发控制台 → 数据库
2. 新增集合 → 名称：`cloud_cache`
3. 设置权限：仅创建者可读写

---

## 🎉 八、预期效果

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| **首页加载时间 | 2-4s | 500ms-1.5s | ⬇️ 60-75% |
| **专题列表加载 | 1.5-3s | 500ms-1s | ⬇️ 50-60% |
| **缓存命中率 | 0% | 70-90% | ⬆️ |

---

## 📚 九、后续优化方向

### 9.1 短期优化 (1-2周)

- [ ] 云函数预热策略优化
- [ ] 进一步优化数据库查询
- [ ] 添加更多云函数的优化
- [ ] 数据库读写分离

### 9.2 中期优化 (1个月)

- [ ] 引入 Redis 缓存 (需自建服务器)
- [ ] 云函数并发控制
- [ ] 静态资源 CDN 加速

### 9.3 长期优化 (3个月+)

- [ ] 考虑迁移到云服务器 (CVM)
- [ ] 自建 Node.js 后端
- [ ] 微服务架构

---

## 📞 十、联系方式

如有问题，请查看云函数日志或联系开发团队。

---

**最后更新**: 2026-02-16
