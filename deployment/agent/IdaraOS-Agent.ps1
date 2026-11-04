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
$AgentVersion = "1.4.0"

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
    foreach ($prop in @("managedPolicies", "policyResults")) {
        if (-not ($state.PSObject.Properties.Name -contains $prop)) {
            $state | Add-Member -NotePropertyName $prop -NotePropertyValue @() -Force
        }
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

# USB mass storage: Start = 4 disables the USBSTOR driver (no USB drives mount); 3 is the default.
# Keyboards, mice and other non-storage USB devices are unaffected. Reversible.
function Set-UsbStorageBlock([bool]$Blocked) {
    $path = "HKLM:\SYSTEM\CurrentControlSet\Services\USBSTOR"
    $desired = if ($Blocked) { 4 } else { 3 }
    try {
        $current = $null
        try { $current = (Get-ItemProperty -Path $path -Name Start -ErrorAction Stop).Start } catch { }
        if ($current -ne $desired) {
            Set-ItemProperty -Path $path -Name Start -Value $desired -Type DWord -ErrorAction Stop
        }
        $message = if ($Blocked) { "USB storage blocked" } else { "USB storage allowed" }
        return @{ type = "usb-storage-block"; ok = $true; message = $message; state = @{ blocked = $Blocked } }
    } catch {
        return @{ type = "usb-storage-block"; ok = $false; message = "Error: $($_.Exception.Message)"; state = @{ blocked = $Blocked } }
    }
}

function Invoke-Policies($Policies, $State) {
    $desired = @{}
    foreach ($p in @($Policies)) { if ($p -and $p.type) { $desired[[string]$p.type] = $true } }
    $managed = @{}
    foreach ($t in @($State.managedPolicies)) { if ($t) { $managed[[string]$t] = $true } }

    $results = @()
    $nowManaged = @()

    # usb-storage-block: present => block; no longer present => revert once (only if we applied it)
    if ($desired.ContainsKey("usb-storage-block")) {
        $result = Set-UsbStorageBlock $true
        $results += $result
        if ($result.ok) { $nowManaged += "usb-storage-block" }
    } elseif ($managed.ContainsKey("usb-storage-block")) {
        $results += (Set-UsbStorageBlock $false)
    }

    $State.managedPolicies = @($nowManaged)
    foreach ($result in $results) { Write-Log ("  policy {0}: {1}" -f $result.type, $result.message) }
    return $results
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
    $state.policyResults = @(Invoke-Policies $response.policies $state)
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
