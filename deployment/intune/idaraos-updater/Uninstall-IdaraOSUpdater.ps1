<#
.SYNOPSIS
    Removes the IdaraOS Updater. The device's logs in IdaraOS are kept; revoke the device there too.
#>

$ErrorActionPreference = "Continue"

Unregister-ScheduledTask -TaskName "IdaraOS Updater" -TaskPath "\IdaraOS\" -Confirm:$false -ErrorAction SilentlyContinue
Remove-Item -Path (Join-Path $env:ProgramData "IdaraOS\Updater") -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "HKLM:\SOFTWARE\IdaraOS\Updater" -Recurse -Force -ErrorAction SilentlyContinue

Write-Output "IdaraOS Updater removed"
exit 0
