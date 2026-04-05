param(
  [switch]$PrintPath
)

$launcherPath = Join-Path $env:LOCALAPPDATA 'JetBrains\Toolbox\scripts\studio.cmd'

if (-not (Test-Path -LiteralPath $launcherPath)) {
  Write-Error "Android Studio launcher not found at $launcherPath."
  exit 1
}

if ($PrintPath) {
  Write-Output $launcherPath
  exit 0
}

& $launcherPath @args
