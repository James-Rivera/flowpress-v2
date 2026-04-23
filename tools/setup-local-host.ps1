param(
  [string]$UploadsPath = "C:\flowpress-local\uploads",
  [int]$Port = 3000,
  [string]$ShareName = "FlowPressUploads",
  [string]$TaskName = "FlowPressLocal",
  [string]$CaddyTaskName = "FlowPressLocalProxy",
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

function Ensure-CaddyInstalled {
  $caddy = Get-Command caddy.exe -ErrorAction SilentlyContinue
  if ($caddy) {
    return $caddy.Source
  }

  $wingetLink = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Links\caddy.exe"
  if (Test-Path -LiteralPath $wingetLink) {
    return $wingetLink
  }

  $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
  if (-not $winget) {
    throw "Caddy was not found and winget is unavailable. Install Caddy manually first."
  }

  Write-Host "Installing Caddy..."
  & $winget.Source install --id CaddyServer.Caddy -e --accept-package-agreements --accept-source-agreements

  $caddy = Get-Command caddy.exe -ErrorAction SilentlyContinue
  if ($caddy) {
    return $caddy.Source
  }

  if (Test-Path -LiteralPath $wingetLink) {
    return $wingetLink
  }

  throw "Caddy installation finished, but caddy.exe could not be located."
}

function Install-StartupPowerShellFallback {
  param(
    [string]$TaskName,
    [string]$ProjectRoot,
    [string]$RunScript,
    [string[]]$ScriptArguments = @()
  )

  $startupFolder = [Environment]::GetFolderPath("Startup")
  $launcherPath = Join-Path $startupFolder "$TaskName.cmd"
  $joinedArgs = if ($ScriptArguments.Count -gt 0) {
    " " + ($ScriptArguments -join " ")
  } else {
    ""
  }
  $command = @(
    '@echo off',
    'setlocal',
    ('cd /d "{0}"' -f $ProjectRoot),
    ('start "" powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}"{1}' -f $RunScript, $joinedArgs)
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
$caddyRunScript = Join-Path $projectRoot "tools\run-send-cjnet.ps1"
$startupRoot = Join-Path $env:LOCALAPPDATA "FlowPressLocal"

New-Item -ItemType Directory -Force -Path $UploadsPath | Out-Null
New-Item -ItemType Directory -Force -Path $startupRoot | Out-Null

if (-not (Test-Path -LiteralPath $envFile)) {
  Copy-Item -LiteralPath $exampleEnvFile -Destination $envFile
}

Set-EnvValue -FilePath $envFile -Name "UPLOADS_DIR" -Value $UploadsPath

$nodeTools = Ensure-NodeInstalled
$caddyPath = Ensure-CaddyInstalled
$nodeDir = Split-Path -Parent $nodeTools.Node
$caddyDir = Split-Path -Parent $caddyPath
$env:Path = "$nodeDir;$caddyDir;$env:Path"

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

  Write-Host "Creating or updating firewall rule for port 80..."
  $httpRuleName = "FlowPress Local HTTP"
  netsh advfirewall firewall delete rule name="$httpRuleName" | Out-Null
  netsh advfirewall firewall add rule name="$httpRuleName" dir=in action=allow protocol=TCP localport=80 | Out-Null

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

$caddyTaskArgument = @(
  "-NoProfile",
  "-WindowStyle", "Hidden",
  "-ExecutionPolicy", "Bypass",
  "-File", "`"$caddyRunScript`""
) -join " "

Write-Host "Creating or updating scheduled task $TaskName..."
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $taskArgument -WorkingDirectory $projectRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
$runLevel = if (Test-IsAdministrator) { "Highest" } else { "Limited" }
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel $runLevel
$startupFallbackPath = $null
$caddyStartupFallbackPath = $null

try {
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
  Write-Host "Starting $TaskName now..."
  schtasks /Run /TN $TaskName | Out-Null
} catch {
  Write-Warning "Scheduled task registration failed. Falling back to Startup folder launch."
  $startupFallbackPath = Install-StartupPowerShellFallback -TaskName $TaskName -ProjectRoot $projectRoot -RunScript $runScript -ScriptArguments @("-Port", $Port)
  Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", $runScript,
    "-Port", $Port
  )
}

Write-Host "Creating or updating scheduled task $CaddyTaskName..."
$caddyAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $caddyTaskArgument -WorkingDirectory $projectRoot

try {
  Register-ScheduledTask -TaskName $CaddyTaskName -Action $caddyAction -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
  Write-Host "Starting $CaddyTaskName now..."
  schtasks /Run /TN $CaddyTaskName | Out-Null
} catch {
  Write-Warning "Scheduled task registration for Caddy failed. Falling back to Startup folder launch."
  $caddyStartupFallbackPath = Install-StartupPowerShellFallback -TaskName $CaddyTaskName -ProjectRoot $projectRoot -RunScript $caddyRunScript
  Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", $caddyRunScript
  )
}

Write-Host ""
Write-Host "FlowPress Local host setup is ready."
Write-Host "Uploads path: $UploadsPath"
Write-Host "Port: $Port"
Write-Host "Task name: $TaskName"
Write-Host "Proxy task name: $CaddyTaskName"
Write-Host "Open on this PC: http://127.0.0.1:$Port/"
Write-Host "Open on phones: http://<branch-pc-ip>:$Port/"
if ($startupFallbackPath) {
  Write-Host "Startup fallback: $startupFallbackPath"
}
if ($caddyStartupFallbackPath) {
  Write-Host "Proxy startup fallback: $caddyStartupFallbackPath"
}
Write-Host ""
Write-Host "Recommended next step: reserve a fixed LAN IP for this PC in the MikroTik DHCP server."
