<#
.SYNOPSIS
    Installs the IdaraOS Agent on a Windows device and links it to the member who will use it.
    Run once, from an admin PowerShell, on each new laptop. No Intune or Entra join needed.

.PARAMETER ServerUrl
    IdaraOS URL, e.g. https://idaraos.com

.PARAMETER TaskIntervalMinutes
    How often the scheduled task wakes up. The agent still only checks in as often as IdaraOS asks
    (Check-in every N minutes), so keep this at or below the smallest interval you plan to use.

.PARAMETER SkipPairing
    Install without linking now. Link later with:
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\ProgramData\IdaraOS\Agent\IdaraOS-Agent.ps1" -Pair

.EXAMPLE
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Install-IdaraOSAgent.ps1 -ServerUrl "https://idaraos.com"
#>

param(
    [Parameter(Mandatory = $true)][string]$ServerUrl,
    [int]$TaskIntervalMinutes = 5,
    [switch]$SkipPairing
)

$ErrorActionPreference = "Stop"
$Version = "1.3.0"
$TaskName = "IdaraOS Agent"
$TaskPath = "\IdaraOS\"
$BaseDir = Join-Path $env:ProgramData "IdaraOS\Agent"
$ScriptPath = Join-Path $BaseDir "IdaraOS-Agent.ps1"

if ($ServerUrl -notmatch '^https://') { throw "ServerUrl must start with https://" }

$principalCheck = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principalCheck.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run this from an admin PowerShell (right-click > Run as administrator)"
}

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

# winget running as SYSTEM needs the Visual C++ Redistributable (x64). Without it every winget call
# fails with 0xC0000135. Install it from Microsoft if it's missing.
function Test-VCRuntime {
    foreach ($key in @(
        "HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\x64"
    )) {
        $runtime = Get-ItemProperty -Path $key -ErrorAction SilentlyContinue
        if ($runtime -and $runtime.Installed -eq 1) { return $true }
    }
    return $false
}

if (Test-VCRuntime) {
    Write-Output "Visual C++ runtime (x64) is installed"
} else {
    Write-Output "Installing the Visual C++ runtime (x64) that winget needs..."
    $redist = Join-Path $env:TEMP "vc_redist.x64.exe"
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $ProgressPreference = "SilentlyContinue"
        Invoke-WebRequest -Uri "https://aka.ms/vs/17/release/vc_redist.x64.exe" -OutFile $redist -UseBasicParsing
        $signature = Get-AuthenticodeSignature -FilePath $redist
        if ($signature.Status -ne "Valid" -or $signature.SignerCertificate.Subject -notmatch "O=Microsoft Corporation") {
            throw "the download isn't signed by Microsoft"
        }
        $process = Start-Process -FilePath $redist -ArgumentList "/install", "/quiet", "/norestart" -Wait -PassThru
        # 1638: a newer version is already installed; 3010: installed, restart pending
        if ($process.ExitCode -notin @(0, 1638, 3010)) { throw "the installer exited with $($process.ExitCode)" }
        Write-Output "Visual C++ runtime (x64) installed"
    } catch {
        Write-Warning "Couldn't install the Visual C++ runtime: $($_.Exception.Message). winget won't work until it's installed - get it from https://aka.ms/vs/17/release/vc_redist.x64.exe"
    } finally {
        Remove-Item -Path $redist -Force -ErrorAction SilentlyContinue
    }
}

Copy-Item -Path (Join-Path $PSScriptRoot "IdaraOS-Agent.ps1") -Destination $ScriptPath -Force
@{ serverUrl = $ServerUrl.TrimEnd("/") } | ConvertTo-Json | Set-Content -Path (Join-Path $BaseDir "config.json") -Encoding UTF8

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

New-Item -Path "HKLM:\SOFTWARE\IdaraOS\Agent" -Force | Out-Null
Set-ItemProperty -Path "HKLM:\SOFTWARE\IdaraOS\Agent" -Name "Version" -Value $Version
Write-Output "IdaraOS Agent $Version installed"

if (Get-ScheduledTask -TaskName "IdaraOS Updater" -TaskPath "\IdaraOS\" -ErrorAction SilentlyContinue) {
    Write-Warning "The Intune IdaraOS Updater is also installed. Remove it (Uninstall-IdaraOSUpdater.ps1) so updates don't run twice."
}

$linked = Test-Path (Join-Path $BaseDir "device.json")
if ($linked) {
    Write-Output "This device is already linked. To link it to someone else, delete $BaseDir\device.json and run with -Pair."
} elseif (-not $SkipPairing) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $ScriptPath -Pair
    $linked = $LASTEXITCODE -eq 0
}

if ($linked) {
    Start-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath
}
exit 0
