# Approved apps as Intune Win32 packages (winget)

Each approved app is a small Intune **Windows app (Win32)** that runs `winget install` as **SYSTEM**. Users never need admin rights, and the package always installs the latest version, so you never re-upload it for a new release. Updates afterwards come from the [IdaraOS Updater](../idaraos-updater/README.md).

## Package once

1. Download [IntuneWinAppUtil](https://github.com/microsoft/Microsoft-Win32-Content-Prep-Tool).
2. Package this folder. One `.intunewin` can serve every app, because the app ID is a parameter:

   ```powershell
   IntuneWinAppUtil.exe -c .\deployment\intune\winget-apps -s Install-WingetApp.ps1 -o .\out
   ```

## Add an app in Intune

**Intune admin center → Apps → Windows → Add → Windows app (Win32)**, upload the `.intunewin`, then:

| Setting | Value |
|---|---|
| Install command | `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Install-WingetApp.ps1 -Id <WingetId>` |
| Uninstall command | `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Uninstall-WingetApp.ps1 -Id <WingetId>` |
| Install behavior | **System** |
| Return codes | Keep the defaults (0 success, 3010 soft reboot, 1641 hard reboot) |
| Detection | File rule from the table below, or a copy of `Detect-WingetApp.ps1` with `$PackageId` set |
| Assignment | **Required** → an *assigned* device group named `IdaraOS-Install-<App>` (empty to start) |

Then in **IdaraOS → Security → Approved Software**, edit the app, search for it under *Intune install*, and choose the `IdaraOS-Install-<App>` group. When an approver chooses *Install with Intune*, IdaraOS adds the device to that group and asks Intune to sync.

The install group must not be used for anything else (no Conditional Access, licensing or admin rights), because IdaraOS can add devices to it.

## The approved apps

| App | Winget ID | Install command extras | Detection (file exists) | Notes |
|---|---|---|---|---|
| Microsoft 365 Apps | — | Use Intune's built-in **Microsoft 365 Apps** app type | — | Assign to all devices. Updates itself (set the channel in Intune) |
| Google Chrome | `Google.Chrome` | — | `C:\Program Files\Google\Chrome\Application\chrome.exe` | Or the Chrome Enterprise MSI. Google's updater keeps it current |
| Git | `Git.Git` | — | `C:\Program Files\Git\cmd\git.exe` | |
| Visual Studio 2022 Professional | `Microsoft.VisualStudio.2022.Professional` | `-Override "--quiet --wait --norestart --config C:\ProgramData\IdaraOS\visualstudio.vsconfig"` (see below) | `C:\Program Files\Microsoft Visual Studio\2022\Professional\Common7\IDE\devenv.exe` | Set the Intune install time limit to **120+ min**. Use your licensed edition |
| SQL Server Management Studio | `Microsoft.SQLServerManagementStudio` | — | Check after a test install (path depends on the SSMS version) | Confirm the ID with `winget search SSMS` |
| SQL Server 2022 Developer | `Microsoft.SQLServer.2022.Developer` | Test first - see below | `C:\Program Files\Microsoft SQL Server\MSSQL16.MSSQLSERVER\MSSQL\Binn\sqlservr.exe` | Patches come from Microsoft Update |
| NVM for Windows | `CoreyButler.NVMforWindows` | — | `C:\Program Files\nvm\nvm.exe` (default) | `nvm use` needs admin each time; consider fnm (`Schniz.fnm`) or Volta instead |
| Windows Subsystem for Linux | `Microsoft.WSL` | Install command: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Install-WSL.ps1` | `C:\Program Files\WSL\wsl.exe` | Returns 3010 - let Intune handle the restart |

Always confirm the IDs on a test device with `winget search <name>` - editions and versions change.

### Visual Studio workloads

`visualstudio.vsconfig` lists the workloads to install. Edit it for your team, then make the install command copy it first:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Copy-Item .\visualstudio.vsconfig C:\ProgramData\IdaraOS\ -Force; & .\Install-WingetApp.ps1 -Id Microsoft.VisualStudio.2022.Professional -Override '--quiet --wait --norestart --config C:\ProgramData\IdaraOS\visualstudio.vsconfig'"
```

Adding a workload later needs admin. Publish each extra workload as its own catalog app (a Win32 app that runs the Visual Studio installer's `modify --add <workload> --quiet` as SYSTEM) so it can be requested like any other app.

### SQL Server Developer

The installer runs as SYSTEM, so nobody is a SQL admin unless the install says so. Test on a pilot device whether winget's installer accepts setup parameters through `-Custom`, for example:

```text
-Custom "/ACTION=Install /QUIET /IACCEPTSQLSERVERLICENSETERMS /FEATURES=SQLENGINE /INSTANCENAME=MSSQLSERVER /SQLSYSADMINACCOUNTS=""BUILTIN\Users"""
```

If it doesn't, package the full SQL Server media with a `ConfigurationFile.ini` instead. Granting `BUILTIN\Users` is only reasonable on single-user developer laptops. For most developers, **LocalDB** (Visual Studio's *Data storage and processing* workload) is enough and needs no admin at all.

Turn on **Microsoft product updates** in your Intune update ring so SQL Server gets security updates.

## Logs on the device

`C:\ProgramData\IdaraOS\Logs\winget-install-<Id>.log`, plus Intune's own logs in `C:\ProgramData\Microsoft\IntuneManagementExtension\Logs`.
