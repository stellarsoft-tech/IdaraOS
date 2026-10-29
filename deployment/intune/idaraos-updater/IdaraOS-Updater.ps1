<#
.SYNOPSIS
    IdaraOS Updater - keeps approved apps up to date with winget, running as SYSTEM.

.DESCRIPTION
    Runs from the "\IdaraOS\IdaraOS Updater" scheduled task (SYSTEM) every few minutes.
    1. Enrolls the device once with the organization's enrollment token.
    2. Sends any run reports that failed to upload earlier.
    3. Checks in. When IdaraOS answers with a run (schedule due, or "Run now"), runs
       `winget upgrade` for each package in the run and reports every result - including
       failures and packages that aren't installed - with the tail of the winget output.

    Only package IDs come from the server, and each is validated before use. The updater
    never installs new apps (Intune does that) and never runs anything except winget.

    Windows PowerShell 5.1 compatible.
#>

$ErrorActionPreference = "Stop"
$UpdaterVersion = "1.0.0"

$BaseDir = Join-Path $env:ProgramData "IdaraOS\Updater"
$ConfigPath = Join-Path $BaseDir "config.json"
$DevicePath = Join-Path $BaseDir "device.json"
$StatePath = Join-Path $BaseDir "state.json"
$PendingDir = Join-Path $BaseDir "pending"
$LogDir = Join-Path $BaseDir "Logs"
$LogPath = Join-Path $LogDir "updater.log"

# Same rule as the server (lib/security/software.ts WINGET_ID_PATTERN)
$WingetIdPattern = '^[A-Za-z0-9][A-Za-z0-9.+_-]{0,127}$'
$MaxLogChars = 60000

# winget exit codes (APPINSTALLER_CLI_ERROR_*), as signed 32-bit values
$ExitNoPackageFound      = -1978335212  # 0x8A150014
$ExitUpdateNotApplicable = -1978335189  # 0x8A15002B
$ExitPackageInUse        = -1978334975  # 0x8A150101
$ExitFileInUse           = -1978334973  # 0x8A150103
$ExitRebootToFinish      = -1978334967  # 0x8A150109
$ExitRebootForInstall    = -1978334966  # 0x8A15010A
$ExitRebootInitiated     = -1978334965  # 0x8A15010B

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
    return $state
}

function Invoke-IdaraOS {
    param([string]$Method = "POST", [string]$Path, $Body, [string]$Authorization)
    $config = Read-Json $ConfigPath
    $uri = "{0}{1}" -f $config.serverUrl.TrimEnd("/"), $Path
    $headers = @{ "User-Agent" = "IdaraOS-Updater/$UpdaterVersion" }
    if ($Authorization) { $headers["Authorization"] = $Authorization }
    $json = $Body | ConvertTo-Json -Depth 10 -Compress
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -ContentType "application/json; charset=utf-8" `
        -Body ([System.Text.Encoding]::UTF8.GetBytes($json)) -UseBasicParsing -TimeoutSec 60
}

function Get-HttpStatus($ErrorRecord) {
    try { return [int]$ErrorRecord.Exception.Response.StatusCode } catch { return 0 }
}

# ============================================================================
# DEVICE INFO
# ============================================================================

function Get-EntraDeviceId {
    $line = (& dsregcmd.exe /status) | Where-Object { $_ -match '^\s*DeviceId\s*:' } | Select-Object -First 1
    if ($line -and $line -match ':\s*([0-9a-fA-F-]{36})') { return $Matches[1].ToLower() }
    throw "This device isn't joined to Entra ID (dsregcmd shows no DeviceId)"
}

function Get-IntuneDeviceId {
    try {
        $value = (Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Provisioning\OMADM\MDMDeviceID" -Name DeviceClientId -ErrorAction Stop).DeviceClientId
        if ($value -match '^[0-9a-fA-F-]{36}$') { return $value.ToLower() }
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
        serialNumber   = (Get-CimInstance Win32_BIOS).SerialNumber
        osVersion      = "{0} {1}" -f $os.Caption, $os.Version
        updaterVersion = $UpdaterVersion
        wingetVersion  = $wingetVersion
    }
}

# ============================================================================
# ENROLLMENT
# ============================================================================

function Get-DeviceAuthorization {
    $device = Read-Json $DevicePath
    if ($device) {
        return "Bearer {0}.{1}" -f $device.deviceId, (Unprotect-Text $device.secret)
    }

    $config = Read-Json $ConfigPath
    if (-not $config.enrollmentToken) { throw "No enrollment token - reinstall the IdaraOS Updater package" }

    $body = Get-DeviceInfo $null
    $body["enrollmentToken"] = Unprotect-Text $config.enrollmentToken
    $body["entraDeviceId"] = Get-EntraDeviceId
    $body["intuneDeviceId"] = Get-IntuneDeviceId

    Write-Log "Enrolling device $($body.hostname) ($($body.entraDeviceId))"
    $result = Invoke-IdaraOS -Path "/api/updater/v1/enroll" -Body $body
    Write-Json $DevicePath ([pscustomobject]@{ deviceId = $result.deviceId; secret = (Protect-Text $result.deviceSecret) })
    Write-Log "Enrolled as $($result.deviceId)"
    return "Bearer {0}.{1}" -f $result.deviceId, $result.deviceSecret
}

# ============================================================================
# WINGET
# ============================================================================

function Invoke-Winget([string]$Winget, [string[]]$Arguments) {
    # Windows PowerShell turns native stderr into errors under "Stop" - collect it as text instead
    $ErrorActionPreference = "Continue"
    $output = & $Winget @Arguments 2>&1 | ForEach-Object { "$_" }
    # Drop spinner / progress-bar noise (block characters U+2580-U+259F)
    $clean = $output | Where-Object { $_ -and ($_ -notmatch '^\s*[-\\|/]\s*$') -and ($_ -notmatch '[▀-▟]') }
    return @{ ExitCode = $LASTEXITCODE; Output = ($clean -join "`n") }
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

    if ($id -notmatch $WingetIdPattern -or $id.Contains("..")) {
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

    $text = $log.ToString()
    if ($text.Length -gt $MaxLogChars) { $text = $text.Substring($text.Length - $MaxLogChars) }
    $report = @{ results = $results; error = $runError; log = $text }

    try {
        Invoke-IdaraOS -Path "/api/updater/v1/runs/$($Run.id)" -Body $report -Authorization $Authorization | Out-Null
        Write-Log "Reported run $($Run.id)"
    } catch {
        # Keep it and send it before the next check-in
        if (-not (Test-Path $PendingDir)) { New-Item -ItemType Directory -Path $PendingDir -Force | Out-Null }
        Write-Json (Join-Path $PendingDir "$($Run.id).json") $report
        Write-Log "Couldn't report run $($Run.id), saved for later: $($_.Exception.Message)" "WARN"
    }
}

function Send-PendingReports([string]$Authorization) {
    if (-not (Test-Path $PendingDir)) { return }
    foreach ($file in Get-ChildItem -Path $PendingDir -Filter "*.json") {
        try {
            $report = Read-Json $file.FullName
            Invoke-IdaraOS -Path "/api/updater/v1/runs/$($file.BaseName)" -Body $report -Authorization $Authorization | Out-Null
            Remove-Item $file.FullName -Force
            Write-Log "Sent saved report for run $($file.BaseName)"
        } catch {
            $status = Get-HttpStatus $_
            # 404/400: the server will never take it - drop it rather than retry forever
            if ($status -eq 404 -or $status -eq 400) { Remove-Item $file.FullName -Force }
            else { throw }
        }
    }
}

# ============================================================================
# MAIN
# ============================================================================

$state = Get-State
try {
    # The task fires every few minutes; respect the server's check-in interval
    if ($state.lastCheckIn) {
        $minutesSince = ((Get-Date).ToUniversalTime() - ([datetime]$state.lastCheckIn).ToUniversalTime()).TotalMinutes
        if ($minutesSince -lt ([int]$state.checkInMinutes - 1)) { exit 0 }
    }

    $authorization = Get-DeviceAuthorization
    Send-PendingReports $authorization

    $winget = $null
    try { $winget = Find-Winget } catch { $state.lastError = $_.Exception.Message }

    $body = Get-DeviceInfo $winget
    $body["lastError"] = $state.lastError
    try {
        $response = Invoke-IdaraOS -Path "/api/updater/v1/check-in" -Body $body -Authorization $authorization
    } catch {
        if ((Get-HttpStatus $_) -eq 401) {
            # Secret no longer valid (device deleted in IdaraOS) - enroll again next time
            Remove-Item $DevicePath -Force -ErrorAction SilentlyContinue
            Write-Log "Check-in rejected (401) - will re-enroll" "WARN"
        }
        throw
    }

    $state.lastCheckIn = (Get-Date).ToUniversalTime().ToString("o")
    if ($response.checkInMinutes) { $state.checkInMinutes = [int]$response.checkInMinutes }
    $state.lastError = $null
    Write-Json $StatePath $state

    if ($response.run) {
        Invoke-Run $response.run $authorization
    }
} catch {
    $state.lastError = "$($_.Exception.Message)"
    Write-Json $StatePath $state
    Write-Log $state.lastError "ERROR"
    exit 1
}
