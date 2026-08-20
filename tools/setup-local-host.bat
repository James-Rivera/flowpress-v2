@echo off
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
set "UPLOADS_PATH=%~1"
set "PUBLIC_FRONTEND_ORIGIN=%~2"
set "SHOP_NAME=%~3"
set "DEPLOYMENT_MODE=%~4"

if "%UPLOADS_PATH%"=="" set "UPLOADS_PATH=C:\FlowPressData\uploads"

if /i "%DEPLOYMENT_MODE%"=="public-only" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%setup-local-host.ps1" -UploadsPath "%UPLOADS_PATH%" -PublicFrontendOrigin "%PUBLIC_FRONTEND_ORIGIN%" -ShopName "%SHOP_NAME%" -SkipLocalSending
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%setup-local-host.ps1" -UploadsPath "%UPLOADS_PATH%" -PublicFrontendOrigin "%PUBLIC_FRONTEND_ORIGIN%" -ShopName "%SHOP_NAME%"
)
