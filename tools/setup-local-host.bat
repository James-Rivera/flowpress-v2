@echo off
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
set "UPLOADS_PATH=%~1"
set "PUBLIC_FRONTEND_ORIGIN=%~2"
set "SHOP_NAME=%~3"

if "%UPLOADS_PATH%"=="" set "UPLOADS_PATH=C:\FlowPressData\uploads"

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%setup-local-host.ps1" -UploadsPath "%UPLOADS_PATH%" -PublicFrontendOrigin "%PUBLIC_FRONTEND_ORIGIN%" -ShopName "%SHOP_NAME%"
