#!/bin/bash

# ============================================
# Missonce 后台管理系统 - 宝塔面板一键安装脚本
# ============================================

echo "=========================================="
echo "  Missonce 后台管理系统 - 宝塔面板安装"
echo "=========================================="
echo ""

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then 
    echo "❌ 请使用 root 用户执行此脚本"
    echo "   运行: sudo su"
    exit 1
fi

# 检测系统类型
echo "🔍 检测系统类型..."
if [ -f /etc/redhat-release ]; then
    OS="CentOS"
    echo "✅ 检测到: CentOS"
elif [ -f /etc/debian_version ]; then
    if grep -q "Ubuntu" /etc/os-release; then
        OS="Ubuntu"
        echo "✅ 检测到: Ubuntu"
    else
        OS="Debian"
        echo "✅ 检测到: Debian"
    fi
else
    echo "❌ 不支持的系统类型"
    exit 1
fi

# 安装宝塔面板
echo ""
echo "🚀 开始安装宝塔面板..."
echo ""

if [ "$OS" = "CentOS" ]; then
    yum install -y wget
    wget -O install.sh http://download.bt.cn/install/install_6.0.sh
    echo "y" | sh install.sh
elif [ "$OS" = "Ubuntu" ] || [ "$OS" = "Debian" ]; then
    apt update
    apt install -y wget
    wget -O install.sh http://download.bt.cn/install/install-ubuntu_6.0.sh
    echo "y" | bash install.sh
fi

echo ""
echo "=========================================="
echo "  ✅ 宝塔面板安装完成！"
echo "=========================================="
echo ""
echo "📝 请保存上方显示的面板地址、用户名和密码"
echo ""
echo "📋 下一步操作："
echo "   1. 在浏览器访问宝塔面板"
echo "   2. 安装 Nginx"
echo "   3. 创建网站并上传文件"
echo ""
echo "📖 详细部署指南请查看: BAOTA_DEPLOY.md"
echo ""
