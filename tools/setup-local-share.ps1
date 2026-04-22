param(
  [string]$UploadsPath = "C:\flowpress-local\uploads",
  [string]$ShareName = "FlowPressUploads"
)

$ErrorActionPreference = "Stop"

if (-not ([bool](net session 2>$null))) {
  throw "Run this script from an elevated PowerShell window."
}

New-Item -ItemType Directory -Force -Path $UploadsPath | Out-Null

if (-not (Get-SmbShare -Name $ShareName -ErrorAction SilentlyContinue)) {
  New-SmbShare -Name $ShareName -Path $UploadsPath -FullAccess "Everyone" | Out-Null
}

Write-Host "SMB share ready:"
Write-Host ("\\{0}\{1}" -f $env:COMPUTERNAME, $ShareName)
Write-Host ("Uploads path: {0}" -f $UploadsPath)
