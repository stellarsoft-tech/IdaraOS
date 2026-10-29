<#
.SYNOPSIS
    Uninstalls a winget package. Use as the uninstall command of the Intune Win32 app.

.EXAMPLE
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Uninstall-WingetApp.ps1 -Id Git.Git
#>

param(
    [Parameter(Mandatory = $true)][ValidatePattern('^[A-Za-z0-9][A-Za-z0-9.+_-]{0,127}$')][string]$Id
)

$LogDir = Join-Path $env:ProgramData "IdaraOS\Logs"
New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
$LogPath = Join-Path $LogDir "winget-uninstall-$Id.log"

$winget = Get-ChildItem -Path "$env:ProgramFiles\WindowsApps" -Filter "Microsoft.DesktopAppInstaller_*_x64__8wekyb3d8bbwe" -Directory -ErrorAction SilentlyContinue |
    ForEach-Object { Join-Path $_.FullName "winget.exe" } | Where-Object { Test-Path $_ } | Select-Object -Last 1
if (-not $winget) { exit 1 }

$output = & $winget uninstall --id $Id --exact --silent --accept-source-agreements --disable-interactivity 2>&1 | ForEach-Object { "$_" }
$code = $LASTEXITCODE
Add-Content -Path $LogPath -Value ($output -join "`n")
Add-Content -Path $LogPath -Value ("{0} exit 0x{1:X8}" -f (Get-Date -Format s), $code)

# Not installed counts as uninstalled
if ($code -eq 0 -or $code -eq -1978335212) { exit 0 }
exit 1
