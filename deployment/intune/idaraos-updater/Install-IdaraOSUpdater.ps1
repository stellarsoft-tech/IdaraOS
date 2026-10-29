<#
.SYNOPSIS
    Installs the IdaraOS Updater (Intune Win32 app, System context).

.PARAMETER ServerUrl
    IdaraOS URL, e.g. https://app.idaraos.com

.PARAMETER EnrollmentToken
    From IdaraOS > Security > Software Updates > Schedule & enrollment. Stored encrypted (DPAPI, machine scope)
    in a folder only SYSTEM and Administrators can read.

.PARAMETER TaskIntervalMinutes
    How often the scheduled task wakes up. The updater still only checks in as often as IdaraOS asks
    (Check-in every N minutes), so keep this at or below the smallest interval you plan to use.

.EXAMPLE
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Install-IdaraOSUpdater.ps1 -ServerUrl "https://app.idaraos.com" -EnrollmentToken "iue_..."
#>

param(
    [Parameter(Mandatory = $true)][string]$ServerUrl,
    [Parameter(Mandatory = $true)][string]$EnrollmentToken,
    [int]$TaskIntervalMinutes = 5
)

$ErrorActionPreference = "Stop"
$Version = "1.0.0"
$TaskName = "IdaraOS Updater"
$TaskPath = "\IdaraOS\"
$BaseDir = Join-Path $env:ProgramData "IdaraOS\Updater"
$ScriptPath = Join-Path $BaseDir "IdaraOS-Updater.ps1"

if ($ServerUrl -notmatch '^https://') { throw "ServerUrl must start with https://" }

Add-Type -AssemblyName System.Security

# Folder readable only by SYSTEM and Administrators (it holds the device secret)
New-Item -ItemType Directory -Path $BaseDir -Force | Out-Null
$acl = New-Object System.Security.AccessControl.DirectorySecurity
$acl.SetAccessRuleProtection($true, $false)
foreach ($sid in @("S-1-5-18", "S-1-5-32-544")) {
    $identity = (New-Object System.Security.Principal.SecurityIdentifier($sid)).Translate([System.Security.Principal.NTAccount])
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($identity, "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow")
    $acl.AddAccessRule($rule)
}
Set-Acl -Path $BaseDir -AclObject $acl

Copy-Item -Path (Join-Path $PSScriptRoot "IdaraOS-Updater.ps1") -Destination $ScriptPath -Force

$tokenBytes = [System.Text.Encoding]::UTF8.GetBytes($EnrollmentToken)
$protectedToken = [Convert]::ToBase64String(
    [System.Security.Cryptography.ProtectedData]::Protect($tokenBytes, $null, [System.Security.Cryptography.DataProtectionScope]::LocalMachine)
)
@{ serverUrl = $ServerUrl.TrimEnd("/"); enrollmentToken = $protectedToken } |
    ConvertTo-Json | Set-Content -Path (Join-Path $BaseDir "config.json") -Encoding UTF8

# Scheduled task: SYSTEM, at startup and every few minutes, never two at once, at most 4 hours per run
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`""
$triggers = @(
    (New-ScheduledTaskTrigger -AtStartup),
    (New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $TaskIntervalMinutes))
)
$principal = New-ScheduledTaskPrincipal -UserId "S-1-5-18" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 4) `
    -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -Action $action -Trigger $triggers `
    -Principal $principal -Settings $settings -Force | Out-Null

New-Item -Path "HKLM:\SOFTWARE\IdaraOS\Updater" -Force | Out-Null
Set-ItemProperty -Path "HKLM:\SOFTWARE\IdaraOS\Updater" -Name "Version" -Value $Version

# Enroll and check in straight away
Start-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath
Write-Output "IdaraOS Updater $Version installed"
exit 0
