<#
.SYNOPSIS
    IdaraOS Agent - installs approved apps and keeps them up to date with winget, running as SYSTEM.
    For organizations using the "IdaraOS Agent" device provider (no Intune needed).

.DESCRIPTION
    Linking (once, from Install-IdaraOSAgent.ps1 or with -Pair, in an admin console):
      Shows a code. The member opens IdaraOS > My Admin Access > Link a device, signs in with their own
      account and enters it. The device is then linked to them and the agent receives its device secret.

    Every few minutes (the "\IdaraOS\IdaraOS Agent" scheduled task, SYSTEM):
      1. Sends any reports that failed to upload earlier.
      2. Checks in (with the signed-in Windows user). IdaraOS answers with:
         - an update run (schedule due, or "Run now"): `winget upgrade` for each package, every result reported
         - install jobs for approved apps: `winget install --scope machine`, the result reported
         - action jobs: one of a fixed set of reviewed device actions (restart a service, collect
           diagnostics, ...), each identified only by a key the agent knows
         - policies: the effective desired state for this device (e.g. block USB storage), applied
           idempotently and enforced from a fixed allowlist of policy types
         - agentUpdate: when the server ships a newer agent, the version + SHA-256 of its official
           script, which this agent downloads (verifying the hash) and uses to replace itself

    The server never sends a command - only validated winget package IDs, action keys and policy
    types from a fixed allowlist, and (for self-update) the server's own script, hash-verified. The
    agent runs winget and the specific actions and policies built into this script, and nothing else.

    Windows PowerShell 5.1 compatible.

.PARAMETER Pair
    Link this device to a member's IdaraOS account. Run from an admin console.

.EXAMPLE
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\ProgramData\IdaraOS\Agent\IdaraOS-Agent.ps1" -Pair
#>

param([switch]$Pair)

$ErrorActionPreference = "Stop"
$AgentVersion = "1.9.1"

$BaseDir = Join-Path $env:ProgramData "IdaraOS\Agent"
$ConfigPath = Join-Path $BaseDir "config.json"
$DevicePath = Join-Path $BaseDir "device.json"
$StatePath = Join-Path $BaseDir "state.json"
$PendingDir = Join-Path $BaseDir "pending"
$LogDir = Join-Path $BaseDir "Logs"
$LogPath = Join-Path $LogDir "agent.log"

# Same rule as the server (lib/security/software.ts WINGET_ID_PATTERN)
$WingetIdPattern = '^[A-Za-z0-9][A-Za-z0-9.+_-]{0,127}$'
# Same rule as the server (lib/security/software.ts VS_WORKLOAD_PATTERN)
$VsWorkloadPattern = '^Microsoft\.VisualStudio\.(Workload|Component|ComponentGroup)\.[A-Za-z0-9._-]{1,100}$'
$VsPackagePattern = '^Microsoft\.VisualStudio\.20\d\d\.'
$MaxLogChars = 60000

# Services the "restart-service" action may restart. The server sends only the key (e.g. "spooler");
# the agent maps it to the Windows service name here, so no arbitrary service name is ever run.
# Keep in step with RESTARTABLE_SERVICES in lib/security/device-actions.ts.
$RestartableServices = @{
    spooler  = "Spooler"
    wuauserv = "wuauserv"
    bits     = "BITS"
    dnscache = "Dnscache"
    usosvc   = "UsoSvc"
}

# winget exit codes (APPINSTALLER_CLI_ERROR_*), as signed 32-bit values
$ExitNoPackageFound      = -1978335212  # 0x8A150014
$ExitUpdateNotApplicable = -1978335189  # 0x8A15002B
$ExitPackageInUse        = -1978334975  # 0x8A150101
$ExitFileInUse           = -1978334973  # 0x8A150103
$ExitRebootToFinish      = -1978334967  # 0x8A150109
$ExitRebootForInstall    = -1978334966  # 0x8A15010A
$ExitRebootInitiated     = -1978334965  # 0x8A15010B

# winget.exe itself couldn't start: STATUS_DLL_NOT_FOUND. As SYSTEM it can't use the Store copy of the
# Visual C++ runtime, so the Visual C++ Redistributable (x64) has to be installed. The installer does that.
$ExitDllNotFound         = -1073741515  # 0xC0000135

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Security

# ============================================================================
# HELPERS
# ============================================================================

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
    # Keep the local log under ~5 MB
    if ((Test-Path $LogPath) -and ((Get-Item $LogPath).Length -gt 5MB)) {
        Move-Item -Path $LogPath -Destination "$LogPath.1" -Force
    }
    $line = "{0} [{1}] {2}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Level, $Message
    Add-Content -Path $LogPath -Value $line -Encoding UTF8
}

function Protect-Text([string]$Text) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
    $protected = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::LocalMachine)
    return [Convert]::ToBase64String($protected)
}

function Unprotect-Text([string]$Text) {
    $bytes = [Convert]::FromBase64String($Text)
    $plain = [System.Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::LocalMachine)
    return [System.Text.Encoding]::UTF8.GetString($plain)
}

function Read-Json([string]$Path) {
    if (-not (Test-Path $Path)) { return $null }
    return Get-Content -Path $Path -Raw -Encoding UTF8 | ConvertFrom-Json
}

function Write-Json([string]$Path, $Value) {
    $Value | ConvertTo-Json -Depth 10 | Set-Content -Path $Path -Encoding UTF8
}

function Get-State {
    $state = Read-Json $StatePath
    if (-not $state) { $state = [pscustomobject]@{ lastCheckIn = $null; checkInMinutes = 15; lastError = $null } }
    # Policy bookkeeping, added in 1.4.0: policy types we've applied (to revert when removed) and the
    # last results to report at the next check-in. Add them to state loaded from an older file.
    foreach ($prop in @("managedPolicies", "policyResults", "bitlocker")) {
        if (-not ($state.PSObject.Properties.Name -contains $prop)) {
            $state | Add-Member -NotePropertyName $prop -NotePropertyValue @() -Force
        }
    }
    # Managed admin password report pending upload (1.6.0): a single object or null.
    if (-not ($state.PSObject.Properties.Name -contains "adminCredential")) {
        $state | Add-Member -NotePropertyName "adminCredential" -NotePropertyValue $null -Force
    }
    # Web filtering state (1.7.0): what we last applied (for visibility), or null when not filtering.
    if (-not ($state.PSObject.Properties.Name -contains "webFiltering")) {
        $state | Add-Member -NotePropertyName "webFiltering" -NotePropertyValue $null -Force
    }
    # Web block-event bookmark (1.8.0): the DNS-log read cursor, or null.
    if (-not ($state.PSObject.Properties.Name -contains "webBlock")) {
        $state | Add-Member -NotePropertyName "webBlock" -NotePropertyValue $null -Force
    }
    # Internet quarantine flag (1.9.0): whether we currently block outbound except IdaraOS.
    if (-not ($state.PSObject.Properties.Name -contains "quarantine")) {
        $state | Add-Member -NotePropertyName "quarantine" -NotePropertyValue $false -Force
    }
    return $state
}

function Get-ServerUrl {
    $config = Read-Json $ConfigPath
    if (-not $config -or -not $config.serverUrl) { throw "No server URL - reinstall the IdaraOS Agent" }
    return $config.serverUrl.TrimEnd("/")
}

function Invoke-IdaraOS {
    param([string]$Method = "POST", [string]$Path, $Body, [string]$Authorization)
    $uri = "{0}{1}" -f (Get-ServerUrl), $Path
    $headers = @{ "User-Agent" = "IdaraOS-Agent/$AgentVersion" }
    if ($Authorization) { $headers["Authorization"] = $Authorization }
    $json = $Body | ConvertTo-Json -Depth 10 -Compress
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -ContentType "application/json; charset=utf-8" `
        -Body ([System.Text.Encoding]::UTF8.GetBytes($json)) -UseBasicParsing -TimeoutSec 60
}

function Get-HttpStatus($ErrorRecord) {
    try { return [int]$ErrorRecord.Exception.Response.StatusCode } catch { return 0 }
}

function Limit-Text([string]$Text) {
    if ($Text.Length -gt $MaxLogChars) { return $Text.Substring($Text.Length - $MaxLogChars) }
    return $Text
}

# ============================================================================
# DEVICE INFO
# ============================================================================

function Get-MachineId {
    $value = (Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Cryptography" -Name MachineGuid).MachineGuid
    if ($value -notmatch '^[0-9a-fA-F-]{36}$') { throw "Couldn't read this device's MachineGuid" }
    return $value.ToLower()
}

function Get-LoggedOnUser {
    try {
        $user = (Get-CimInstance Win32_ComputerSystem).UserName
        if ($user) { return [string]$user }
    } catch { }
    return $null
}

function Find-Winget {
    $candidates = Get-ChildItem -Path "$env:ProgramFiles\WindowsApps" -Filter "Microsoft.DesktopAppInstaller_*_x64__8wekyb3d8bbwe" -Directory -ErrorAction SilentlyContinue |
        Sort-Object { try { [version](($_.Name -split "_")[1]) } catch { [version]"0.0" } } -Descending
    foreach ($dir in $candidates) {
        $exe = Join-Path $dir.FullName "winget.exe"
        if (Test-Path $exe) { return $exe }
    }
    throw "winget (App Installer) isn't installed for the system on this device"
}

function Get-DeviceInfo([string]$Winget) {
    $os = Get-CimInstance Win32_OperatingSystem
    $wingetVersion = $null
    if ($Winget) { try { $wingetVersion = ((& $Winget --version) | Select-Object -First 1).Trim().TrimStart("v") } catch { } }
    return @{
        hostname       = $env:COMPUTERNAME
        osVersion      = "{0} {1}" -f $os.Caption, $os.Version
        updaterVersion = $AgentVersion
        wingetVersion  = $wingetVersion
        loggedOnUser   = Get-LoggedOnUser
    }
}

# ============================================================================
# LINKING (PAIRING)
# ============================================================================

function Start-Pairing {
    $serverUrl = Get-ServerUrl
    $body = @{
        hostname     = $env:COMPUTERNAME
        machineId    = Get-MachineId
        serialNumber = [string](Get-CimInstance Win32_BIOS).SerialNumber
    }
    $pairing = Invoke-IdaraOS -Path "/api/updater/v1/pair" -Body $body
    $linkUrl = "{0}{1}" -f $serverUrl, $pairing.verificationPath
    Write-Log "Pairing started - waiting for the code to be entered"

    Write-Host ""
    Write-Host "  Link this device to your IdaraOS account" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  1. On any device, open:  $linkUrl"
    Write-Host "  2. Sign in with YOUR IdaraOS account (the person who will use this laptop)"
    Write-Host "  3. Enter this code:" -NoNewline
    Write-Host ("  {0}" -f $pairing.userCode) -ForegroundColor Yellow
    Write-Host ""
    Write-Host ("  The code expires in {0} minutes. Waiting..." -f [math]::Round($pairing.expiresIn / 60))

    $deadline = (Get-Date).AddSeconds([int]$pairing.expiresIn)
    $interval = [math]::Max(3, [int]$pairing.interval)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds $interval
        try {
            $result = Invoke-IdaraOS -Path "/api/updater/v1/pair/poll" -Body @{ deviceCode = $pairing.deviceCode }
        } catch {
            if ((Get-HttpStatus $_) -eq 410) { break }
            Write-Log "Pairing poll failed: $($_.Exception.Message)" "WARN"
            continue
        }
        if ($result.status -eq "completed") {
            Write-Json $DevicePath ([pscustomobject]@{ deviceId = $result.deviceId; secret = (Protect-Text $result.deviceSecret) })
            $state = Get-State
            $state.checkInMinutes = [int]$result.checkInMinutes
            $state.lastCheckIn = $null
            $state.lastError = $null
            Write-Json $StatePath $state
            Write-Log "Linked as device $($result.deviceId)"
            Write-Host ""
            Write-Host "  Linked. The agent will check in within a few minutes." -ForegroundColor Green
            return $true
        }
    }

    Write-Log "Pairing code expired" "WARN"
    Write-Host ""
    Write-Host "  The code expired. Run this again to get a new one:" -ForegroundColor Red
    Write-Host "  powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Pair"
    return $false
}

function Get-DeviceAuthorization {
    $device = Read-Json $DevicePath
    if (-not $device) { return $null }
    return "Bearer {0}.{1}" -f $device.deviceId, (Unprotect-Text $device.secret)
}

# ============================================================================
# WINGET
# ============================================================================

function Invoke-Winget([string]$Winget, [string[]]$Arguments) {
    # Windows PowerShell turns native stderr into errors under "Stop" - collect it as text instead
    $ErrorActionPreference = "Continue"
    $output = & $Winget @Arguments 2>&1 | ForEach-Object { "$_" }
    # Drop spinner / progress-bar noise (block characters U+2580-U+259F)
    $clean = $output | Where-Object { $_ -and ($_ -notmatch '^\s*[-\\|/]\s*$') -and ($_ -notmatch '[\u2580-\u259F]') }
    if ($LASTEXITCODE -eq $ExitDllNotFound) {
        throw "winget couldn't start because the Visual C++ runtime is missing. Re-run Install-IdaraOSAgent.ps1, or install the Microsoft Visual C++ Redistributable (x64)"
    }
    return @{ ExitCode = $LASTEXITCODE; Output = ($clean -join "`n") }
}

function Test-WingetId([string]$Id) {
    return ($Id -match $WingetIdPattern) -and (-not $Id.Contains(".."))
}

function Get-InstalledVersion([string]$Winget, [string]$Id) {
    $result = Invoke-Winget $Winget @("list", "--id", $Id, "--exact", "--accept-source-agreements", "--disable-interactivity")
    if ($result.ExitCode -eq $ExitNoPackageFound) { return $null }
    if ($result.ExitCode -ne 0) { throw ("winget list failed with 0x{0:X8}" -f $result.ExitCode) }
    foreach ($line in ($result.Output -split "`n")) {
        $columns = $line.Trim() -split '\s{2,}'
        $index = [Array]::FindIndex($columns, [Predicate[string]]{ param($c) $c -ieq $Id })
        if ($index -ge 0 -and $columns.Length -gt $index + 1) { return $columns[$index + 1] }
    }
    return "unknown"
}

function Update-Package([string]$Winget, $Package, [System.Text.StringBuilder]$Log) {
    $id = [string]$Package.wingetId
    $result = @{ wingetId = $id; name = [string]$Package.name; outcome = "failed"; fromVersion = $null; toVersion = $null; exitCode = $null; rebootRequired = $false; message = $null }

    if (-not (Test-WingetId $id)) {
        $result.message = "Rejected: not a valid winget package ID"
        return $result
    }

    try {
        $before = Get-InstalledVersion $Winget $id
        if (-not $before) {
            $result.outcome = "not_installed"
            $result.message = "Not installed on this device"
            [void]$Log.AppendLine("== $id : not installed")
            return $result
        }
        $result.fromVersion = $before

        [void]$Log.AppendLine("== $id : upgrading from $before")
        $upgrade = Invoke-Winget $Winget @(
            "upgrade", "--id", $id, "--exact", "--silent", "--source", "winget",
            "--accept-source-agreements", "--accept-package-agreements", "--disable-interactivity"
        )
        [void]$Log.AppendLine($upgrade.Output)
        $result.exitCode = $upgrade.ExitCode

        switch ($upgrade.ExitCode) {
            0 { $result.outcome = "updated" }
            { $_ -eq $ExitUpdateNotApplicable } { $result.outcome = "up_to_date"; $result.exitCode = 0 }
            { $_ -eq $ExitNoPackageFound } { $result.outcome = "up_to_date"; $result.exitCode = 0 }
            { $_ -eq $ExitRebootToFinish } { $result.outcome = "updated"; $result.rebootRequired = $true; $result.message = "Restart needed to finish" }
            { $_ -eq $ExitRebootInitiated } { $result.outcome = "updated"; $result.rebootRequired = $true; $result.message = "The installer restarted the device" }
            { $_ -eq $ExitRebootForInstall } { $result.rebootRequired = $true; $result.message = "Restart the device, then the next run will update it" }
            { $_ -eq $ExitPackageInUse } { $result.message = "The app is open - it will be updated on a later run" }
            { $_ -eq $ExitFileInUse } { $result.message = "Files are in use - it will be updated on a later run" }
            default { $result.message = "winget exited with 0x{0:X8}" -f $upgrade.ExitCode }
        }

        $after = Get-InstalledVersion $Winget $id
        $result.toVersion = if ($after) { $after } else { $before }
        if ($result.outcome -eq "updated" -and $result.toVersion -eq $before -and -not $result.rebootRequired) {
            # winget said it worked but nothing changed - treat as already current
            $result.outcome = "up_to_date"
        }
    } catch {
        $result.message = "Error: $($_.Exception.Message)"
        [void]$Log.AppendLine("!! $id : $($_.Exception.Message)")
    }
    return $result
}

# ============================================================================
# REPORTS
# ============================================================================

function Send-Report([string]$Path, [string]$PendingName, $Report, [string]$Authorization) {
    try {
        Invoke-IdaraOS -Path $Path -Body $Report -Authorization $Authorization | Out-Null
        return $true
    } catch {
        $status = Get-HttpStatus $_
        # 400/404/409: the server will never take it
        if ($status -eq 400 -or $status -eq 404 -or $status -eq 409) {
            Write-Log "Report for $Path rejected ($status) - dropped" "WARN"
            return $true
        }
        # Keep it and send it before the next check-in
        if (-not (Test-Path $PendingDir)) { New-Item -ItemType Directory -Path $PendingDir -Force | Out-Null }
        Write-Json (Join-Path $PendingDir "$PendingName.json") ([pscustomobject]@{ path = $Path; report = $Report })
        Write-Log "Couldn't send report for $Path, saved for later: $($_.Exception.Message)" "WARN"
        return $false
    }
}

function Send-PendingReports([string]$Authorization) {
    if (-not (Test-Path $PendingDir)) { return }
    foreach ($file in Get-ChildItem -Path $PendingDir -Filter "*.json") {
        $saved = Read-Json $file.FullName
        if (-not $saved -or -not $saved.path) { Remove-Item $file.FullName -Force; continue }
        try {
            Invoke-IdaraOS -Path $saved.path -Body $saved.report -Authorization $Authorization | Out-Null
            Remove-Item $file.FullName -Force
            Write-Log "Sent saved report for $($saved.path)"
        } catch {
            $status = Get-HttpStatus $_
            if ($status -eq 400 -or $status -eq 404 -or $status -eq 409) { Remove-Item $file.FullName -Force }
            else { throw }
        }
    }
}

# ============================================================================
# UPDATE RUNS AND INSTALL JOBS
# ============================================================================

function Invoke-Run($Run, [string]$Authorization) {
    Write-Log "Run $($Run.id) ($($Run.trigger)) with $(@($Run.packages).Count) packages"
    $log = New-Object System.Text.StringBuilder
    $results = @()
    $runError = $null

    try {
        $winget = Find-Winget
        [void]$log.AppendLine("winget: $winget")
        foreach ($package in @($Run.packages)) {
            $result = Update-Package $winget $package $log
            Write-Log ("  {0}: {1} {2} -> {3} {4}" -f $result.wingetId, $result.outcome, $result.fromVersion, $result.toVersion, $result.message)
            $results += $result
        }
    } catch {
        $runError = $_.Exception.Message
        Write-Log "Run failed: $runError" "ERROR"
    }

    $report = @{ results = $results; error = $runError; log = (Limit-Text $log.ToString()) }
    if (Send-Report "/api/updater/v1/runs/$($Run.id)" "run-$($Run.id)" $report $Authorization) {
        Write-Log "Reported run $($Run.id)"
    }
}

function Invoke-InstallJob($Job, [string]$Authorization) {
    $id = [string]$Job.wingetId
    $workloads = @($Job.workloads | Where-Object { $_ } | ForEach-Object { [string]$_ })
    Write-Log "Install job $($Job.id): $($Job.name) ($id)"
    $report = @{ exitCode = $null; message = $null; log = $null }

    if ($Job.type -ne "install") {
        $report.message = "This agent version doesn't support '$($Job.type)' jobs - update the IdaraOS Agent"
    } elseif (-not (Test-WingetId $id)) {
        $report.message = "Rejected: not a valid winget package ID"
    } elseif ($workloads -and ($id -notmatch $VsPackagePattern)) {
        $report.message = "Rejected: workloads are only for Visual Studio"
    } elseif ($badWorkload = $workloads | Where-Object { ($_ -notmatch $VsWorkloadPattern) -or $_.Contains("..") } | Select-Object -First 1) {
        $report.message = "Rejected: not a Visual Studio workload ID: $badWorkload"
    } else {
        try {
            $winget = Find-Winget
            $arguments = @(
                "install", "--id", $id, "--exact", "--silent", "--scope", "machine", "--source", "winget",
                "--accept-source-agreements", "--accept-package-agreements", "--disable-interactivity"
            )
            if ($workloads) {
                # Added to the Visual Studio installer's own silent switches. --norestart: never restart the
                # member's laptop in the middle of their work; winget reports when a restart is needed.
                $custom = (@($workloads | ForEach-Object { "--add $_" }) + @("--includeRecommended", "--norestart")) -join " "
                $arguments += @("--custom", $custom)
                Write-Log "  Workloads: $($workloads -join ', ')"
            }
            $install = Invoke-Winget $winget $arguments
            $report.exitCode = $install.ExitCode
            $report.log = Limit-Text $install.Output
            Write-Log ("  winget install {0} exited 0x{1:X8}" -f $id, $install.ExitCode)
        } catch {
            $report.message = "Error: $($_.Exception.Message)"
            Write-Log "  Install failed: $($report.message)" "ERROR"
        }
    }

    if (Send-Report "/api/updater/v1/jobs/$($Job.id)" "job-$($Job.id)" $report $Authorization) {
        Write-Log "Reported job $($Job.id)"
    }
}

# ============================================================================
# DEVICE ACTIONS
#   Each returns @{ exitCode; message; log }. exitCode 0 = success. No action takes free-text
#   input from the server; "restart-service" maps an allowlisted key to a service name here.
# ============================================================================

function Get-Diagnostics {
    $sb = New-Object System.Text.StringBuilder
    $os = Get-CimInstance Win32_OperatingSystem
    [void]$sb.AppendLine("Host: $env:COMPUTERNAME")
    [void]$sb.AppendLine("OS: $($os.Caption) $($os.Version)")
    [void]$sb.AppendLine("Last boot: $($os.LastBootUpTime)")
    [void]$sb.AppendLine("Free memory (MB): $([math]::Round($os.FreePhysicalMemory / 1024))")
    foreach ($disk in Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3") {
        [void]$sb.AppendLine(("Disk {0} free: {1:N1} GB of {2:N1} GB" -f $disk.DeviceID, ($disk.FreeSpace / 1GB), ($disk.Size / 1GB)))
    }
    $pending = (Test-Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending") -or `
               (Test-Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired")
    [void]$sb.AppendLine("Pending reboot: $pending")
    try { [void]$sb.AppendLine("winget: $(Find-Winget)") } catch { [void]$sb.AppendLine("winget: not installed for the system") }
    return @{ exitCode = 0; message = "Diagnostics collected"; log = $sb.ToString() }
}

function Get-InstalledSoftware {
    $winget = Find-Winget
    $result = Invoke-Winget $winget @("list", "--accept-source-agreements", "--disable-interactivity")
    $message = if ($result.ExitCode -eq 0) { "Listed installed software" } else { "winget list exited 0x{0:X8}" -f $result.ExitCode }
    return @{ exitCode = $result.ExitCode; message = $message; log = $result.Output }
}

function Update-AllApps([bool]$IncludeUnknown) {
    $winget = Find-Winget
    # Runs as SYSTEM, so no admin prompt. --silent / --disable-interactivity keep it unattended.
    $arguments = @(
        "upgrade", "--all", "--silent", "--source", "winget",
        "--accept-source-agreements", "--accept-package-agreements", "--disable-interactivity"
    )
    if ($IncludeUnknown) { $arguments += "--include-unknown" }
    $result = Invoke-Winget $winget $arguments
    switch ($result.ExitCode) {
        0 { return @{ exitCode = 0; message = "Updated all apps that had updates"; log = $result.Output } }
        { $_ -eq $ExitNoPackageFound } { return @{ exitCode = 0; message = "Everything is already up to date"; log = $result.Output } }
        { $_ -eq $ExitUpdateNotApplicable } { return @{ exitCode = 0; message = "Everything is already up to date"; log = $result.Output } }
        { ($_ -eq $ExitRebootToFinish) -or ($_ -eq $ExitRebootInitiated) -or ($_ -eq $ExitRebootForInstall) } {
            return @{ exitCode = 0; message = "Updated apps - a restart is needed to finish"; log = $result.Output }
        }
        default { return @{ exitCode = $result.ExitCode; message = ("winget upgrade --all exited 0x{0:X8}" -f $result.ExitCode); log = $result.Output } }
    }
}

# NVM for Windows (Corey Butler). The agent runs as SYSTEM, so it can only see nvm if it's
# installed machine-wide - the installer sets NVM_HOME / NVM_SYMLINK as machine environment
# variables and puts nvm on the machine PATH. A per-user install isn't visible to SYSTEM.
function Find-Nvm {
    $candidates = @()
    $machineHome = [Environment]::GetEnvironmentVariable("NVM_HOME", "Machine")
    if ($machineHome) { $candidates += (Join-Path $machineHome "nvm.exe") }
    $cmd = Get-Command nvm.exe -ErrorAction SilentlyContinue
    if ($cmd) { $candidates += $cmd.Source }
    $candidates += @(
        (Join-Path $env:ProgramData "nvm\nvm.exe"),
        (Join-Path ${env:ProgramFiles} "nvm\nvm.exe"),
        "C:\nvm\nvm.exe"
    )
    foreach ($exe in $candidates) {
        if ($exe -and (Test-Path $exe)) { return $exe }
    }
    return $null
}

function Invoke-Nvm([string]$Nvm, [string[]]$Arguments) {
    $ErrorActionPreference = "Continue"
    # nvm reads NVM_HOME / NVM_SYMLINK. SYSTEM won't have a user's copies, so make sure the
    # process has the machine values (or fall back to the folder nvm.exe lives in).
    if (-not $env:NVM_HOME) {
        $env:NVM_HOME = [Environment]::GetEnvironmentVariable("NVM_HOME", "Machine")
        if (-not $env:NVM_HOME) { $env:NVM_HOME = Split-Path $Nvm -Parent }
    }
    if (-not $env:NVM_SYMLINK) {
        $env:NVM_SYMLINK = [Environment]::GetEnvironmentVariable("NVM_SYMLINK", "Machine")
    }
    $output = & $Nvm @Arguments 2>&1 | ForEach-Object { "$_" }
    return @{ ExitCode = $LASTEXITCODE; Output = ($output -join "`n") }
}

# Installed Node versions from `nvm list` (lines like "  * 22.2.1 (Currently using 64-bit executable)")
function Get-NvmInstalled([string]$Nvm) {
    $result = Invoke-Nvm $Nvm @("list")
    $versions = @()
    $current = $null
    foreach ($line in ($result.Output -split "`n")) {
        $m = [regex]::Match($line, '(\*)?\s*(\d+\.\d+\.\d+)')
        if ($m.Success) {
            $v = $m.Groups[2].Value
            $versions += $v
            if ($line.Trim().StartsWith("*")) { $current = $v }
        }
    }
    return @{ Versions = @($versions | Select-Object -Unique); Current = $current; Raw = $result.Output }
}

function Get-NodeVersions {
    $nvm = Find-Nvm
    if (-not $nvm) {
        return @{ exitCode = 1; message = "NVM for Windows isn't installed machine-wide on this device, so the agent (SYSTEM) can't see it"; log = $null }
    }
    $result = Invoke-Nvm $nvm @("list")
    return @{ exitCode = 0; message = "Listed Node.js versions (nvm)"; log = $result.Output }
}

function Update-NodeVersions {
    $nvm = Find-Nvm
    if (-not $nvm) {
        return @{ exitCode = 1; message = "NVM for Windows isn't installed machine-wide on this device, so the agent (SYSTEM) can't manage Node versions"; log = $null }
    }
    $sb = New-Object System.Text.StringBuilder
    $before = Get-NvmInstalled $nvm
    [void]$sb.AppendLine("nvm list (before):")
    [void]$sb.AppendLine($before.Raw)
    if (@($before.Versions).Count -eq 0) {
        return @{ exitCode = 0; message = "No Node.js versions are installed under nvm"; log = $sb.ToString() }
    }

    # The full release list, so we can find the newest patch in each installed major line
    try {
        $index = Invoke-RestMethod -Uri "https://nodejs.org/dist/index.json" -UseBasicParsing -TimeoutSec 60
    } catch {
        [void]$sb.AppendLine("Couldn't reach nodejs.org: $($_.Exception.Message)")
        return @{ exitCode = 1; message = "Couldn't check for Node.js updates (nodejs.org unreachable)"; log = $sb.ToString() }
    }

    $updated = @()
    foreach ($major in (@($before.Versions | ForEach-Object { ($_ -split '\.')[0] }) | Select-Object -Unique)) {
        $installedInMajor = @($before.Versions | Where-Object { ($_ -split '\.')[0] -eq $major }) |
            Sort-Object { [version]$_ } -Descending | Select-Object -First 1
        $latest = @($index | Where-Object { $_.version -match "^v$major\." }) |
            Sort-Object { [version]($_.version.TrimStart('v')) } -Descending | Select-Object -First 1
        if (-not $latest) {
            [void]$sb.AppendLine("Node $major.x: no releases found on nodejs.org")
            continue
        }
        $latestV = $latest.version.TrimStart('v')
        if ([version]$latestV -gt [version]$installedInMajor) {
            [void]$sb.AppendLine("Node $major.x: $installedInMajor -> $latestV (installing)")
            $install = Invoke-Nvm $nvm @("install", $latestV)
            [void]$sb.AppendLine($install.Output)
            $updated += "$installedInMajor -> $latestV"
        } else {
            [void]$sb.AppendLine("Node $major.x: $installedInMajor is already the newest")
        }
    }

    # Keep whatever line was active active, on its newest installed version
    if ($before.Current) {
        $after = Get-NvmInstalled $nvm
        $curMajor = ($before.Current -split '\.')[0]
        $use = @($after.Versions | Where-Object { ($_ -split '\.')[0] -eq $curMajor }) |
            Sort-Object { [version]$_ } -Descending | Select-Object -First 1
        if ($use) {
            $useResult = Invoke-Nvm $nvm @("use", $use)
            [void]$sb.AppendLine($useResult.Output)
        }
    }

    $final = Get-NvmInstalled $nvm
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("nvm list (after):")
    [void]$sb.AppendLine($final.Raw)

    $message = if (@($updated).Count -gt 0) { "Updated Node.js: " + (@($updated) -join ", ") } else { "All installed Node.js versions are already up to date" }
    return @{ exitCode = 0; message = $message; log = $sb.ToString() }
}

function Get-LocalAdmins {
    try {
        $names = @(Get-LocalGroupMember -Group "Administrators" -ErrorAction Stop | ForEach-Object { [string]$_.Name })
        return @{ exitCode = 0; message = ("{0} account(s) in Administrators" -f $names.Count); log = ($names -join "`n") }
    } catch {
        # Older hosts or a renamed group: fall back to net localgroup
        $raw = net localgroup Administrators 2>&1 | ForEach-Object { "$_" }
        return @{ exitCode = 0; message = "Listed local administrators"; log = ($raw -join "`n") }
    }
}

function Restart-AllowedService([string]$Key) {
    if (-not $RestartableServices.ContainsKey($Key)) {
        return @{ exitCode = 1; message = "Rejected: '$Key' isn't a service this agent may restart"; log = $null }
    }
    $service = $RestartableServices[$Key]
    Restart-Service -Name $service -Force -ErrorAction Stop
    return @{ exitCode = 0; message = "Restarted the $service service"; log = $null }
}

function Clear-UpdateCache {
    $sb = New-Object System.Text.StringBuilder
    foreach ($service in @("wuauserv", "bits")) {
        try { Stop-Service -Name $service -Force -ErrorAction Stop; [void]$sb.AppendLine("Stopped $service") }
        catch { [void]$sb.AppendLine("Could not stop ${service}: $($_.Exception.Message)") }
    }
    $softwareDistribution = Join-Path $env:SystemRoot "SoftwareDistribution"
    if (Test-Path $softwareDistribution) {
        $backup = "$softwareDistribution.old"
        if (Test-Path $backup) { Remove-Item $backup -Recurse -Force -ErrorAction SilentlyContinue }
        Rename-Item -Path $softwareDistribution -NewName "SoftwareDistribution.old" -Force -ErrorAction Stop
        [void]$sb.AppendLine("Cleared the SoftwareDistribution folder")
    }
    foreach ($service in @("bits", "wuauserv")) {
        try { Start-Service -Name $service -ErrorAction Stop; [void]$sb.AppendLine("Started $service") }
        catch { [void]$sb.AppendLine("Could not start ${service}: $($_.Exception.Message)") }
    }
    return @{ exitCode = 0; message = "Cleared the Windows Update cache"; log = $sb.ToString() }
}

function Invoke-ActionJob($Job, [string]$Authorization) {
    $key = [string]$Job.actionKey
    $param = [string]$Job.param
    $label = if ($param) { "$key / $param" } else { $key }
    Write-Log "Action job $($Job.id): $($Job.name) ($label)"
    $report = @{ exitCode = $null; message = $null; log = $null }

    try {
        switch ($key) {
            "collect-diagnostics"     { $result = Get-Diagnostics }
            "list-installed-software" { $result = Get-InstalledSoftware }
            "upgrade-all"             { $result = Update-AllApps $false }
            "upgrade-all-unknown"     { $result = Update-AllApps $true }
            "list-node-versions"      { $result = Get-NodeVersions }
            "update-node"             { $result = Update-NodeVersions }
            "check-local-admins"      { $result = Get-LocalAdmins }
            "restart-service"         { $result = Restart-AllowedService $param }
            "clear-update-cache"      { $result = Clear-UpdateCache }
            default {
                $result = @{ exitCode = 1; message = "This agent version doesn't support the '$key' action - update the IdaraOS Agent"; log = $null }
            }
        }
        $report.exitCode = $result.exitCode
        $report.message = $result.message
        if ($result.log) { $report.log = Limit-Text ([string]$result.log) }
        Write-Log ("  action {0} exited {1}" -f $key, $result.exitCode)
    } catch {
        $report.exitCode = 1
        $report.message = "Error: $($_.Exception.Message)"
        Write-Log "  Action failed: $($report.message)" "ERROR"
    }

    if (Send-Report "/api/updater/v1/jobs/$($Job.id)" "job-$($Job.id)" $report $Authorization) {
        Write-Log "Reported job $($Job.id)"
    }
}

# ============================================================================
# POLICIES
#   The server sends the effective desired state (policy types from a fixed allowlist, matching
#   lib/security/device-policies.ts). The agent applies only the policy types it knows, idempotently,
#   and reverts a policy it previously applied once the server stops sending it. No free-text input.
# ============================================================================

# Block USB mass storage with two layers, so it holds across device types and current sessions:
#   1. The mass-storage drivers USBSTOR and UASPStor (Start 4 = disabled, 3 = default). BOTH matter:
#      modern USB drives (USB 3.x sticks, external SSDs) use UASP (uaspstor), which USBSTOR alone
#      doesn't cover. This fully bites after a reboot - the disabled driver then never loads.
#   2. The "Removable Disks" access policy (driver-agnostic, no reboot): deny read and write.
#   Keyboards, mice, webcams and other non-storage USB devices are unaffected. All reversible.
function Set-UsbStorageBlock([bool]$Blocked) {
    $errors = @()
    $start = if ($Blocked) { 4 } else { 3 }
    foreach ($svc in @("USBSTOR", "UASPStor")) {
        $key = "HKLM:\SYSTEM\CurrentControlSet\Services\$svc"
        if (Test-Path $key) {
            try { Set-ItemProperty -Path $key -Name "Start" -Value $start -Type DWord -ErrorAction Stop }
            catch { $errors += ("{0}: {1}" -f $svc, $_.Exception.Message) }
        }
    }
    # Removable Disks device class (this GUID is Windows' own identifier for removable disks)
    $policyKey = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\RemovableStorageDevices\{53f5630d-b6bf-11d0-94f2-00a0c91efb8b}"
    try {
        if ($Blocked) {
            if (-not (Test-Path $policyKey)) { New-Item -Path $policyKey -Force | Out-Null }
            Set-ItemProperty -Path $policyKey -Name "Deny_Read" -Value 1 -Type DWord -ErrorAction Stop
            Set-ItemProperty -Path $policyKey -Name "Deny_Write" -Value 1 -Type DWord -ErrorAction Stop
        } elseif (Test-Path $policyKey) {
            Set-ItemProperty -Path $policyKey -Name "Deny_Read" -Value 0 -Type DWord -ErrorAction Stop
            Set-ItemProperty -Path $policyKey -Name "Deny_Write" -Value 0 -Type DWord -ErrorAction Stop
        }
    } catch { $errors += ("RemovableStorageDevices: {0}" -f $_.Exception.Message) }

    if ($errors.Count -gt 0) {
        return @{ type = "usb-storage-block"; ok = $false; message = ("Error: " + ($errors -join "; ")); state = @{ blocked = $Blocked } }
    }
    $message = if ($Blocked) { "USB storage blocked" } else { "USB storage allowed" }
    return @{ type = "usb-storage-block"; ok = $true; message = $message; state = @{ blocked = $Blocked } }
}

# Firewall: keep Windows Defender Firewall on for all profiles with inbound blocked by default.
# Idempotent and re-applied each check-in, so a firewall someone turned off comes back on. This is a
# protective policy - it only ever forces "on" and never turns the firewall off.
function Set-FirewallOn {
    $errors = @()
    try {
        Set-NetFirewallProfile -Profile Domain, Public, Private -Enabled True -DefaultInboundAction Block -ErrorAction Stop
    } catch {
        # Fall back to netsh where the NetSecurity module isn't available
        try {
            & netsh advfirewall set allprofiles state on | Out-Null
            & netsh advfirewall set allprofiles firewallpolicy blockinbound,allowoutbound | Out-Null
            if ($LASTEXITCODE -ne 0) { throw "netsh advfirewall returned $LASTEXITCODE" }
        } catch { $errors += $_.Exception.Message }
    }
    $profilesOn = $null
    try { $profilesOn = @(Get-NetFirewallProfile -ErrorAction Stop | ForEach-Object { "{0}={1}" -f $_.Name, $_.Enabled }) } catch { }
    if ($errors.Count -gt 0) {
        return @{ type = "firewall-on"; ok = $false; message = ("Error: " + ($errors -join "; ")); state = @{ enabled = $false } }
    }
    $msg = if ($profilesOn) { "Firewall on: " + ($profilesOn -join ", ") } else { "Firewall on (all profiles, inbound blocked)" }
    return @{ type = "firewall-on"; ok = $true; message = $msg; state = @{ enabled = $true } }
}

# ============================================================================
# INTERNET QUARANTINE (1.9.0)
#   When the server says a device stayed non-compliant past the grace period (or an admin locked it),
#   block ALL outbound except the IdaraOS server + DNS/DHCP/loopback, so the agent keeps checking in and
#   the user can still reach IdaraOS. Revertable - Remove-Quarantine restores normal outbound.
# ============================================================================

$QuarantineGroup = "IdaraOS Quarantine"

# Allow IdaraOS + DNS/DHCP/loopback outbound, THEN flip the default outbound action to Block. Resolve
# the server IPs and add the allow rules FIRST so the agent never loses IdaraOS/DNS. Re-applied each
# cycle while quarantined so rotating/CDN server IPs stay allowed.
function Set-Quarantine {
    $errors = @()
    if (-not (Get-Command New-NetFirewallRule -ErrorAction SilentlyContinue)) {
        return @{ type = "quarantine"; ok = $false; message = "NetSecurity module unavailable"; state = @{ quarantined = $false } }
    }

    # Resolve the IdaraOS server host to IPs (DNS still works here: outbound is Allow on first apply, and
    # our DNS allow rule is present on re-apply).
    $serverIps = @()
    try {
        $h = ([uri](Get-ServerUrl)).Host
        if ($h) {
            foreach ($t in @("A", "AAAA")) {
                try { $serverIps += @(Resolve-DnsName -Name $h -Type $t -ErrorAction Stop | Where-Object { $_.IPAddress } | ForEach-Object { [string]$_.IPAddress }) } catch { }
            }
        }
    } catch { }
    $serverIps = @($serverIps | Select-Object -Unique)

    # Rebuild our rule set from scratch (idempotent; picks up new server IPs)
    try { Get-NetFirewallRule -Group $QuarantineGroup -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue } catch { }
    try {
        New-NetFirewallRule -Group $QuarantineGroup -DisplayName "IdaraOS Quarantine - DNS UDP" -Direction Outbound -Action Allow -Protocol UDP -RemotePort 53 -ErrorAction Stop | Out-Null
        New-NetFirewallRule -Group $QuarantineGroup -DisplayName "IdaraOS Quarantine - DNS TCP" -Direction Outbound -Action Allow -Protocol TCP -RemotePort 53 -ErrorAction Stop | Out-Null
        New-NetFirewallRule -Group $QuarantineGroup -DisplayName "IdaraOS Quarantine - DHCP" -Direction Outbound -Action Allow -Protocol UDP -RemotePort 67 -ErrorAction Stop | Out-Null
        New-NetFirewallRule -Group $QuarantineGroup -DisplayName "IdaraOS Quarantine - Loopback" -Direction Outbound -Action Allow -RemoteAddress "127.0.0.0/8", "::1" -ErrorAction Stop | Out-Null
        if ($serverIps.Count -gt 0) {
            New-NetFirewallRule -Group $QuarantineGroup -DisplayName "IdaraOS Quarantine - IdaraOS" -Direction Outbound -Action Allow -Protocol TCP -RemotePort 443 -RemoteAddress $serverIps -ErrorAction Stop | Out-Null
        } else {
            $errors += "couldn't resolve the IdaraOS server IP"
        }
    } catch { $errors += ("rules: " + $_.Exception.Message) }

    # Flip the default outbound action to Block (after the allow rules exist)
    try { Set-NetFirewallProfile -Profile Domain, Public, Private -DefaultOutboundAction Block -ErrorAction Stop }
    catch { $errors += ("outbound block: " + $_.Exception.Message) }

    $state = @{ quarantined = $true; serverIps = $serverIps.Count }
    if ($errors.Count -gt 0) {
        return @{ type = "quarantine"; ok = $false; message = ("Applied with issues: " + ($errors -join "; ")); state = $state }
    }
    return @{ type = "quarantine"; ok = $true; message = ("Quarantined: outbound blocked except IdaraOS ({0} IP) + DNS" -f $serverIps.Count); state = $state }
}

# Lift the quarantine: restore the default outbound action to Allow and delete our rules by group.
function Remove-Quarantine {
    $errors = @()
    try { Set-NetFirewallProfile -Profile Domain, Public, Private -DefaultOutboundAction Allow -ErrorAction Stop }
    catch { $errors += $_.Exception.Message }
    try { Get-NetFirewallRule -Group $QuarantineGroup -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue } catch { $errors += $_.Exception.Message }
    $ok = ($errors.Count -eq 0)
    $msg = if ($ok) { "Quarantine lifted - outbound restored" } else { "Quarantine lifted with issues: " + ($errors -join "; ") }
    return @{ type = "quarantine"; ok = $ok; message = $msg; state = @{ quarantined = $false } }
}

# Microsoft Defender: ensure the service runs and real-time protection is on, and report whether
# Windows Tamper Protection is enabled. Tamper Protection can only be switched on from Intune/MDM,
# and while it is on Windows blocks scripted changes to Defender - so when it's on we report rather
# than force. Protective policy: never disables antivirus.
function Set-DefenderOn {
    $errors = @()
    $tamper = $null
    $realtimeOn = $null
    try {
        $svc = Get-Service -Name WinDefend -ErrorAction Stop
        if ($svc.Status -ne "Running") { Start-Service -Name WinDefend -ErrorAction Stop }
    } catch { $errors += ("WinDefend service: " + $_.Exception.Message) }
    try { Set-MpPreference -DisableRealtimeMonitoring $false -ErrorAction Stop } catch { $errors += ("real-time: " + $_.Exception.Message) }
    try {
        $status = Get-MpComputerStatus -ErrorAction Stop
        $realtimeOn = [bool]$status.RealTimeProtectionEnabled
        $tamper = [bool]$status.IsTamperProtected
    } catch { }
    $state = @{ realtimeOn = $realtimeOn; tamperProtected = $tamper }
    if ($realtimeOn -eq $true) {
        $msg = "Defender real-time protection on"
        if ($tamper -eq $true) { $msg += " (Tamper Protection on)" }
        return @{ type = "defender-on"; ok = $true; message = $msg; state = $state }
    }
    if ($realtimeOn -eq $false) {
        # Expected when Tamper Protection is on - Windows then blocks our scripted change
        $msg = "Real-time protection is OFF"
        if ($tamper -eq $true) { $msg += " (Tamper Protection on - managed by Windows)" }
        return @{ type = "defender-on"; ok = $false; message = $msg; state = $state }
    }
    # Couldn't read the status (Defender cmdlets missing, or the read failed)
    $msg = "Couldn't confirm Defender status"
    if ($errors.Count -gt 0) { $msg += ": " + ($errors -join "; ") }
    return @{ type = "defender-on"; ok = $false; message = $msg; state = $state }
}

# BitLocker: turn encryption on for the OS drive (and optionally fixed data drives), make sure a
# recovery-password protector exists, and hand the recovery key back so the server can escrow it.
# Protective policy: it never decrypts a disk. Returns @{ result = <policy result>; volumes = @(...) }
# where each volume carries its recovery key - the key is kept out of the policy result's state.
function Set-BitLocker([bool]$IncludeDataDrives) {
    $errors = @()
    $volumes = @()
    if (-not (Get-Command Get-BitLockerVolume -ErrorAction SilentlyContinue)) {
        return @{ result = @{ type = "bitlocker"; ok = $false; message = "BitLocker isn't available on this edition of Windows"; state = @{} }; volumes = @() }
    }

    $tpmReady = $false
    try { $t = Get-Tpm -ErrorAction Stop; $tpmReady = ($t.TpmPresent -and $t.TpmReady) } catch { }

    $targets = @()
    try {
        foreach ($v in @(Get-BitLockerVolume -ErrorAction Stop)) {
            if ($v.VolumeType -eq "OperatingSystem") {
                $targets += $v
            } elseif ($IncludeDataDrives -and $v.VolumeType -eq "Data") {
                # Only fixed data drives (never removable media)
                $dt = $null
                try { $dt = (Get-Volume -DriveLetter ($v.MountPoint.TrimEnd(":")) -ErrorAction Stop).DriveType } catch { }
                if ($dt -eq "Fixed" -or $null -eq $dt) { $targets += $v }
            }
        }
    } catch { $errors += $_.Exception.Message }

    foreach ($v in $targets) {
        $mp = $v.MountPoint
        $isOs = ($v.VolumeType -eq "OperatingSystem")
        try {
            if ($v.VolumeStatus -eq "FullyDecrypted") {
                if ($isOs) {
                    if (-not $tpmReady) { throw "no usable TPM for the OS drive" }
                    Enable-BitLocker -MountPoint $mp -EncryptionMethod XtsAes256 -UsedSpaceOnly -TpmProtector -SkipHardwareTest -ErrorAction Stop | Out-Null
                } else {
                    Enable-BitLocker -MountPoint $mp -EncryptionMethod XtsAes256 -UsedSpaceOnly -RecoveryPasswordProtector -SkipHardwareTest -ErrorAction Stop | Out-Null
                    try { Enable-BitLockerAutoUnlock -MountPoint $mp -ErrorAction Stop | Out-Null } catch { }
                }
            }
            # Make sure a recovery-password protector exists, so there's always a key to escrow
            $cur = Get-BitLockerVolume -MountPoint $mp -ErrorAction Stop
            $rp = @($cur.KeyProtector | Where-Object { $_.KeyProtectorType -eq "RecoveryPassword" })
            if ($rp.Count -eq 0) {
                Add-BitLockerKeyProtector -MountPoint $mp -RecoveryPasswordProtector -ErrorAction Stop | Out-Null
                $cur = Get-BitLockerVolume -MountPoint $mp -ErrorAction Stop
                $rp = @($cur.KeyProtector | Where-Object { $_.KeyProtectorType -eq "RecoveryPassword" })
            }
            $protector = $rp | Select-Object -First 1
            if ($protector -and $protector.RecoveryPassword) {
                $volumes += @{
                    volume = [string]$mp
                    recoveryKeyId = [string]$protector.KeyProtectorId
                    recoveryKey = [string]$protector.RecoveryPassword
                    encryptionMethod = [string]$cur.EncryptionMethod
                    protectionOn = ($cur.ProtectionStatus -eq "On")
                    encryptionPercentage = [int]$cur.EncryptionPercentage
                }
            } else {
                $errors += ("{0}: no recovery password protector" -f $mp)
            }
        } catch {
            $errors += ("{0}: {1}" -f $mp, $_.Exception.Message)
        }
    }

    $protectedCount = @($volumes | Where-Object { $_.protectionOn }).Count
    $state = @{ volumes = $volumes.Count; protected = $protectedCount }
    if ($errors.Count -gt 0) {
        return @{ result = @{ type = "bitlocker"; ok = $false; message = ("Error: " + ($errors -join "; ")); state = $state }; volumes = $volumes }
    }
    $msg = "BitLocker: {0} volume(s), {1} protected, key escrowed" -f $volumes.Count, $protectedCount
    return @{ result = @{ type = "bitlocker"; ok = $true; message = $msg; state = $state }; volumes = $volumes }
}

# ============================================================================
# MANAGED ADMIN PASSWORD
#   When the server asks (a grant ended, or first adoption), rotate a pre-existing local admin
#   account to a unique random password and hand it back so IdaraOS can escrow it (encrypted at
#   rest). The agent NEVER creates the account - if it's missing, it reports "missing" and stops.
#   The password is kept DPAPI-protected on disk between check-ins and sent over HTTPS, exactly like
#   the BitLocker recovery keys.
# ============================================================================

# A strong random password: 20 characters, at least one of each class, no ambiguous characters.
function New-ManagedPassword {
    $lower  = "abcdefghijkmnpqrstuvwxyz"   # no l, o
    $upper  = "ABCDEFGHJKLMNPQRSTUVWXYZ"   # no I, O
    $digit  = "23456789"                   # no 0, 1
    $symbol = "!@#%^&*()-_=+[]{}"
    $all = $lower + $upper + $digit + $symbol
    $bytes = New-Object byte[] 96
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    $chars = New-Object System.Collections.Generic.List[char]
    $i = 0
    foreach ($set in @($lower, $upper, $digit, $symbol)) {
        $chars.Add($set[$bytes[$i] % $set.Length]); $i++
    }
    while ($chars.Count -lt 20) { $chars.Add($all[$bytes[$i] % $all.Length]); $i++ }
    # Fisher-Yates shuffle so the guaranteed characters aren't always first
    for ($j = $chars.Count - 1; $j -gt 0; $j--) {
        $k = $bytes[$i % $bytes.Length] % ($j + 1); $i++
        $tmp = $chars[$j]; $chars[$j] = $chars[$k]; $chars[$k] = $tmp
    }
    return (-join $chars)
}

# Rotate the configured local admin account's password. Returns @{ status; account; password?;
# rotatedAt?; error? }. status: "ok" (rotated), "missing" (no such account), "error".
function Set-ManagedAdminPassword([string]$Account) {
    $name = ([string]$Account).Trim()
    if (-not $name) { return @{ status = "error"; account = $Account; error = "No admin account configured" } }

    # The account must already exist - the agent never creates local accounts
    $exists = $false
    try {
        if (Get-Command Get-LocalUser -ErrorAction SilentlyContinue) {
            $exists = [bool](Get-LocalUser -Name $name -ErrorAction SilentlyContinue)
        } else {
            $raw = (net user 2>&1 | ForEach-Object { "$_" }) -join " "
            $exists = $raw -match [regex]::Escape($name)
        }
    } catch { }
    if (-not $exists) { return @{ status = "missing"; account = $name } }

    try {
        $password = New-ManagedPassword
        if (Get-Command Set-LocalUser -ErrorAction SilentlyContinue) {
            $secure = ConvertTo-SecureString $password -AsPlainText -Force
            Set-LocalUser -Name $name -Password $secure -ErrorAction Stop
        } else {
            # Fall back to net user on hosts without the LocalAccounts module
            $out = net user $name $password 2>&1 | ForEach-Object { "$_" }
            if ($LASTEXITCODE -ne 0) { throw ("net user failed: " + (($out -join " ").Trim())) }
        }
        return @{ status = "ok"; account = $name; password = $password; rotatedAt = (Get-Date).ToUniversalTime().ToString("o") }
    } catch {
        return @{ status = "error"; account = $name; error = $_.Exception.Message }
    }
}

# ============================================================================
# WEB FILTERING
#   Filter web access with a filtering DNS resolver, a hosts-file category block, browser policies
#   (Chrome, Edge) and Microsoft Defender network protection. Category domain lists are fetched from
#   the server (SHA-256 verified) and cached; everything is re-applied each check-in and fully
#   reverted when the policy is removed. Revertable: it only ever restores normal browsing.
# ============================================================================

$WebFilterDir = Join-Path $BaseDir "filter-lists"
$HostsPath = Join-Path $env:SystemRoot "System32\drivers\etc\hosts"
$WebFilterBegin = "# BEGIN IdaraOS WebFilter"
$WebFilterEnd = "# END IdaraOS WebFilter"
$ChromeKey = "HKLM:\SOFTWARE\Policies\Google\Chrome"
$EdgeKey = "HKLM:\SOFTWARE\Policies\Microsoft\Edge"
# Cloudflare for Families resolvers: security (malware/phishing) and family (malware + adult).
$DnsSecurity = @("1.1.1.2", "1.0.0.2")
$DnsFamily = @("1.1.1.3", "1.0.0.3")

# Normalize a list/admin entry into a bare hostname, or $null to skip (comments, blanks, junk).
function ConvertTo-FilterHost([string]$Line) {
    $s = ([string]$Line).Trim().ToLower()
    if (-not $s -or $s.StartsWith("#") -or $s.StartsWith("!")) { return $null }
    $s = $s -replace '^https?://', ''   # scheme
    $s = $s -replace '^\*\.', ''        # wildcard prefix -> apex
    $s = $s -replace '/.*$', ''         # path
    $s = $s -replace ':\d+$', ''        # port
    $s = $s.Trim('.')
    if (-not $s -or $s -notmatch '^[a-z0-9.-]+\.[a-z]{2,}$') { return $null }
    return $s
}

# Download a category list to the cache if its hash changed, verifying SHA-256. Returns the cached
# file path, or $null. Reuses the cached copy when its hash matches the one the server advertised.
function Get-FilterListFile([string]$Category, [string]$Sha256, [string]$Authorization) {
    if (-not (Test-Path $WebFilterDir)) { New-Item -ItemType Directory -Path $WebFilterDir -Force | Out-Null }
    $dest = Join-Path $WebFilterDir ("{0}.txt" -f $Category)
    $want = ([string]$Sha256).ToLower()
    if ((Test-Path $dest) -and $want) {
        try { if ((Get-FileHash -Path $dest -Algorithm SHA256).Hash.ToLower() -eq $want) { return $dest } } catch { }
    }
    $temp = Join-Path $env:TEMP ("IdaraOS-list-{0}.txt" -f ([guid]::NewGuid().ToString("N")))
    try {
        $uri = "{0}/api/updater/v1/filter-list/{1}" -f (Get-ServerUrl), $Category
        $headers = @{ "User-Agent" = "IdaraOS-Agent/$AgentVersion"; "Authorization" = $Authorization }
        $ProgressPreference = "SilentlyContinue"
        Invoke-WebRequest -Uri $uri -Headers $headers -OutFile $temp -UseBasicParsing -TimeoutSec 60
        if ($want) {
            $have = (Get-FileHash -Path $temp -Algorithm SHA256).Hash.ToLower()
            if ($have -ne $want) { Write-Log ("  web-filter list {0}: SHA-256 mismatch" -f $Category) "ERROR"; return $null }
        }
        Copy-Item -Path $temp -Destination $dest -Force
        return $dest
    } catch {
        Write-Log ("  web-filter list {0}: download failed: {1}" -f $Category, $_.Exception.Message) "ERROR"
        if (Test-Path $dest) { return $dest }   # fall back to a cached copy
        return $null
    } finally {
        Remove-Item -Path $temp -Force -ErrorAction SilentlyContinue
    }
}

# Rebuild the IdaraOS block in the hosts file (0.0.0.0 for each domain + its www host). An empty list
# removes the block entirely. Only ever touches the lines between our own markers.
function Set-HostsFilter([string[]]$Domains) {
    $lines = @()
    # Read via .NET (Get-Content can throw "Stream was not readable" on the hosts file)
    if (Test-Path $HostsPath) { try { $lines = @([System.IO.File]::ReadAllLines($HostsPath)) } catch { $lines = @() } }
    $kept = New-Object System.Collections.Generic.List[string]
    $inRegion = $false
    foreach ($line in $lines) {
        if ($line -eq $WebFilterBegin) { $inRegion = $true; continue }
        if ($line -eq $WebFilterEnd) { $inRegion = $false; continue }
        if (-not $inRegion) { $kept.Add($line) }
    }
    if ($Domains.Count -gt 0) {
        while ($kept.Count -gt 0 -and [string]::IsNullOrWhiteSpace($kept[$kept.Count - 1])) { $kept.RemoveAt($kept.Count - 1) }
        $kept.Add($WebFilterBegin)
        foreach ($d in $Domains) {
            $kept.Add("0.0.0.0 $d")
            if ($d -notlike "www.*") { $kept.Add("0.0.0.0 www.$d") }
        }
        $kept.Add($WebFilterEnd)
    }
    # Write via .NET too (Set-Content can throw "Stream was not readable"); retry briefly in case
    # another process (e.g. Defender scanning the hosts file) holds it open for a moment.
    $enc = New-Object System.Text.ASCIIEncoding
    $hostErr = $null
    for ($i = 0; $i -lt 3; $i++) {
        try { [System.IO.File]::WriteAllLines($HostsPath, $kept.ToArray(), $enc); $hostErr = $null; break }
        catch { $hostErr = $_.Exception; Start-Sleep -Milliseconds 300 }
    }
    if ($hostErr) { throw $hostErr }
    try { ipconfig /flushdns | Out-Null } catch { }
}

# Write Chrome/Edge URL allow/block lists, SafeSearch and DNS-over-HTTPS policy from the settings.
function Set-BrowserFilter($Settings) {
    $block = @(); foreach ($b in @($Settings.blocklist)) { $h = ConvertTo-FilterHost $b; if ($h) { $block += $h } }
    $allow = @(); foreach ($a in @($Settings.allowlist)) { $h = ConvertTo-FilterHost $a; if ($h) { $allow += $h } }
    $allowlistOnly = [bool]$Settings.allowlistOnly
    foreach ($root in @($ChromeKey, $EdgeKey)) {
        try {
            if (-not (Test-Path $root)) { New-Item -Path $root -Force | Out-Null }
            $blKey = Join-Path $root "URLBlocklist"
            if (Test-Path $blKey) { Remove-Item -Path $blKey -Recurse -Force -ErrorAction SilentlyContinue }
            New-Item -Path $blKey -Force | Out-Null
            $i = 1
            if ($allowlistOnly) { Set-ItemProperty -Path $blKey -Name "$i" -Value "*" -Type String; $i++ }
            foreach ($d in $block) { Set-ItemProperty -Path $blKey -Name "$i" -Value $d -Type String; $i++ }
            $alKey = Join-Path $root "URLAllowlist"
            if (Test-Path $alKey) { Remove-Item -Path $alKey -Recurse -Force -ErrorAction SilentlyContinue }
            if ($allow.Count -gt 0) {
                New-Item -Path $alKey -Force | Out-Null
                $j = 1; foreach ($d in $allow) { Set-ItemProperty -Path $alKey -Name "$j" -Value $d -Type String; $j++ }
            }
            if ([bool]$Settings.enforceSafeSearch) {
                Set-ItemProperty -Path $root -Name "ForceGoogleSafeSearch" -Value 1 -Type DWord
                Set-ItemProperty -Path $root -Name "ForceYouTubeRestrict" -Value 2 -Type DWord
            } else {
                Remove-ItemProperty -Path $root -Name "ForceGoogleSafeSearch" -ErrorAction SilentlyContinue
                Remove-ItemProperty -Path $root -Name "ForceYouTubeRestrict" -ErrorAction SilentlyContinue
            }
            if ([bool]$Settings.disableDoh) { Set-ItemProperty -Path $root -Name "DnsOverHttpsMode" -Value "off" -Type String }
            else { Remove-ItemProperty -Path $root -Name "DnsOverHttpsMode" -ErrorAction SilentlyContinue }
        } catch { }
    }
}

function Remove-BrowserFilter {
    foreach ($root in @($ChromeKey, $EdgeKey)) {
        foreach ($sub in @("URLBlocklist", "URLAllowlist")) {
            $k = Join-Path $root $sub
            if (Test-Path $k) { Remove-Item -Path $k -Recurse -Force -ErrorAction SilentlyContinue }
        }
        foreach ($val in @("ForceGoogleSafeSearch", "ForceYouTubeRestrict", "DnsOverHttpsMode")) {
            Remove-ItemProperty -Path $root -Name $val -ErrorAction SilentlyContinue
        }
    }
}

# Pin every active physical adapter to the filtering resolver (reversible with Reset-FilterDns).
function Set-FilterDns([string[]]$Servers) {
    if (-not (Get-Command Set-DnsClientServerAddress -ErrorAction SilentlyContinue)) { return }
    try {
        foreach ($a in @(Get-NetAdapter -Physical -ErrorAction Stop | Where-Object { $_.Status -eq "Up" })) {
            try { Set-DnsClientServerAddress -InterfaceIndex $a.ifIndex -ServerAddresses $Servers -ErrorAction Stop } catch { }
        }
    } catch { }
}

function Reset-FilterDns {
    if (-not (Get-Command Set-DnsClientServerAddress -ErrorAction SilentlyContinue)) { return }
    try {
        foreach ($a in @(Get-NetAdapter -Physical -ErrorAction Stop)) {
            try { Set-DnsClientServerAddress -InterfaceIndex $a.ifIndex -ResetServerAddresses -ErrorAction Stop } catch { }
        }
    } catch { }
}

# Turn on Microsoft Defender network protection + SmartScreen (blocks malicious/phishing sites).
function Set-WebSecurity {
    try { Set-MpPreference -EnableNetworkProtection Enabled -ErrorAction Stop } catch { }
    try {
        $sys = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\System"
        if (-not (Test-Path $sys)) { New-Item -Path $sys -Force | Out-Null }
        Set-ItemProperty -Path $sys -Name "EnableSmartScreen" -Value 1 -Type DWord
    } catch { }
    try {
        if (-not (Test-Path $EdgeKey)) { New-Item -Path $EdgeKey -Force | Out-Null }
        Set-ItemProperty -Path $EdgeKey -Name "SmartScreenEnabled" -Value 1 -Type DWord
    } catch { }
}

# Apply web filtering from the policy settings and the category-list manifest (category -> sha256).
# Builds the hosts block (category lists + blocklist, minus allowlist), browser policies, DNS and
# Defender network protection. Returns the standard @{ type; ok; message; state } result.
function Set-WebFiltering($Settings, $Lists, $State, [string]$Authorization) {
    $errors = @()
    $hashByCat = @{}
    foreach ($l in @($Lists)) { if ($l -and $l.category) { $hashByCat[[string]$l.category] = [string]$l.sha256 } }

    $allowSet = @{}
    foreach ($a in @($Settings.allowlist)) { $h = ConvertTo-FilterHost $a; if ($h) { $allowSet[$h] = $true } }

    $blockSet = @{}
    foreach ($cat in @($Settings.categories)) {
        $c = [string]$cat
        if (-not $c) { continue }
        $file = Get-FilterListFile $c $hashByCat[$c] $Authorization
        if (-not $file) { $errors += ("list {0} unavailable" -f $c); continue }
        foreach ($line in @(Get-Content -Path $file -Encoding UTF8)) {
            $h = ConvertTo-FilterHost $line
            if ($h -and -not $allowSet.ContainsKey($h)) { $blockSet[$h] = $true }
        }
    }
    foreach ($b in @($Settings.blocklist)) {
        $h = ConvertTo-FilterHost $b
        if ($h -and -not $allowSet.ContainsKey($h)) { $blockSet[$h] = $true }
    }
    $domains = @($blockSet.Keys)

    try { Set-HostsFilter $domains } catch { $errors += ("hosts: " + $_.Exception.Message) }
    try { Set-BrowserFilter $Settings } catch { $errors += ("browser: " + $_.Exception.Message) }
    if ([bool]$Settings.lockDns) {
        if ([bool]$Settings.blockAdult) { Set-FilterDns $DnsFamily }
        elseif ([bool]$Settings.securityFiltering) { Set-FilterDns $DnsSecurity }
    }
    if ([bool]$Settings.securityFiltering) { Set-WebSecurity }

    $State.webFiltering = [pscustomobject]@{ applied = $true; categories = @($Settings.categories); domains = $domains.Count }
    $resultState = @{ domains = $domains.Count; categories = @($Settings.categories).Count; allowlistOnly = [bool]$Settings.allowlistOnly }
    if ($errors.Count -gt 0) {
        return @{ type = "web-filtering"; ok = $false; message = ("Applied with issues: " + ($errors -join "; ")); state = $resultState }
    }
    $msg = "Web filtering applied: {0} blocked domain(s), {1} categor(ies)" -f $domains.Count, @($Settings.categories).Count
    return @{ type = "web-filtering"; ok = $true; message = $msg; state = $resultState }
}

# Undo web filtering: remove the hosts block and browser policies, restore DNS. Leaves Defender
# network protection in place (never disables a security feature automatically).
function Remove-WebFiltering($State) {
    $errors = @()
    try { Set-HostsFilter @() } catch { $errors += $_.Exception.Message }
    try { Remove-BrowserFilter } catch { $errors += $_.Exception.Message }
    try { Reset-FilterDns } catch { $errors += $_.Exception.Message }
    $State.webFiltering = $null
    $ok = ($errors.Count -eq 0)
    $msg = if ($ok) { "Web filtering removed" } else { "Web filtering removed with issues: " + ($errors -join "; ") }
    return @{ type = "web-filtering"; ok = $ok; message = $msg; state = @{} }
}

# Collect "blocked site attempt" events for web filtering: domains that resolved to 0.0.0.0 (our
# hosts sinkhole and Cloudflare-for-Families' block answer are both 0.0.0.0). Reads the Windows
# DNS-Client operational log (enabling it if needed), from a saved bookmark, and returns deduped
# @{ domain; count; lastSeen } to report at check-in. Best-effort: only blocked (0.0.0.0) answers are
# read - never full browsing - and cached repeat lookups may not re-log.
function Get-WebBlockEvents($State) {
    $logName = "Microsoft-Windows-DNS-Client/Operational"
    try {
        $log = Get-WinEvent -ListLog $logName -ErrorAction Stop
        if (-not $log.IsEnabled) { $log.IsEnabled = $true; $log.SaveChanges() }
    } catch { return @() }

    $since = $null
    if ($State.webBlock -and $State.webBlock.lastRead) { try { $since = [datetime]$State.webBlock.lastRead } catch { } }
    if (-not $since) { $since = (Get-Date).AddMinutes(-60) }

    $events = @()
    try {
        $events = @(Get-WinEvent -FilterHashtable @{ LogName = $logName; Id = 3008; StartTime = $since } -MaxEvents 2000 -ErrorAction Stop)
    } catch { }

    $counts = @{}
    $lastSeen = @{}
    foreach ($e in $events) {
        # QueryName is the first property; scan all properties for a 0.0.0.0 answer (layout-independent)
        $answer = (@($e.Properties) | ForEach-Object { [string]$_.Value }) -join ";"
        if ($answer -notmatch '0\.0\.0\.0') { continue }
        $d = ([string]$e.Properties[0].Value).TrimEnd('.').ToLower()
        if (-not $d -or $d -notmatch '^[a-z0-9.-]+\.[a-z]{2,}$') { continue }
        if (-not $counts.ContainsKey($d)) { $counts[$d] = 0; $lastSeen[$d] = $e.TimeCreated }
        $counts[$d]++
        if ($e.TimeCreated -gt $lastSeen[$d]) { $lastSeen[$d] = $e.TimeCreated }
    }

    $out = @()
    foreach ($d in (@($counts.Keys) | Select-Object -First 100)) {
        $out += @{ domain = $d; count = $counts[$d]; lastSeen = $lastSeen[$d].ToUniversalTime().ToString("o") }
    }
    $State.webBlock = [pscustomobject]@{ lastRead = (Get-Date).ToUniversalTime().ToString("o") }
    return $out
}

# Apply the effective desired state. USB blocking and web filtering are reverted when removed; the
# protective policies (firewall, Defender, BitLocker) are only ever forced on and never torn down.
# Returns the policy results and any BitLocker volumes to escrow (handled separately so keys stay
# out of the results).
function Invoke-Policies($Policies, $State, $WebFilteringLists, [string]$Authorization) {
    $desired = @{}
    foreach ($p in @($Policies)) { if ($p -and $p.type) { $desired[[string]$p.type] = $p } }
    $managed = @{}
    foreach ($t in @($State.managedPolicies)) { if ($t) { $managed[[string]$t] = $true } }

    $results = @()
    $bitlocker = @()
    $nowManaged = @()

    # usb-storage-block (revertable): present => block; removed => revert once (only if we applied it)
    if ($desired.ContainsKey("usb-storage-block")) {
        $r = Set-UsbStorageBlock $true
        $results += $r
        if ($r.ok) { $nowManaged += "usb-storage-block" }
    } elseif ($managed.ContainsKey("usb-storage-block")) {
        $results += (Set-UsbStorageBlock $false)
    }

    # firewall-on (protective): force on while present, otherwise leave the firewall as it is
    if ($desired.ContainsKey("firewall-on")) {
        $results += (Set-FirewallOn)
    }

    # defender-on (protective)
    if ($desired.ContainsKey("defender-on")) {
        $results += (Set-DefenderOn)
    }

    # bitlocker (protective): encrypt and escrow the recovery key while present
    if ($desired.ContainsKey("bitlocker")) {
        $settings = $desired["bitlocker"].settings
        $includeData = $false
        if ($settings -and ($settings.PSObject.Properties.Name -contains "includeDataDrives")) {
            $includeData = [bool]$settings.includeDataDrives
        }
        $bl = Set-BitLocker $includeData
        $results += $bl.result
        $bitlocker = @($bl.volumes)
    }

    # web-filtering (revertable): apply while present; remove once when withdrawn
    if ($desired.ContainsKey("web-filtering")) {
        $wf = Set-WebFiltering $desired["web-filtering"].settings $WebFilteringLists $State $Authorization
        $results += $wf
        if ($wf.ok) { $nowManaged += "web-filtering" }
    } elseif ($managed.ContainsKey("web-filtering")) {
        $results += (Remove-WebFiltering $State)
    }

    $State.managedPolicies = @($nowManaged)
    foreach ($result in $results) { Write-Log ("  policy {0}: {1}" -f $result.type, $result.message) }
    return @{ results = $results; bitlocker = $bitlocker }
}

# Replace this script with the version the server ships, after verifying its SHA-256. The server
# only ever serves its own official script, so this updates the agent - it can't run other code.
function Update-AgentScript($Update, [string]$Authorization) {
    if (-not $Update -or -not $Update.version) { return }
    if ([string]$Update.version -eq $AgentVersion) { return }
    Write-Log "Agent update offered: $AgentVersion -> $($Update.version)"
    $temp = Join-Path $env:TEMP ("IdaraOS-Agent-{0}.ps1" -f ([guid]::NewGuid().ToString("N")))
    try {
        $uri = "{0}/api/updater/v1/agent-script" -f (Get-ServerUrl)
        $headers = @{ "User-Agent" = "IdaraOS-Agent/$AgentVersion"; "Authorization" = $Authorization }
        $ProgressPreference = "SilentlyContinue"
        Invoke-WebRequest -Uri $uri -Headers $headers -OutFile $temp -UseBasicParsing -TimeoutSec 120
        $hash = (Get-FileHash -Path $temp -Algorithm SHA256).Hash.ToLower()
        $expected = ([string]$Update.sha256).ToLower()
        if ($hash -ne $expected) {
            Write-Log "Agent update rejected: SHA-256 mismatch (expected $expected, got $hash)" "ERROR"
            return
        }
        $content = Get-Content -Path $temp -Raw -Encoding UTF8
        if ($content -notmatch '\$AgentVersion\s*=') {
            Write-Log "Agent update rejected: the downloaded file isn't the IdaraOS Agent" "ERROR"
            return
        }
        Copy-Item -Path $temp -Destination $PSCommandPath -Force
        try { Set-ItemProperty -Path "HKLM:\SOFTWARE\IdaraOS\Agent" -Name "Version" -Value ([string]$Update.version) -ErrorAction SilentlyContinue } catch { }
        Write-Log "Updated agent to $($Update.version) - it takes effect at the next run"
    } catch {
        Write-Log "Agent self-update failed: $($_.Exception.Message)" "ERROR"
    } finally {
        Remove-Item -Path $temp -Force -ErrorAction SilentlyContinue
    }
}

# ============================================================================
# MAIN
# ============================================================================

if ($Pair) {
    if (-not (Start-Pairing)) { exit 1 }
    exit 0
}

$state = Get-State
try {
    $authorization = Get-DeviceAuthorization
    if (-not $authorization) {
        # Linking needs someone at the device - nothing to do until then
        if ($state.lastError -ne "not_linked") {
            Write-Log "This device isn't linked yet. Run IdaraOS-Agent.ps1 -Pair from an admin console." "WARN"
            $state.lastError = "not_linked"
            Write-Json $StatePath $state
        }
        exit 0
    }

    # The task fires every few minutes; respect the server's check-in interval
    if ($state.lastCheckIn) {
        $minutesSince = ((Get-Date).ToUniversalTime() - ([datetime]$state.lastCheckIn).ToUniversalTime()).TotalMinutes
        if ($minutesSince -lt ([int]$state.checkInMinutes - 1)) { exit 0 }
    }

    Send-PendingReports $authorization

    $winget = $null
    try { $winget = Find-Winget } catch { $state.lastError = $_.Exception.Message }

    $body = Get-DeviceInfo $winget
    $body["lastError"] = $state.lastError
    # Report what we applied for each policy last cycle (the server records it per device)
    $body["policyResults"] = @($state.policyResults)
    # BitLocker recovery keys collected last cycle: kept DPAPI-protected on disk, sent over HTTPS here
    # (the server encrypts them at rest). Re-sent each cycle so status/percentage stay current.
    $body["bitlocker"] = @()
    foreach ($bl in @($state.bitlocker)) {
        if (-not $bl -or -not $bl.recoveryKeyProtected) { continue }
        $key = $null
        try { $key = Unprotect-Text ([string]$bl.recoveryKeyProtected) } catch { }
        if (-not $key) { continue }
        $body["bitlocker"] += @{
            volume = [string]$bl.volume
            recoveryKeyId = [string]$bl.recoveryKeyId
            recoveryKey = $key
            encryptionMethod = [string]$bl.encryptionMethod
            protectionOn = [bool]$bl.protectionOn
            encryptionPercentage = [int]$bl.encryptionPercentage
        }
    }
    # Managed admin password rotated last cycle: DPAPI-protected on disk, sent over HTTPS here so the
    # server escrows it (encrypted at rest). Reported once, after an actual rotation, then cleared.
    $reportedAdmin = $false
    if ($state.adminCredential) {
        $ac = $state.adminCredential
        $adminReport = @{ account = [string]$ac.account; status = [string]$ac.status }
        if ([string]$ac.status -eq "ok" -and $ac.passwordProtected) {
            $pw = $null
            try { $pw = Unprotect-Text ([string]$ac.passwordProtected) } catch { }
            if ($pw) {
                $adminReport["password"] = $pw
                $adminReport["rotatedAt"] = [string]$ac.rotatedAt
                $body["adminCredential"] = $adminReport
                $reportedAdmin = $true
            }
        } else {
            if ($ac.error) { $adminReport["error"] = [string]$ac.error }
            $body["adminCredential"] = $adminReport
            $reportedAdmin = $true
        }
    }
    # Website block events: domains web filtering blocked (resolved to 0.0.0.0), when filtering is on
    if ($state.webFiltering) {
        try {
            $blocked = Get-WebBlockEvents $state
            if (@($blocked).Count -gt 0) { $body["blockedDomains"] = @($blocked) }
        } catch { }
    }

    try {
        $response = Invoke-IdaraOS -Path "/api/updater/v1/check-in" -Body $body -Authorization $authorization
    } catch {
        if ((Get-HttpStatus $_) -eq 401) {
            # Device revoked or deleted in IdaraOS - it has to be linked again by someone at the device
            Remove-Item $DevicePath -Force -ErrorAction SilentlyContinue
            Write-Log "Check-in rejected (401) - this device must be linked again (-Pair)" "WARN"
        }
        throw
    }

    $state.lastCheckIn = (Get-Date).ToUniversalTime().ToString("o")
    if ($response.checkInMinutes) { $state.checkInMinutes = [int]$response.checkInMinutes }
    $state.lastError = $null
    # The admin credential report was accepted with the check-in; don't send it again
    if ($reportedAdmin) { $state.adminCredential = $null }
    Write-Json $StatePath $state

    # Installs first: an approved app the member is waiting for shouldn't wait behind a long update run
    foreach ($job in @($response.jobs)) {
        if (-not $job) { continue }
        if ($job.type -eq "action") { Invoke-ActionJob $job $authorization }
        else { Invoke-InstallJob $job $authorization }
    }
    if ($response.run) {
        Invoke-Run $response.run $authorization
    }

    # Policies: apply the effective desired state idempotently, remember the results for next check-in
    $policyOutput = Invoke-Policies $response.policies $state $response.webFilteringLists $authorization
    $state.policyResults = @($policyOutput.results)

    # Internet quarantine: block all outbound except IdaraOS when the server asks; lift when it clears.
    # Re-applied each cycle while active so rotating/CDN server IPs stay allowed.
    try {
        if ([bool]$response.quarantine) {
            $q = Set-Quarantine
            $state.quarantine = $true
            Write-Log ("  quarantine: {0}" -f $q.message)
        } elseif ([bool]$state.quarantine) {
            $q = Remove-Quarantine
            $state.quarantine = $false
            Write-Log ("  quarantine: {0}" -f $q.message)
        }
    } catch { Write-Log ("  quarantine error: " + $_.Exception.Message) "ERROR" }
    # Keep collected BitLocker keys DPAPI-protected on disk (SYSTEM/Admin-only folder); send next cycle
    $state.bitlocker = @()
    foreach ($vol in @($policyOutput.bitlocker)) {
        if (-not $vol -or -not $vol.recoveryKey) { continue }
        $protected = $null
        try { $protected = Protect-Text ([string]$vol.recoveryKey) } catch { }
        if (-not $protected) { continue }
        $state.bitlocker += [pscustomobject]@{
            volume = [string]$vol.volume
            recoveryKeyId = [string]$vol.recoveryKeyId
            recoveryKeyProtected = $protected
            encryptionMethod = [string]$vol.encryptionMethod
            protectionOn = [bool]$vol.protectionOn
            encryptionPercentage = [int]$vol.encryptionPercentage
        }
    }

    # Managed admin password: rotate the configured local admin account when the server asks (a grant
    # ended, or first adoption). Keep the result DPAPI-protected to report at the next check-in.
    $adminSignal = $response.adminCredential
    if ($adminSignal -and $adminSignal.manage -and $adminSignal.rotate) {
        $acct = [string]$adminSignal.account
        if (-not $acct) { $acct = "StellarAdmin" }
        $rot = Set-ManagedAdminPassword $acct
        Write-Log ("  admin credential ({0}): {1}" -f $acct, $rot.status)
        if ($rot.status -eq "ok") {
            $protected = $null
            try { $protected = Protect-Text ([string]$rot.password) } catch { }
            if ($protected) {
                $state.adminCredential = [pscustomobject]@{
                    account = [string]$rot.account
                    status = "ok"
                    passwordProtected = $protected
                    rotatedAt = [string]$rot.rotatedAt
                    error = $null
                }
            }
        } else {
            $state.adminCredential = [pscustomobject]@{
                account = [string]$rot.account
                status = [string]$rot.status
                passwordProtected = $null
                rotatedAt = $null
                error = [string]$rot.error
            }
        }
    }
    Write-Json $StatePath $state

    # Agent self-update: only when the server offered a newer version (admin-triggered or auto-update)
    if ($response.agentUpdate) {
        Update-AgentScript $response.agentUpdate $authorization
    }
} catch {
    $state.lastError = "$($_.Exception.Message)"
    Write-Json $StatePath $state
    Write-Log $state.lastError "ERROR"
    exit 1
}
