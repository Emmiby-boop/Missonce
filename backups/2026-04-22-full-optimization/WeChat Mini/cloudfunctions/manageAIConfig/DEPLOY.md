# AI 配置云函数部署指南

## 概述

为了解决后台管理系统无法直接写入 AI 配置到数据库的问题，我们创建了 `manageAIConfig` 云函数。

## 创建的文件

1. **云函数**：`WeChat Mini/cloudfunctions/manageAIConfig/`
   - `index.js` - 云函数主逻辑
   - `package.json` - 云函数依赖配置

2. **修改的文件**：
   - `Mini admin/src/pages/AIConfigPage.vue` - 修改 AI 配置页面使用云函数

## 部署步骤

### 1. 部署云函数

#### 方法一：在微信开发者工具中部署

1. 打开微信开发者工具
2. 打开项目：`d:\Missonce\Missonce\WeChat Mini`
3. 在左侧文件目录中找到 `cloudfunctions/manageAIConfig` 文件夹
4. 右键点击该文件夹
5. 选择「上传并部署：云端安装依赖（不上传 node_modules）」
6. 等待部署完成

#### 方法二：使用云开发控制台

1. 打开微信开发者工具
2. 点击「云开发」进入云开发控制台
3. 点击「云函数」
4. 点击「新建云函数」
5. 函数名称填写：`manageAIConfig`
6. 创建完成后，将 `index.js` 和 `package.json` 的内容复制到云函数中
7. 点击「保存并安装依赖」
8. 等待部署完成

### 2. 验证云函数部署

1. 在云开发控制台的「云函数」页面找到 `manageAIConfig`
2. 点击「测试」
3. 输入测试参数：
   ```json
   {
     "action": "get"
   }
   ```
4. 点击「调用测试」
5. 检查返回结果是否包含 `success: true`

### 3. 重新构建后台管理系统

如果需要重新部署后台管理系统：

```bash
cd "Mini admin"
npm run build
```

然后部署到静态云托管。

## 云函数功能说明

`manageAIConfig` 云函数支持以下操作：

### 1. 获取配置 - `action: "get"`

获取所有 AI 相关配置，包括：
- AI 模型配置
- 分类白名单
- 标签白名单
- API Keys 列表
- 文案配置

### 2. 保存 AI 配置 - `action: "saveAIConfig"`

保存 AI 模型配置（API Key、模型、系统提示词等）

### 3. 保存分类白名单 - `action: "saveCategories"`

保存分类白名单

### 4. 保存标签白名单 - `action: "saveTags"`

保存标签白名单

### 5. 保存文案配置 - `action: "saveWriterConfig"`

保存文案生成器的配置和场景

### 6. 保存文案库 - `action: "saveFeaturedQuotes"`

保存精选文案库

## 常见问题

### Q: 云函数部署失败怎么办？
A: 
1. 检查云开发环境是否正确
2. 检查 `package.json` 中的依赖是否正确
3. 尝试删除云函数后重新创建

### Q: 后台仍然无法保存配置？
A:
1. 确认云函数已成功部署
2. 检查浏览器控制台的错误信息
3. 确认后台管理系统已重新构建并部署

### Q: 云函数调用失败？
A:
1. 检查云函数日志（云开发控制台 → 云函数 → 日志）
2. 确认云函数权限配置正确
3. 确认数据库集合存在

## 数据库集合

确保以下数据库集合存在：
- `sys_config` - 系统配置
- `api_keys` - API Keys（可选）

如果集合不存在，云函数会自动创建需要的文档。
