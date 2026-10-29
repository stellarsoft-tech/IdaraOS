# IdaraOS Updater

A scheduled task that keeps approved apps up to date by running `winget upgrade` as **SYSTEM**, so updates never ask users for admin rights. It reports every run to IdaraOS, including failures, so each device has a full update log.

## How it works

- Runs every 5 minutes (and at startup) as SYSTEM: `\IdaraOS\IdaraOS Updater`.
- Checks in with IdaraOS as often as **Check-in every (minutes)** says (default 15). The check-in returns a run when:
  - the org schedule is due (**Security → Software Updates → Schedule & enrollment**), or
  - a super admin pressed **Run now** for that device or **Run on all devices**.
- A run upgrades every enabled app in **Approved Software** that has a winget ID and *Update automatically* on. Apps added later are picked up on the next run - nothing to redeploy.
- Every package result (updated / up to date / not installed / failed, versions, exit code) and the tail of the winget output are sent to IdaraOS. If the upload fails, the report is saved and sent before the next check-in. A run the device never reports back on is marked failed after 4 hours.
- Only package IDs come from the server, and each is validated against `^[A-Za-z0-9][A-Za-z0-9.+_-]{0,127}$`. The updater only runs `winget list` and `winget upgrade`; it never installs new apps (Intune does that).

## Before you deploy

1. **IdaraOS → Security → Software Updates → Schedule & enrollment → Create token.** Copy the token; it's shown once.
2. Make sure devices are in **Assets** (Assets → Settings → Sync from Intune). Enrollment is refused for devices IdaraOS doesn't know, and when the serial number doesn't match.

## Package and deploy

```powershell
IntuneWinAppUtil.exe -c .\deployment\intune\idaraos-updater -s Install-IdaraOSUpdater.ps1 -o .\out
```

**Intune admin center → Apps → Windows → Add → Windows app (Win32)**:

| Setting | Value |
|---|---|
| Install command | `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Install-IdaraOSUpdater.ps1 -ServerUrl "https://app.idaraos.com" -EnrollmentToken "<token>"` |
| Uninstall command | `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Uninstall-IdaraOSUpdater.ps1` |
| Install behavior | **System** |
| Detection | Custom script: `Detect-IdaraOSUpdater.ps1` |
| Assignment | **Required** → all Autopilot devices (start with a pilot group) |

The token is visible to Intune admins in the install command. It only lets a device that's already in Assets enroll; replacing it in IdaraOS doesn't affect enrolled devices.

## Shipping a new updater version

Change `$UpdaterVersion` in `IdaraOS-Updater.ps1`, `$Version` in `Install-IdaraOSUpdater.ps1` and `$RequiredVersion` in `Detect-IdaraOSUpdater.ps1`, repackage, and replace the file on the same Intune app. Devices keep their enrollment.

## On the device

| Path | What |
|---|---|
| `C:\ProgramData\IdaraOS\Updater\Logs\updater.log` | Local log (rotates at 5 MB) |
| `C:\ProgramData\IdaraOS\Updater\device.json` | Device ID + secret (DPAPI, machine scope) |
| `C:\ProgramData\IdaraOS\Updater\pending\` | Run reports waiting to upload |

The folder is readable only by SYSTEM and Administrators.

## Troubleshooting

| Symptom in IdaraOS | Likely cause |
|---|---|
| Device never appears | Not in Assets yet, serial mismatch, or no token. Check `updater.log` |
| "winget (App Installer) isn't installed for the system" | App Installer missing or not provisioned. Update it from the Microsoft Store for Business / Intune |
| Package "Not installed" | Expected when the app isn't on that device. Install it through Approved Software |
| "The app is open" | The user had the app open; it's updated on a later run |
| Run "didn't report a result" | Device went offline or rebooted mid-run |
