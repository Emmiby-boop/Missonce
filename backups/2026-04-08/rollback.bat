@echo off
chcp 65001 >nul
echo ============================================
echo    Missonce Rollback Script
echo ============================================
echo.

set BACKUP_DIR=%~dp0backups\2026-04-08
set MINI_PROGRAM=D:\Missonce\Missonce\WeChat Mini

echo [1/5] Checking backup directory...
if not exist "%BACKUP_DIR%" (
    echo [ERROR] Backup directory not found!
    echo    Expected: %BACKUP_DIR%
    pause
    exit /b 1
)
echo [OK] Backup directory exists

echo.
echo [2/5] Restoring app.js ...
if exist "%BACKUP_DIR%\app\app.js.bak" (
    copy /Y "%BACKUP_DIR%\app\app.js.bak" "%MINI_PROGRAM%\app.js" >nul
    echo [OK] app.js restored
) else (
    echo [SKIP] app.js backup not found
)

echo.
echo [3/5] Restoring pages/index/index.js ...
if exist "%BACKUP_DIR%\pages\index\index.js.bak" (
    copy /Y "%BACKUP_DIR%\pages\index\index.js.bak" "%MINI_PROGRAM%\pages\index\index.js" >nul
    echo [OK] pages/index/index.js restored
) else (
    echo [SKIP] pages/index/index.js backup not found
)

echo.
echo [4/5] Restoring getResources cloud function ...
if exist "%BACKUP_DIR%\cloudfunctions\getResources\index.js.bak" (
    copy /Y "%BACKUP_DIR%\cloudfunctions\getResources\index.js.bak" "%MINI_PROGRAM%\cloudfunctions\getResources\index.js" >nul
    echo [OK] getResources cloud function restored
) else (
    echo [SKIP] getResources cloud function backup not found
)

echo.
echo [5/5] Restoring getHomeData cloud function ...
if exist "%BACKUP_DIR%\cloudfunctions\getHomeData\index.js.bak" (
    copy /Y "%BACKUP_DIR%\cloudfunctions\getHomeData\index.js.bak" "%MINI_PROGRAM%\cloudfunctions\getHomeData\index.js" >nul
    echo [OK] getHomeData cloud function restored
) else (
    echo [SKIP] getHomeData cloud function backup not found
)

echo.
echo ============================================
echo    Rollback completed!
echo ============================================
echo.
echo Note: Please re-upload cloud functions to 
echo       WeChat Cloud Development Console.
echo.
pause
