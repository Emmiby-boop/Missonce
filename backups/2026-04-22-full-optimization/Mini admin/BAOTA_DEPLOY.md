# 宝塔面板部署指南

## 📋 服务器信息
- IP: 95.40.97.36
- 用户名: root
- 密码: emly123456

---

## 🔧 第一步：连接服务器

使用 SSH 工具连接服务器：

**方式一：使用 PowerShell/CMD**
```bash
ssh root@95.40.97.36
```
输入密码：`emly123456`

**方式二：使用 Xshell/Putty/ Finalshell**
- 主机：95.40.97.36
- 端口：22
- 用户名：root
- 密码：emly123456

---

## 🚀 第二步：安装宝塔面板

连接服务器后，执行以下命令：

### 检查系统类型
```bash
cat /etc/os-release
```

### CentOS 安装命令
```bash
yum install -y wget && wget -O install.sh http://download.bt.cn/install/install_6.0.sh && sh install.sh
```

### Ubuntu/Debian 安装命令
```bash
wget -O install.sh http://download.bt.cn/install/install-ubuntu_6.0.sh && sudo bash install.sh
```

### 安装过程中
- 输入 `y` 确认安装
- 等待 5-10 分钟

---

## 📝 第三步：宝塔面板配置

### 安装完成后，会显示：
```
==================================================================
Congratulations! Installed successfully!
==================================================================
外网面板地址: http://95.40.97.36:8888/xxxxxx
内网面板地址: http://xx.xx.xx.xx:8888/xxxxxx
username: xxxxx
password: xxxxx
==================================================================
```

**请保存好这些信息！**

### 登录宝塔面板
1. 在浏览器中访问：`http://95.40.97.36:8888/xxxxxx`（替换为实际地址）
2. 输入用户名和密码
3. 首次登录会提示绑定账号（免费注册）

---

## 💻 第四步：安装 Nginx

登录宝塔面板后：

1. 左侧菜单 → **软件商店**
2. 搜索 **Nginx**
3. 点击 **安装**（选择极速安装）
4. 等待安装完成

---

## 📂 第五步：创建网站

1. 左侧菜单 → **网站**
2. 点击 **添加站点**
3. 填写信息：
   - 域名：`95.40.97.36`（先填IP，后续可以换域名）
   - 数据库：不创建
   - PHP：纯静态
4. 点击 **提交**

---

## 📤 第六步：上传文件

### 方式一：宝塔文件管理器（推荐）

1. 左侧菜单 → **文件**
2. 进入目录：`/www/wwwroot/95.40.97.36`
3. 删除默认文件（index.html）
4. 点击 **上传**
5. 将本地 `Mini admin/dist` 目录下的所有文件上传

### 方式二：使用 FTP 工具

使用 FileZilla 等工具连接：
- 主机：95.40.97.36
- 端口：21
- 用户名：宝塔创建的FTP账号
- 密码：宝塔创建的FTP密码
- 目录：`/www/wwwroot/95.40.97.36`

---

## ⚙️ 第七步：配置 Nginx

1. 左侧菜单 → **网站**
2. 找到刚创建的网站，点击 **设置**
3. 选择 **配置文件** 选项卡
4. 用以下内容替换原有配置：

```nginx
server {
    listen 80;
    server_name 95.40.97.36;

    root /www/wwwroot/95.40.97.36;
    index index.html;

    # 启用 gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;

    # Vue Router history 模式配置
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

5. 点击 **保存**

---

## 🔒 第八步：配置防火墙（如需要）

如果无法访问，检查防火墙：

### 宝塔面板安全设置
1. 左侧菜单 → **安全**
2. 放行端口：80、443、8888

### 云服务商安全组
在阿里云/腾讯云/华为云控制台，放行：
- TCP: 80
- TCP: 443
- TCP: 8888

---

## 🌐 第九步：访问网站

在浏览器中访问：
```
http://95.40.97.36
```

---

## 📌 后续：绑定域名和 HTTPS

### 绑定域名
1. 左侧菜单 → **网站**
2. 点击网站的 **设置**
3. **域名管理** → 添加您的域名
4. 在域名 DNS 解析中添加 A 记录，指向 95.40.97.36

### 配置 HTTPS（免费证书）
1. 网站设置 → **SSL**
2. 选择 **Let's Encrypt**
3. 勾选域名
4. 点击 **申请**
5. 开启 **强制 HTTPS**

---

## 🔄 回退到 CloudBase

如果以后想换回 CloudBase：

```bash
cd "Mini admin"
npm run deploy
```

---

## ⚠️ 注意事项

1. **安全第一**：登录宝塔后请立即修改面板密码
2. **定期备份**：在宝塔面板中设置自动备份
3. **系统更新**：定期更新系统和软件
4. **密码安全**：不要将服务器密码分享给他人

---

## 📞 需要帮助？

如果遇到问题，请告诉我：
- 执行到哪一步了
- 具体的错误信息
- 截图（如有）
