<#
.SYNOPSIS
    Intune detection script for the IdaraOS Updater. Output + exit 0 = installed.
    Bump $RequiredVersion together with $Version in Install-IdaraOSUpdater.ps1 when you ship a new version.
#>

$RequiredVersion = [version]"1.0.0"

$task = Get-ScheduledTask -TaskName "IdaraOS Updater" -TaskPath "\IdaraOS\" -ErrorAction SilentlyContinue
$script = Test-Path (Join-Path $env:ProgramData "IdaraOS\Updater\IdaraOS-Updater.ps1")
$installed = $null
try { $installed = [version](Get-ItemProperty -Path "HKLM:\SOFTWARE\IdaraOS\Updater" -Name Version -ErrorAction Stop).Version } catch { }

if ($task -and $script -and $installed -and $installed -ge $RequiredVersion) {
    Write-Output "IdaraOS Updater $installed"
    exit 0
}
exit 1
