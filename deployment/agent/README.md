# IdaraOS Agent

The IdaraOS Agent puts approved apps on Windows laptops and keeps them updated, with no Intune and no Entra join needed. It runs as SYSTEM, so users don't need admin rights.

Each laptop is linked to the member who uses it. They sign in with their own IdaraOS account and enter a code shown by the agent.

| What | How |
|---|---|
| Approved installs | A member requests an app in **My Admin Access**. Once it's approved, the agent runs `winget install --scope machine` at its next check-in, and the result shows on the request. |
| Updates | The schedule and **Run now** in **Security → Software Updates** trigger `winget upgrade` for every catalog app that uses winget updates. There is a log for every run, including failures. |
| Device actions | **Software Updates → Devices → Actions** lets an admin run one of a fixed set of reviewed actions on a device (collect diagnostics, list installed software, check admin accounts, restart a service, clear the Windows Update cache). The result, including any output, shows under **Actions**. |
| Device list | **Software Updates → Devices** shows each device, the member it's linked to and the Windows user signed in. |

The agent runs winget and the specific device actions built into the script, and nothing else. The server never sends a command - only winget package IDs and action keys, each checked against an allowlist before use. The agent doesn't manage local accounts or passwords. IT does that by hand, as described below.

## One-time setup in IdaraOS

1. Go to **Security → Admin Access → Settings → Device management** and choose **IdaraOS Agent**.
2. In **Security → Approved Software**, make sure each app you want to offer has a **winget ID**. Check the IDs on a test device with `winget search <name>`.
3. Make sure each member has an IdaraOS account. A person record (People) is optional, but it lets Assets show who has the laptop.

## Setting up a new laptop

1. **Windows setup:** create the IT admin account first. On Windows 11 Pro, choose **Set up for work or school → Sign-in options → Domain join instead** to make a local account. Give it a unique, strong password and keep it in the IT password manager.
2. Add the member's Windows account as a **Standard User** (**Settings → Accounts → Other users**).
3. Optional but recommended: turn on BitLocker as the IT admin with `manage-bde -on C:`. Then run `manage-bde -protectors -get C:` and save the recovery key in the password manager.
4. Copy this folder to the laptop. Open **PowerShell as administrator** and run:

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Install-IdaraOSAgent.ps1 -ServerUrl "https://idaraos.com"
   ```

5. The script shows a code such as `KFJD-7QWX`. The **member** opens `https://idaraos.com/security/my-elevation/link` on any device (their phone is fine), signs in with **their own** account and enters the code. The installer then says **Linked**.
6. The laptop appears under **Software Updates → Devices** and in the member's **My Admin Access**. If no asset with the same serial number exists, a new one (`AGT-…`) is created in Assets, assigned to the member.

If the code expires after 15 minutes, link again from an admin PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\ProgramData\IdaraOS\Agent\IdaraOS-Agent.ps1" -Pair
```

## Moving a laptop to someone else

1. In IdaraOS, reassign the asset in Assets.
2. On the laptop, delete `C:\ProgramData\IdaraOS\Agent\device.json`, then run the `-Pair` command above. The new member enters the code.

## Removing the agent

Run `Uninstall-IdaraOSAgent.ps1` as admin, then **Revoke** the device in **Software Updates → Devices**.

## Logs on the device

- `C:\ProgramData\IdaraOS\Agent\Logs\agent.log` (only SYSTEM and Administrators can read it)
- Reports that couldn't be sent wait in `C:\ProgramData\IdaraOS\Agent\pending` and are sent at the next check-in.

## Notes

- winget (App Installer) must be installed for the system. It comes with Windows 11; on Windows 10, update **App Installer** from the Microsoft Store first.
- winget running as SYSTEM also needs the **Visual C++ Redistributable (x64)**. The installer downloads it from Microsoft and installs it if it's missing. Without it, every package fails with `0xC0000135` ("winget couldn't start because the Visual C++ runtime is missing").
- To update the agent on a laptop, run the installer again. A linked laptop stays linked.
- **Device actions** need agent 1.1.0 or later. To add a new action, implement its key in `IdaraOS-Agent.ps1` (and, for a service restart, add the service to the `$RestartableServices` map and to `RESTARTABLE_SERVICES` in `lib/security/device-actions.ts`), then ship a new agent version. There is no free-text command - the agent only runs the action keys it knows, so an older agent reports "doesn't support" for an action it hasn't shipped yet.
- Installs use machine scope. An app whose winget package only offers a per-user installer (for example `CoreyButler.NVMforWindows`) can't be installed by the agent. The request fails straight away with "This package has no machine-wide installer". Choose a different package ID (for Node.js, `OpenJS.NodeJS.LTS`) or install it by hand. Check a package with `winget show --id <id>` and look at the installer's **Scope**.
- A wrong package ID also fails the request straight away. Other failures (app in use, download errors) are retried at later check-ins until the request's deadline.
- Updates can't see per-user installs either, so a per-user app always shows as "not installed" in update runs.
- **Visual Studio:** without workloads, it installs only the core editor, and adding workloads later needs admin. In **Approved Software**, edit the Visual Studio app and choose its **workloads** (for example ASP.NET and web development). The agent installs them with Visual Studio, plus their recommended components, and never restarts the laptop on its own. Workloads need agent 1.0.2 or later; older agents install the core editor only. Expect 30–60+ minutes for the install.
- If the Intune **IdaraOS Updater** is also installed, remove it so updates don't run twice.
- The agent and `deployment/intune/idaraos-updater/IdaraOS-Updater.ps1` share the update-run code. A fix to one usually belongs in the other too.
