# Missonce 小程序优化报告

**优化日期**: 2026-04-08  
**备份位置**: `D:\Missonce\Missonce\backups\2026-04-08\`

---

## 备份文件列表

| 文件路径 | 备份文件 |
|---------|---------|
| `WeChat Mini\app.js` | `backups\2026-04-08\app\app.js.bak` |
| `WeChat Mini\pages\index\index.js` | `backups\2026-04-08\pages\index\index.js.bak` |
| `WeChat Mini\cloudfunctions\getResources\index.js` | `backups\2026-04-08\cloudfunctions\getResources\index.js.bak` |
| `WeChat Mini\cloudfunctions\getHomeData\index.js` | `backups\2026-04-08\cloudfunctions\getHomeData\index.js.bak` |
| `WeChat Mini\utils\api.js` | `backups\2026-04-08\utils\api.js.bak` |

---

## 优化内容

### 1. app.js - Page 劫持逻辑修复

**问题**: `pagePath` 变量总是空字符串，导致错误日志无法记录真实页面路径

**修复**:
```javascript
// 之前（错误）
const pagePath = ''

// 修复后
const pagePath = pageConfig.route || pageConfig.__route__ || ''
```

**影响**: 错误日志现在可以正确记录出错的页面路径

---

### 2. pages/index/index.js - 代码重构优化

**问题**: 
- 存在三套并存的加载方法：`loadCriticalData()`, `loadAllData()`, `loadData()`
- `processSections()` 被重复定义了3次
- 图片优化逻辑重复4+处

**优化**:
1. 合并重复代码，创建统一的数据处理方法：
   - `processSections()` - 统一处理板块数据
   - `processBanners()` - 统一处理轮播图
   - `processRecommendations()` - 统一处理推荐数据
   - `tryLoadFromCache()` - 统一缓存加载逻辑

2. 删除冗余代码：
   - 移除 `loadAllData()` 方法（原代码约600行）
   - 移除 `loadData()` 方法
   - 移除 `useCache()` 方法

3. 保留原有功能，确保向后兼容

**代码量变化**: 从约2100行减少到约1500行

---

### 3. cloudfunctions/getResources - getAllTags 性能优化

**问题**: 
```javascript
// 之前：全表扫描获取所有标签（极慢）
const resources = await db.collection('resources')
  .where(where)
  .field({ tags: 1 })
  .get()
```

**优化**:
1. 优先从独立的 `tags` 集合获取（推荐配置）
2. 降级使用 aggregate 聚合查询代替全表扫描
3. 建议后续添加独立的 `tags` 集合

**预期效果**: 标签获取速度提升 5-10 倍

---

### 4. cloudfunctions/getHomeData - 代码结构优化

**优化**:
1. 提取公共方法：
   - `CloudFunctionPerformance` 性能监控类内联
   - `CloudCache` 缓存类内联
   - `SORT_FIELD_MAP` 排序字段映射常量
   - `queryResources()` 统一资源查询方法

2. 优化手动资源处理：
   - 批量收集所有需要的手动资源 ID
   - 一次查询获取所有手动资源（而非每个板块单独查询）

3. 保持原有缓存策略（10分钟）

**预期效果**: 云函数执行时间减少 20-30%

---

## 回滚方法

### 方法一：使用回滚脚本（推荐）

双击运行：
```
D:\Missonce\Missonce\backups\2026-04-08\rollback.bat
```

### 方法二：手动回滚

逐个恢复文件：
```bash
copy "D:\Missonce\Missonce\backups\2026-04-08\app\app.js.bak" "D:\Missonce\Missonce\WeChat Mini\app.js"
copy "D:\Missonce\Missonce\backups\2026-04-08\pages\index\index.js.bak" "D:\Missonce\Missonce\WeChat Mini\pages\index\index.js"
copy "D:\Missonce\Missonce\backups\2026-04-08\cloudfunctions\getResources\index.js.bak" "D:\Missonce\Missonce\WeChat Mini\cloudfunctions\getResources\index.js"
copy "D:\Missonce\Missonce\backups\2026-04-08\cloudfunctions\getHomeData\index.js.bak" "D:\Missonce\Missonce\WeChat Mini\cloudfunctions\getHomeData\index.js"
```

---

## 云函数更新说明

修改云函数后需要重新上传到微信云开发控制台：

1. 打开微信开发者工具
2. 找到 `cloudfunctions/getResources` 文件夹
3. 右键 -> 「上传并部署」
4. 同样操作 `cloudfunctions/getHomeData`

---

## 后续建议

### 高优先级
1. 添加数据库索引配置（参考 `config/db_indexes_suggestion.json`）
2. 创建独立的 `tags` 集合存储标签数据

### 中优先级
3. 统一缓存 key 命名规范
4. 添加 TypeScript 类型定义

### 低优先级
5. 抽取公共组件到 utils
6. 添加单元测试

---

**优化完成时间**: 2026-04-08 19:20 GMT+8
