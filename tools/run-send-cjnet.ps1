param()

$ErrorActionPreference = "Stop"

function Get-CaddyPath {
  $command = Get-Command caddy.exe -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $wingetLink = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Links\caddy.exe"
  if (Test-Path -LiteralPath $wingetLink) {
    return $wingetLink
  }

  throw "caddy.exe was not found. Install Caddy first."
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$configPath = Join-Path $projectRoot "Caddyfile"

if (-not (Test-Path -LiteralPath $configPath)) {
  throw "Caddyfile was not found."
}

Set-Location $projectRoot

$caddyPath = Get-CaddyPath
& $caddyPath run --config $configPath
