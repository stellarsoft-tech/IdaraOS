<#
.SYNOPSIS
    Intune detection script template for a winget-installed app. Output + exit 0 = installed.

    Intune detection scripts can't take parameters: copy this file per app (e.g. Detect-Git.ps1)
    and set $PackageId. A file-path detection rule (see README.md) is simpler where the app has a
    stable install path.
#>

$PackageId = "Git.Git"

$winget = Get-ChildItem -Path "$env:ProgramFiles\WindowsApps" -Filter "Microsoft.DesktopAppInstaller_*_x64__8wekyb3d8bbwe" -Directory -ErrorAction SilentlyContinue |
    ForEach-Object { Join-Path $_.FullName "winget.exe" } | Where-Object { Test-Path $_ } | Select-Object -Last 1
if (-not $winget) { exit 1 }

$null = & $winget list --id $PackageId --exact --accept-source-agreements --disable-interactivity 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Output "$PackageId installed"
    exit 0
}
exit 1
