<#
.SYNOPSIS
    Installs Windows Subsystem for Linux for the whole machine (Intune Win32 app, System context).
    Enables the Windows features WSL needs, then installs the WSL package with winget.
    Linux distributions are per user and install afterwards without admin (wsl --install -d Ubuntu).

.NOTES
    Returns 3010 when the features were just enabled, so Intune asks for a restart.
#>

$ErrorActionPreference = "Stop"
$LogDir = Join-Path $env:ProgramData "IdaraOS\Logs"
New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
$LogPath = Join-Path $LogDir "wsl-install.log"

$restartNeeded = $false
foreach ($feature in @("Microsoft-Windows-Subsystem-Linux", "VirtualMachinePlatform")) {
    $state = (Get-WindowsOptionalFeature -Online -FeatureName $feature).State
    Add-Content -Path $LogPath -Value "$(Get-Date -Format s) $feature is $state"
    if ($state -ne "Enabled") {
        $result = Enable-WindowsOptionalFeature -Online -FeatureName $feature -All -NoRestart
        if ($result.RestartNeeded) { $restartNeeded = $true }
        Add-Content -Path $LogPath -Value "$(Get-Date -Format s) enabled $feature (restart needed: $($result.RestartNeeded))"
    }
}

& (Join-Path $PSScriptRoot "Install-WingetApp.ps1") -Id "Microsoft.WSL"
$code = $LASTEXITCODE
Add-Content -Path $LogPath -Value "$(Get-Date -Format s) WSL package install returned $code"

if ($code -ne 0 -and $code -ne 3010 -and $code -ne 1641) { exit $code }
if ($restartNeeded -or $code -eq 3010) { exit 3010 }
exit $code
