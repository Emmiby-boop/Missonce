# 🚀 自动化部署指南

## 📋 部署脚本说明

本次已为您创建了两个自动化部署脚本，下次更新代码时只需要一键部署！

---

## 🎯 快速开始

### 方式一：使用 deploy.bat（推荐，最简单）

**双击运行 `deploy.bat`**

1. 修改代码后
2. 双击 `deploy.bat`
3. 等待自动构建
4. 选择上传方式
5. 完成！

---

### 方式二：使用 deploy.ps1（功能更强大）

**右键 → 使用PowerShell运行 `deploy.ps1`**

提供更多功能和更好的用户体验。

---

## 📦 脚本功能

两个脚本都会自动执行：

✅ 1. 检查 Node.js 环境  
✅ 2. 自动构建项目 (`npm run build`)  
✅ 3. 检查构建文件  
✅ 4. 提供多种上传方式  

---

## 🔧 上传方式

### 方式1：SCP 自动上传（推荐）

**前置要求：**
- Windows 10/11 自带 OpenSSH
- 或手动安装 OpenSSH 客户端

**使用步骤：**
1. 脚本运行时选择 `1`
2. 输入服务器密码
3. 自动上传完成！

**安装 OpenSSH（如果没有）：**
```powershell
# 以管理员身份运行 PowerShell
Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0
```

---

### 方式2：手动上传（最稳定）

**使用步骤：**
1. 脚本运行时选择 `2` 或 `3`
2. 打开宝塔面板
3. 进入 `/www/wwwroot/missonce.cc`
4. 删除所有旧文件
5. 上传 `dist` 目录内的所有文件

---

## 📝 服务器信息

| 项目 | 值 |
|------|-----|
| 服务器 IP | 95.40.97.36 |
| 用户名 | root |
| 网站目录 | /www/wwwroot/missonce.cc |
| 宝塔面板 | http://95.40.97.36:8888 |
| 网站访问 | https://missonce.cc |

---

## 🔄 完整部署流程（手动步骤）

如果脚本无法使用，手动部署步骤：

### 1. 构建项目
```bash
cd "Mini admin"
npm run build
```

### 2. 上传文件
将 `dist` 目录内的所有文件上传到服务器：
```
/www/wwwroot/missonce.cc/
```

### 3. 完成！
访问 https://missonce.cc

---

## ⚠️ 注意事项

1. **确保 Node.js 已安装**
2. **上传前先备份重要数据
3. **确保服务器网络连接正常
4. **上传后检查文件权限

---

## 🎉 部署成功后

访问您的网站：
- 🌐 https://missonce.cc
- 🌐 https://www.missonce.cc

---

## 🔙 回退到 CloudBase

如果以后想换回 CloudBase 部署：

```bash
npm run deploy
```

---

## 📞 需要帮助？

遇到问题时：
1. 检查错误信息
2. 查看服务器日志
3. 回退到上一个版本

---

**祝您使用愉快！** 🚀
