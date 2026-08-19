@echo off
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
set "UPLOADS_PATH=%~1"
set "PUBLIC_FRONTEND_ORIGIN=%~2"

if "%UPLOADS_PATH%"=="" set "UPLOADS_PATH=C:\FlowPressData\uploads"

if "%PUBLIC_FRONTEND_ORIGIN%"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%setup-local-host.ps1" -UploadsPath "%UPLOADS_PATH%"
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%setup-local-host.ps1" -UploadsPath "%UPLOADS_PATH%" -PublicFrontendOrigin "%PUBLIC_FRONTEND_ORIGIN%"
)
