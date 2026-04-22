@echo off
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
set "UPLOADS_PATH=%~1"

if "%UPLOADS_PATH%"=="" set "UPLOADS_PATH=C:\flowpress-local\uploads"

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%setup-local-host.ps1" -UploadsPath "%UPLOADS_PATH%" -CreateSmbShare
