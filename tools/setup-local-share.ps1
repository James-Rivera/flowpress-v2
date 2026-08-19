param(
  [string]$UploadsPath = "C:\FlowPressData\uploads",
  [string]$ShareName = "FlowPressUploads",
  [string]$StaffAccount = "$env:COMPUTERNAME\$env:USERNAME"
)

$ErrorActionPreference = "Stop"

if (-not ([bool](net session 2>$null))) {
  throw "Run this script from an elevated PowerShell window."
}

New-Item -ItemType Directory -Force -Path $UploadsPath | Out-Null

if (-not (Get-SmbShare -Name $ShareName -ErrorAction SilentlyContinue)) {
  New-SmbShare -Name $ShareName -Path $UploadsPath -FullAccess $StaffAccount | Out-Null
} else {
  Revoke-SmbShareAccess -Name $ShareName -AccountName "Everyone" -Force -ErrorAction SilentlyContinue | Out-Null
  Grant-SmbShareAccess -Name $ShareName -AccountName $StaffAccount -AccessRight Full -Force | Out-Null
}

Write-Host "SMB share ready:"
Write-Host ("\\{0}\{1}" -f $env:COMPUTERNAME, $ShareName)
Write-Host ("Uploads path: {0}" -f $UploadsPath)
Write-Host ("Staff account: {0}" -f $StaffAccount)
