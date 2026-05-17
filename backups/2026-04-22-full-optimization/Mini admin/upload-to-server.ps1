
# 自动上传文件到服务器
$ErrorActionPreference = "Stop"

$SERVER_IP = "95.40.97.36"
$SERVER_USER = "root"
$SERVER_PASSWORD = "emly123456"
$SERVER_PATH = "/www/wwwroot/missonce.cc"
$LOCAL_PATH = "dist"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  上传文件到服务器" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 使用 plink 和 pscp（如果可用）
# 或者使用 sshpass 的替代方案

# 方法1: 使用 plink（PuTTY）
try {
    Write-Host "检查 plink..." -ForegroundColor Yellow
    $plinkTest = Get-Command plink -ErrorAction SilentlyContinue
    if ($plinkTest) {
        Write-Host "   ✅ 找到 plink" -ForegroundColor Green
        
        Write-Host ""
        Write-Host "正在上传文件..." -ForegroundColor Yellow
        
        # 使用 plink 和 pscp
        $files = Get-ChildItem -Path $LOCAL_PATH -File
        $dirs = Get-ChildItem -Path $LOCAL_PATH -Directory
        
        # 先上传文件
        foreach ($file in $files) {
            Write-Host "  上传: $($file.Name)" -ForegroundColor Gray
            echo $SERVER_PASSWORD | pscp -pw $SERVER_PASSWORD "$($file.FullName)" "${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/"
        }
        
        # 再上传目录
        foreach ($dir in $dirs) {
            Write-Host "  上传目录: $($dir.Name)" -ForegroundColor Gray
            echo $SERVER_PASSWORD | pscp -pw $SERVER_PASSWORD -r "$($dir.FullName)" "${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/"
        }
        
        Write-Host ""
        Write-Host "✅ 文件上传成功！" -ForegroundColor Green
        exit 0
    }
} catch {
    Write-Host "   ⚠️ plink 不可用" -ForegroundColor Yellow
}

# 方法2: 使用 PowerShell 和 SSH.NET（如果安装）
try {
    Write-Host ""
    Write-Host "尝试使用 SSH.NET..." -ForegroundColor Yellow
    
    # 检查是否可以加载 SSH.NET
    Add-Type -Path "SSH.NET.dll" -ErrorAction SilentlyContinue
} catch {
    Write-Host "   ⚠️ SSH.NET 不可用" -ForegroundColor Yellow
}

# 方法3: 手动上传说明
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
Write-Host "或者使用 FileZilla 等 FTP 工具上传" -ForegroundColor Cyan
Write-Host ""
