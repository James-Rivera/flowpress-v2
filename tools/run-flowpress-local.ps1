param(
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"

function Set-EnvironmentFromDotEnv {
  param(
    [string]$FilePath
  )

  if (-not (Test-Path -LiteralPath $FilePath)) {
    return
  }

  foreach ($line in Get-Content -LiteralPath $FilePath) {
    if ([string]::IsNullOrWhiteSpace($line)) {
      continue
    }

    $trimmed = $line.Trim()

    if ($trimmed.StartsWith("#")) {
      continue
    }

    $separator = $trimmed.IndexOf("=")
    if ($separator -lt 1) {
      continue
    }

    $name = $trimmed.Substring(0, $separator).Trim()
    $value = $trimmed.Substring($separator + 1).Trim()

    if (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
  }
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$serverPath = Join-Path $projectRoot ".next\standalone\server.js"

if (-not (Test-Path -LiteralPath $serverPath)) {
  throw "Standalone server build was not found. Run setup-local-host.ps1 first."
}

Set-Location $projectRoot
Set-EnvironmentFromDotEnv -FilePath (Join-Path $projectRoot ".env.local")

$env:PORT = [string]$Port
if (-not $env:HOSTNAME) {
  $env:HOSTNAME = "0.0.0.0"
}

$nodePath = (Get-Command node.exe -ErrorAction Stop).Source
& $nodePath $serverPath
