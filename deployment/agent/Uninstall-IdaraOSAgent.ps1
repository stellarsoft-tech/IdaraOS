<#
.SYNOPSIS
    Removes the IdaraOS Agent. The device and its logs stay in IdaraOS; revoke the device there too.
    Run from an admin PowerShell.
#>

$ErrorActionPreference = "Continue"

Unregister-ScheduledTask -TaskName "IdaraOS Agent" -TaskPath "\IdaraOS\" -Confirm:$false -ErrorAction SilentlyContinue
Remove-Item -Path (Join-Path $env:ProgramData "IdaraOS\Agent") -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "HKLM:\SOFTWARE\IdaraOS\Agent" -Recurse -Force -ErrorAction SilentlyContinue

Write-Output "IdaraOS Agent removed"
exit 0
