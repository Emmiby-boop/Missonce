# 部署到云服务器指南

## 📋 前置准备

- 一台云服务器（阿里云/腾讯云/华为云等）
- 服务器系统：Ubuntu 20.04+ 或 CentOS 7+
- 域名（可选，用于备案后绑定）

---

## 🚀 部署方案一：Nginx 直接部署（推荐）

### 1. 本地构建项目

```bash
cd "Mini admin"
npm run build
```

构建完成后，会生成 `dist` 目录。

### 2. 服务器环境准备

#### 2.1 连接服务器
```bash
ssh root@your-server-ip
```

#### 2.2 安装 Nginx

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install nginx -y
```

**CentOS/RHEL:**
```bash
sudo yum install nginx -y
```

#### 2.3 启动 Nginx
```bash
sudo systemctl start nginx
sudo systemctl enable nginx  # 设置开机自启
```

### 3. 上传文件到服务器

#### 方法一：使用 scp 命令（本地执行）
```bash
# 在 Mini admin 目录下执行
scp -r dist/* root@your-server-ip:/var/www/html/
```

#### 方法二：使用 FileZilla 等 FTP 工具
1. 连接服务器
2. 将 `dist` 目录下的所有文件上传到 `/var/www/html/`

### 4. 配置 Nginx

在服务器上编辑 Nginx 配置：

```bash
sudo nano /etc/nginx/sites-available/default
```

用项目中的 `nginx.conf` 内容替换，或者直接复制：

```bash
# 本地执行（在 Mini admin 目录下
scp nginx.conf root@your-server-ip:/etc/nginx/conf.d/default.conf
```

### 5. 重启 Nginx

```bash
# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
```

### 6. 配置防火墙

```bash
# Ubuntu/Debian (ufw)
sudo ufw allow 'Nginx Full'

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

---

## 🐳 部署方案二：Docker 部署

### 1. 服务器安装 Docker

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | bash

# 启动 Docker
sudo systemctl start docker
sudo systemctl enable docker
```

### 2. 上传项目到服务器

将整个 `Mini admin` 目录上传到服务器。

### 3. 构建并运行容器

```bash
cd /path/to/Mini-admin

# 构建镜像
docker build -t missonce-admin .

# 运行容器
docker run -d \
  --name missonce-admin \
  -p 80:80 \
  --restart unless-stopped \
  missonce-admin
```

---

## 🔒 配置 HTTPS（Let's Encrypt 免费证书）

### 1. 安装 Certbot

```bash
# Ubuntu/Debian
sudo apt install certbot python3-certbot-nginx -y

# CentOS/RHEL
sudo yum install certbot python3-certbot-nginx -y
```

### 2. 获取证书

```bash
sudo certbot --nginx -d your-domain.com
```

按照提示操作，Certbot 会自动配置 Nginx。

### 3. 自动续期

```bash
# 测试续期
sudo certbot renew --dry-run

# Certbot 会自动配置定时任务自动续期
```

---

## 📝 备案指南

如果服务器在中国大陆，需要备案：

### 1. 提交备案申请
1. 登录云服务商控制台
2. 进入备案管理页面
3. 选择你的服务器
4. 提交备案申请

### 2. 准备材料
- 个人身份证
- 域名证书
- 网站真实性核验单
- 幕布照片（部分服务商需要）

### 3. 备案通过后
- 在云服务商控制台绑定域名
- 解析域名 A 记录到服务器 IP
- 更新 Nginx 配置中的 server_name

---

## 🔄 回退到 CloudBase

如果以后想换回 CloudBase，只需：

```bash
cd "Mini admin"
npm run deploy
```

---

## 📞 常见问题

### 访问 403 Forbidden
检查文件权限：
```bash
sudo chown -R www-data:www-data /var/www/html
sudo chmod -R 755 /var/www/html
```

### 访问 500 Internal Server Error
查看 Nginx 日志：
```bash
sudo tail -f /var/log/nginx/error.log
```

### Vue 路由刷新 404
确保 Nginx 配置中有 `try_files $uri $uri/ /index.html;`
