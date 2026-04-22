param(
  [string]$UploadsPath = "C:\flowpress-local\uploads",
  [int]$Port = 3000,
  [string]$ShareName = "FlowPressUploads",
  [string]$TaskName = "FlowPressLocal",
  [switch]$CreateSmbShare
)

$ErrorActionPreference = "Stop"

function Ensure-NodeInstalled {
  $node = Get-Command node.exe -ErrorAction SilentlyContinue
  $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue

  if ($node -and $npm) {
    return @{
      Node = $node.Source
      Npm = $npm.Source
    }
  }

  $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
  if (-not $winget) {
    throw "Node.js was not found and winget is unavailable. Install Node.js LTS manually first."
  }

  Write-Host "Installing Node.js LTS..."
  & $winget.Source install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements

  $node = Get-Command node.exe -ErrorAction SilentlyContinue
  $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue

  if (-not $node -or -not $npm) {
    $defaultNode = "C:\Program Files\nodejs\node.exe"
    $defaultNpm = "C:\Program Files\nodejs\npm.cmd"

    if ((Test-Path -LiteralPath $defaultNode) -and (Test-Path -LiteralPath $defaultNpm)) {
      return @{
        Node = $defaultNode
        Npm = $defaultNpm
      }
    }

    throw "Node.js installation finished, but node.exe/npm.cmd could not be located."
  }

  return @{
    Node = $node.Source
    Npm = $npm.Source
  }
}

function Set-EnvValue {
  param(
    [string]$FilePath,
    [string]$Name,
    [string]$Value
  )

  $existing = @()
  if (Test-Path -LiteralPath $FilePath) {
    $existing = Get-Content -LiteralPath $FilePath
  }

  $escapedName = [Regex]::Escape($Name)
  $updated = $false
  $nextLines = foreach ($line in $existing) {
    if ($line -match "^$escapedName=") {
      $updated = $true
      "$Name=$Value"
    } else {
      $line
    }
  }

  if (-not $updated) {
    $nextLines += "$Name=$Value"
  }

  Set-Content -LiteralPath $FilePath -Value $nextLines -Encoding UTF8
}

function Test-IsAdministrator {
  $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Install-StartupShortcutFallback {
  param(
    [string]$TaskName,
    [string]$ProjectRoot,
    [string]$RunScript,
    [int]$Port
  )

  $startupFolder = [Environment]::GetFolderPath("Startup")
  $launcherPath = Join-Path $startupFolder "$TaskName.cmd"
  $command = @(
    '@echo off',
    'setlocal',
    ('cd /d "{0}"' -f $ProjectRoot),
    ('start "" powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}" -Port {1}' -f $RunScript, $Port)
  )

  Set-Content -LiteralPath $launcherPath -Value $command -Encoding ASCII
  return $launcherPath
}

function Sync-StandaloneAssets {
  param(
    [string]$ProjectRoot
  )

  $standaloneRoot = Join-Path $ProjectRoot ".next\standalone"
  $standaloneNextRoot = Join-Path $standaloneRoot ".next"
  $staticSource = Join-Path $ProjectRoot ".next\static"
  $staticTarget = Join-Path $standaloneNextRoot "static"
  $publicSource = Join-Path $ProjectRoot "public"
  $publicTarget = Join-Path $standaloneRoot "public"

  if (-not (Test-Path -LiteralPath $standaloneRoot)) {
    throw "Standalone build output was not found."
  }

  New-Item -ItemType Directory -Force -Path $standaloneNextRoot | Out-Null

  if (Test-Path -LiteralPath $staticTarget) {
    Remove-Item -LiteralPath $staticTarget -Recurse -Force
  }

  if (Test-Path -LiteralPath $staticSource) {
    Copy-Item -LiteralPath $staticSource -Destination $staticTarget -Recurse -Force
  }

  if (Test-Path -LiteralPath $publicTarget) {
    Remove-Item -LiteralPath $publicTarget -Recurse -Force
  }

  if (Test-Path -LiteralPath $publicSource) {
    Copy-Item -LiteralPath $publicSource -Destination $publicTarget -Recurse -Force
  }
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$envFile = Join-Path $projectRoot ".env.local"
$exampleEnvFile = Join-Path $projectRoot ".env.example"
$runScript = Join-Path $projectRoot "tools\run-flowpress-local.ps1"
$startupRoot = Join-Path $env:LOCALAPPDATA "FlowPressLocal"
$startupLog = Join-Path $startupRoot "flowpress-local.log"

New-Item -ItemType Directory -Force -Path $UploadsPath | Out-Null
New-Item -ItemType Directory -Force -Path $startupRoot | Out-Null

if (-not (Test-Path -LiteralPath $envFile)) {
  Copy-Item -LiteralPath $exampleEnvFile -Destination $envFile
}

Set-EnvValue -FilePath $envFile -Name "UPLOADS_DIR" -Value $UploadsPath

$nodeTools = Ensure-NodeInstalled
$nodeDir = Split-Path -Parent $nodeTools.Node
$env:Path = "$nodeDir;$env:Path"

Write-Host "Installing dependencies..."
& $nodeTools.Npm install

Write-Host "Building FlowPress Local..."
& $nodeTools.Npm run build

Write-Host "Syncing standalone assets..."
Sync-StandaloneAssets -ProjectRoot $projectRoot

if (Test-IsAdministrator) {
  Write-Host "Creating or updating firewall rule for port $Port..."
  $ruleName = "FlowPress Local $Port"
  netsh advfirewall firewall delete rule name="$ruleName" | Out-Null
  netsh advfirewall firewall add rule name="$ruleName" dir=in action=allow protocol=TCP localport=$Port | Out-Null

  if ($CreateSmbShare) {
    $shareScript = Join-Path $projectRoot "tools\setup-local-share.ps1"
    & $shareScript -UploadsPath $UploadsPath -ShareName $ShareName
  }
} else {
  Write-Host "Skipping firewall/share setup because the script is not running as Administrator."
  Write-Host "Run it as Administrator later if phones cannot reach the host PC or if you want the SMB share created automatically."
}

$taskArgument = @(
  "-NoProfile",
  "-WindowStyle", "Hidden",
  "-ExecutionPolicy", "Bypass",
  "-File", "`"$runScript`"",
  "-Port", $Port
) -join " "

Write-Host "Creating or updating scheduled task $TaskName..."
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $taskArgument -WorkingDirectory $projectRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
$runLevel = if (Test-IsAdministrator) { "Highest" } else { "Limited" }
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel $runLevel
$startupFallbackPath = $null

try {
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
  Write-Host "Starting $TaskName now..."
  schtasks /Run /TN $TaskName | Out-Null
} catch {
  Write-Warning "Scheduled task registration failed. Falling back to Startup folder launch."
  $startupFallbackPath = Install-StartupShortcutFallback -TaskName $TaskName -ProjectRoot $projectRoot -RunScript $runScript -Port $Port
  Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", $runScript,
    "-Port", $Port
  )
}

Write-Host ""
Write-Host "FlowPress Local host setup is ready."
Write-Host "Uploads path: $UploadsPath"
Write-Host "Port: $Port"
Write-Host "Task name: $TaskName"
Write-Host "Open on this PC: http://127.0.0.1:$Port/"
Write-Host "Open on phones: http://<branch-pc-ip>:$Port/"
if ($startupFallbackPath) {
  Write-Host "Startup fallback: $startupFallbackPath"
}
Write-Host ""
Write-Host "Recommended next step: reserve a fixed LAN IP for this PC in the MikroTik DHCP server."
