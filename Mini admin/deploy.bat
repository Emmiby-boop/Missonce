@echo off
chcp 65001 >nul
echo ==========================================
echo   Missonce 后台管理系统 - 一键部署脚本
echo ==========================================
echo.

REM 设置变量
set SERVER_IP=95.40.97.36
set SERVER_USER=root
set SERVER_PATH=/www/wwwroot/missonce.cc
set LOCAL_PATH=dist

echo [1/4] 检查 Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误：未找到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)
echo ✅ Node.js 检查通过
echo.

echo [2/4] 构建项目...
call npm run build
if %errorlevel% neq 0 (
    echo ❌ 错误：构建失败
    pause
    exit /b 1
)
echo ✅ 项目构建成功
echo.

echo [3/4] 准备上传文件...
if not exist "%LOCAL_PATH%" (
    echo ❌ 错误：%LOCAL_PATH% 目录不存在
    pause
    exit /b 1
)
echo ✅ 找到 %LOCAL_PATH% 目录
echo.

echo ==========================================
echo   准备上传到服务器
echo   服务器: %SERVER_IP%
echo   路径: %SERVER_PATH%
echo ==========================================
echo.
echo ⚠️  注意：需要您手动输入服务器密码或使用SSH密钥
echo.
echo 请选择上传方式：
echo   1. 使用 scp 命令上传（需要先安装OpenSSH）
echo   2. 手动上传（使用宝塔文件管理器）
echo   3. 取消
echo.
set /p choice="请输入选项 (1/2/3): "

if "%choice%"=="1" goto scp_upload
if "%choice%"=="2" goto manual_upload
if "%choice%"=="3" goto end
goto invalid_choice

:scp_upload
echo.
echo 使用 scp 上传...
echo.
echo 正在上传文件到 %SERVER_USER%@%SERVER_IP%:%SERVER_PATH%
echo.
scp -r "%LOCAL_PATH%\*" %SERVER_USER%@%SERVER_IP%:%SERVER_PATH%/
if %errorlevel% equ 0 (
    echo.
    echo ✅ 文件上传成功！
    goto success
) else (
    echo.
    echo ❌ 上传失败，请检查：
    echo   - 服务器密码是否正确
    echo   - 是否安装了OpenSSH客户端
    echo   - 网络连接是否正常
    echo.
    echo 或者使用方案2：手动上传
    goto end
)

:manual_upload
echo.
echo ==========================================
echo   手动上传步骤
echo ==========================================
echo.
echo 1. 登录宝塔面板: http://%SERVER_IP%:8888
echo 2. 进入 文件 -^> %SERVER_PATH%
echo 3. 删除目录内所有文件
echo 4. 上传 %LOCAL_PATH% 目录内的所有文件
echo 5. 完成！
echo.
pause
goto end

:invalid_choice
echo.
echo ❌ 无效选项
goto end

:success
echo.
echo ==========================================
echo   ✅ 部署完成！
echo ==========================================
echo.
echo 访问网站:
echo   http://missonce.cc
echo   https://missonce.cc
echo.

:end
echo.
pause
