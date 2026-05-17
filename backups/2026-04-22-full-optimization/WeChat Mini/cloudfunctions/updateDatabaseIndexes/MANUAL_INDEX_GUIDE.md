# 数据库索引 — 操作指南

> **优先方式：云函数自动创建**（见下方「方式一」）  
> **备用方式：控制台手动创建**（见下方「方式二」，仅云函数调用失败时使用）

---

## 方式一：云函数自动创建（推荐）

### 操作步骤

1. **确保云函数已更新**
   在微信开发者工具中，右键 `cloudfunctions/updateDatabaseIndexes` → **「上传并部署（云端安装依赖）」**

2. **调用云函数**
   在开发者工具的「云开发控制台」→「云函数」→ `updateDatabaseIndexes` → 「调用」

3. **查看日志确认结果**
   点击「日志」，查看返回值：
   - `summary.totalSuccess` = 成功创建的索引数
   - `summary.totalSkipped` = 已存在跳过的索引数
   - `summary.totalFailed` = 创建失败的索引数（需用方式二补救）

### 将会创建的索引

**resources 表（6 个）**

| 索引名 | 字段 | 用途 |
|--------|------|------|
| `type_status_hotScore_createdAt` | type↑, status↑, hotScore↓, createdAt↓ | 首页类型+热度排序 |
| `categories_status_hotScore` | categories↑, status↑, hotScore↓ | 分类板块热度排序 |
| `categories_status_createdAt` | categories↑, status↑, createdAt↓ | 分类板块最新 |
| `status_hotScore_createdAt` | status↑, hotScore↓, createdAt↓ | 全量热门 |
| `status_createdAt` | status↑, createdAt↓ | 最新资源 |
| `tags_status_hotScore` | tags↑, status↑, hotScore↓ | 标签筛选 |

**其他表（各 1~2 个）**
- `banners.status_sort`
- `home_sections.enable_sort`
- `favorites.openid_type_createTime` / `openid_resourceId`
- `downloads.openid_createTime`
- `browse_history.openid_createTime`
- `topics.status_sort`

---

## 方式二：控制台手动创建（备用）

### 操作入口

1. 微信开发者工具 → 点「云开发」（右上角）
2. 进入「数据库」→ 选择对应集合 → 「索引」Tab → 「添加索引」

### resources 表 — JSON 索引定义

切换到「JSON」模式，逐一添加以下 6 个索引：

```
① type_status_hotScore_createdAt
[type 升序, status 升序, hotScore 降序, createdAt 降序]

② categories_status_hotScore
[categories 升序, status 升序, hotScore 降序]

③ categories_status_createdAt
[categories 升序, status 升序, createdAt 降序]

④ status_hotScore_createdAt
[status 升序, hotScore 降序, createdAt 降序]

⑤ status_createdAt
[status 升序, createdAt 降序]

⑥ tags_status_hotScore
[tags 升序, status 升序, hotScore 降序]
```

### 删除无效索引

以下索引字段名与代码不匹配，建议删除：
- `category_status`（代码查的是 `categories` 不是 `category`，命中 0 次）

### 其他表

| 表名 | 索引名 | JSON |
|------|--------|------|
| banners | status_sort | [status 升序, sort 升序] |
| home_sections | enable_sort | [enable 升序, sort 升序] |

---

## 索引生效时间

索引创建后，通常 **几秒到 1 分钟内** 生效。

**验证方法：** 在云函数日志里观察数据库查询耗时。如果查询耗时明显下降（从几百毫秒降到几十毫秒），说明索引已生效。
