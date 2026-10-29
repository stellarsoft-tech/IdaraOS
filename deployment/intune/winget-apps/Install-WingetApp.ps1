<#
.SYNOPSIS
    Installs a winget package for the whole machine. Use as the install command of an Intune Win32 app
    (System context), so approved apps install without the user needing admin rights. Always installs the
    latest version, so the package never needs re-uploading for a new release.

.PARAMETER Id
    Exact winget package ID, e.g. Git.Git

.PARAMETER Override
    Optional installer arguments passed to winget --override (replaces winget's silent switches).

.PARAMETER Custom
    Optional extra installer arguments passed to winget --custom (added to winget's silent switches).

.EXAMPLE
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Install-WingetApp.ps1 -Id Git.Git

.NOTES
    Return codes for Intune: 0 success, 3010 soft reboot, 1641 hard reboot, anything else = failure.
#>

param(
    [Parameter(Mandatory = $true)][ValidatePattern('^[A-Za-z0-9][A-Za-z0-9.+_-]{0,127}$')][string]$Id,
    [string]$Override,
    [string]$Custom
)

$ExitAlreadyInstalled = -1978334963  # 0x8A15010D
$ExitRebootToFinish   = -1978334967  # 0x8A150109
$ExitRebootInitiated  = -1978334965  # 0x8A15010B

$LogDir = Join-Path $env:ProgramData "IdaraOS\Logs"
New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
$LogPath = Join-Path $LogDir "winget-install-$Id.log"

function Find-Winget {
    $dirs = Get-ChildItem -Path "$env:ProgramFiles\WindowsApps" -Filter "Microsoft.DesktopAppInstaller_*_x64__8wekyb3d8bbwe" -Directory -ErrorAction SilentlyContinue |
        Sort-Object { try { [version](($_.Name -split "_")[1]) } catch { [version]"0.0" } } -Descending
    foreach ($dir in $dirs) {
        $exe = Join-Path $dir.FullName "winget.exe"
        if (Test-Path $exe) { return $exe }
    }
    return $null
}

$winget = Find-Winget
if (-not $winget) {
    Add-Content -Path $LogPath -Value "$(Get-Date -Format s) winget not found for SYSTEM"
    exit 1
}

$arguments = @(
    "install", "--id", $Id, "--exact", "--silent", "--scope", "machine", "--source", "winget",
    "--accept-source-agreements", "--accept-package-agreements", "--disable-interactivity"
)
if ($Override) { $arguments += @("--override", $Override) }
if ($Custom) { $arguments += @("--custom", $Custom) }

Add-Content -Path $LogPath -Value "$(Get-Date -Format s) winget $($arguments -join ' ')"
$output = & $winget @arguments 2>&1 | ForEach-Object { "$_" }
$code = $LASTEXITCODE
Add-Content -Path $LogPath -Value ($output -join "`n")
Add-Content -Path $LogPath -Value ("{0} exit 0x{1:X8}" -f (Get-Date -Format s), $code)

switch ($code) {
    0 { exit 0 }
    { $_ -eq $ExitAlreadyInstalled } { exit 0 }
    { $_ -eq $ExitRebootToFinish } { exit 3010 }
    { $_ -eq $ExitRebootInitiated } { exit 1641 }
    default { exit 1 }
}
