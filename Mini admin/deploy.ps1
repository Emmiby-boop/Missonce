# ============================================
# Missonce 后台管理系统 - PowerShell 一键部署脚本
# ============================================

$ErrorActionPreference = "Stop"

# 配置信息
$SERVER_IP = "95.40.97.36"
$SERVER_USER = "root"
$SERVER_PATH = "/www/wwwroot/missonce.cc"
$LOCAL_PATH = "dist"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Missonce 后台管理系统 - 一键部署" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 步骤1: 检查 Node.js
Write-Host "[1/4] 检查 Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "   Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "   ❌ 错误: 未找到 Node.js，请先安装 Node.js" -ForegroundColor Red
    Read-Host "按回车键退出"
    exit 1
}

# 步骤2: 构建项目
Write-Host ""
Write-Host "[2/4] 构建项目..." -ForegroundColor Yellow
try {
    npm run build
    Write-Host "   ✅ 项目构建成功" -ForegroundColor Green
} catch {
    Write-Host "   ❌ 错误: 构建失败" -ForegroundColor Red
    Read-Host "按回车键退出"
    exit 1
}

# 步骤3: 检查构建输出
Write-Host ""
Write-Host "[3/4] 检查构建文件..." -ForegroundColor Yellow
if (-not (Test-Path $LOCAL_PATH)) {
    Write-Host "   ❌ 错误: $LOCAL_PATH 目录不存在" -ForegroundColor Red
    Read-Host "按回车键退出"
    exit 1
}
Write-Host "   ✅ 找到 $LOCAL_PATH 目录" -ForegroundColor Green

# 步骤4: 部署选项
Write-Host ""
Write-Host "[4/4] 选择部署方式:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. 同时部署到云托管和服务器"
Write-Host "  2. 仅部署到云托管"
Write-Host "  3. 仅部署到服务器（scp）"
Write-Host "  4. 仅部署到服务器（PSCP）"
Write-Host "  5. 手动上传（宝塔文件管理器）"
Write-Host "  6. 取消"
Write-Host ""

$choice = Read-Host "请输入选项 (1-6)"

switch ($choice) {
    "1" { Deploy-Both }
    "2" { Deploy-CloudBase }
    "3" { Deploy-Scp }
    "4" { Deploy-Pscp }
    "5" { Deploy-Manual }
    "6" { Write-Host "已取消"; exit 0 }
    default { Write-Host "无效选项"; exit 1 }
}

function Deploy-CloudBase {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "  部署到云托管" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
    
    try {
        Write-Host "检查 CloudBase CLI 登录状态..." -ForegroundColor Yellow
        $loginCheck = tcb whoami 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "   ⚠️ 未登录 CloudBase，请先登录" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "请运行以下命令登录：" -ForegroundColor Cyan
            Write-Host "  tcb login" -ForegroundColor Gray
            Write-Host ""
            Read-Host "登录完成后按回车键继续"
        }
        
        Write-Host ""
        Write-Host "正在部署到云托管..." -ForegroundColor Yellow
        npm run deploy
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ 云托管部署成功！" -ForegroundColor Green
            return $true
        } else {
            Write-Host ""
            Write-Host "❌ 云托管部署失败" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host ""
        Write-Host "❌ 云托管部署失败" -ForegroundColor Red
        Write-Host "错误: $_" -ForegroundColor Gray
        return $false
    }
}

function Deploy-Both {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "  同时部署到云托管和服务器" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    
    $cloudbaseSuccess = Deploy-CloudBase
    
    if ($cloudbaseSuccess) {
        Write-Host ""
        Write-Host "继续部署到服务器..." -ForegroundColor Yellow
        Deploy-Scp
    } else {
        Write-Host ""
        $continue = Read-Host "云托管部署失败，是否继续部署到服务器？(y/n)"
        if ($continue -eq "y" -or $continue -eq "Y") {
            Deploy-Scp
        }
    }
}

function Deploy-Scp {
    Write-Host ""
    Write-Host "使用 scp 上传..." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "服务器: $SERVER_USER@${SERVER_IP}:${SERVER_PATH}" -ForegroundColor Gray
    Write-Host ""
    
    try {
        $files = Get-ChildItem -Path $LOCAL_PATH -File
        $dirs = Get-ChildItem -Path $LOCAL_PATH -Directory
        
        Write-Host "正在上传文件..." -ForegroundColor Yellow
        
        # 先上传文件
        foreach ($file in $files) {
            Write-Host "  上传: $($file.Name)" -ForegroundColor Gray
            scp "$($file.FullName)" "${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/"
        }
        
        # 再上传目录
        foreach ($dir in $dirs) {
            Write-Host "  上传目录: $($dir.Name)" -ForegroundColor Gray
            scp -r "$($dir.FullName)" "${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/"
        }
        
        Write-Host ""
        Write-Host "✅ 文件上传成功！" -ForegroundColor Green
        Show-Success
    } catch {
        Write-Host ""
        Write-Host "❌ 上传失败" -ForegroundColor Red
        Write-Host ""
        Write-Host "可能的原因:" -ForegroundColor Yellow
        Write-Host "  - 未安装 OpenSSH 客户端" -ForegroundColor Gray
        Write-Host "  - 服务器密码错误" -ForegroundColor Gray
        Write-Host "  - 网络连接问题" -ForegroundColor Gray
        Write-Host ""
        Write-Host "建议: 使用选项 3（手动上传）" -ForegroundColor Cyan
    }
}

function Deploy-Pscp {
    Write-Host ""
    Write-Host "使用 PSCP 上传..." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "请确保已安装 PuTTY 并将 pscp.exe 添加到 PATH" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "按回车键继续（或按 Ctrl+C 取消）"
    
    try {
        pscp -r "$LOCAL_PATH\*" "${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/"
        Write-Host ""
        Write-Host "✅ 文件上传成功！" -ForegroundColor Green
        Show-Success
    } catch {
        Write-Host ""
        Write-Host "❌ 上传失败，请检查 pscp 是否可用" -ForegroundColor Red
    }
}

function Deploy-Manual {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "  手动上传步骤" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. 登录宝塔面板:" -ForegroundColor Yellow
    Write-Host "   http://${SERVER_IP}:8888" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. 进入 文件管理:" -ForegroundColor Yellow
    Write-Host "   $SERVER_PATH" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. 删除目录内所有文件" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "4. 上传以下目录内的所有文件:" -ForegroundColor Yellow
    Write-Host "   $(Get-Location)\$LOCAL_PATH" -ForegroundColor Gray
    Write-Host ""
    Write-Host "5. 完成！" -ForegroundColor Green
    Write-Host ""
}

function Show-Success {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host "  ✅ 部署完成！" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "访问您的网站:" -ForegroundColor Yellow
    Write-Host "  http://missonce.cc" -ForegroundColor Gray
    Write-Host "  https://missonce.cc" -ForegroundColor Gray
    Write-Host ""
}

Write-Host ""
Read-Host "按回车键退出"
