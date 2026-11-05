# IdaraOS Agent

The IdaraOS Agent puts approved apps on Windows laptops and keeps them updated, with no Intune and no Entra join needed. It runs as SYSTEM, so users don't need admin rights.

Each laptop is linked to the member who uses it. They sign in with their own IdaraOS account and enter a code shown by the agent.

| What | How |
|---|---|
| Approved installs | A member requests an app in **My Admin Access**. Once it's approved, the agent runs `winget install --scope machine` at its next check-in, and the result shows on the request. |
| Updates | The schedule and **Run now** in **Security → Software Updates** trigger `winget upgrade` for every catalog app that uses winget updates. There is a log for every run, including failures. |
| Device actions | **Software Updates → Devices → Actions** lets an admin run one of a fixed set of reviewed actions on a device (collect diagnostics, list installed software, update all apps, list/update Node.js versions via nvm, check admin accounts, restart a service, clear the Windows Update cache). Because the agent runs as SYSTEM, updates need no admin rights and prompt nobody. Every run, with its status and output, is kept under **Actions** as that device's history. |
| Device policies | **Software Updates → Groups & policies** lets an admin put agent devices and/or members into groups and switch on policies the agent enforces: **Block USB storage**, **Firewall always on**, **Microsoft Defender always on**, and **Encrypt disk (BitLocker) + escrow key**. A member's policies apply to every agent device they're signed in to. The agent applies the effective state at each check-in and reports back what it applied. The protective policies (firewall, Defender, BitLocker) are re-applied every check-in and never torn down when removed - the agent only ever forces them on. |
| BitLocker key escrow | The **BitLocker** policy turns on disk encryption and sends the recovery key to IdaraOS, stored **encrypted at rest**. Reveal a key from **Software Updates → Devices → Actions → BitLocker recovery keys**; every reveal is written to the audit log. |
| Agent updates | **Software Updates → Devices → Update agent** (or **Update all agents**, or the auto-update toggle on the Schedule tab) moves devices to the agent version this IdaraOS server ships. The agent downloads the server's own script, verifies its SHA-256 and replaces itself - nothing to copy to each laptop by hand. |
| Device list | **Software Updates → Devices** shows each device, the member it's linked to and the Windows user signed in. |

The agent runs winget and the specific device actions and policies built into the script, and nothing else. The server never sends a command - only winget package IDs, action keys and policy types, each checked against an allowlist before use. For self-update it fetches the server's own script and verifies its SHA-256; admins can only move a device to the version this server ships, never supply code or a URL. The agent doesn't manage local accounts or passwords. IT does that by hand, as described below.

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
- **Device actions** need agent 1.1.0 or later (the **Update all apps** actions need 1.2.0; the **Node.js (nvm)** actions need 1.3.0). "Update all apps" runs `winget upgrade --all`; the "include unknown versions" variant adds `--include-unknown`, which also tries apps whose installed version winget can't read. To add a new action, implement its key in `IdaraOS-Agent.ps1` (and, for a service restart, add the service to the `$RestartableServices` map and to `RESTARTABLE_SERVICES` in `lib/security/device-actions.ts`), then ship a new agent version. There is no free-text command - the agent only runs the action keys it knows, so an older agent reports "doesn't support" for an action it hasn't shipped yet.
- **Device policies** need agent 1.3.0 or later for groups and 1.4.0 for enforcement (the **Block USB storage** policy needs 1.4.0; full coverage of modern USB drives needs 1.4.1; firewall, Defender and BitLocker need **1.5.0**). A policy is applied at the next check-in. **Block USB storage** is reverted when the device leaves every group that enables it; the protective policies are not (see below). To add a new policy type, add it to `POLICY_TYPES` in `lib/security/device-policies.ts` and enforce its type in `Invoke-Policies` here, then ship a new agent version - no database migration for the policy itself (the policy `type` is plain text).
  - **Block USB storage** disables the USB mass-storage drivers `USBSTOR` **and** `UASPStor` (sets `Start` to `4`, back to `3` to allow) and denies read/write on the Removable Disks class policy. Both drivers matter: modern USB 3.x sticks and external SSDs use UAS (`uaspstor`), which `USBSTOR` alone doesn't cover - 1.4.0 blocked only `USBSTOR`, so a UAS drive still mounted. The block fully takes effect after a **reboot** (the disabled driver then never loads); the access policy denies use without a reboot. It applies to everyone on the device, including the signed-in user, and leaves keyboards, mice and webcams working.
  - **Firewall always on** enables Windows Defender Firewall on the Domain, Private and Public profiles with inbound blocked by default, re-applied every check-in. A firewall someone turns off comes back on within one check-in; the policy never turns the firewall off.
  - **Microsoft Defender always on** keeps the `WinDefend` service running and real-time protection on, re-applied every check-in, and reports whether Windows **Tamper Protection** is enabled. Important: Tamper Protection can only be switched on from Intune/MDM, and *while it is on Windows blocks scripted changes to Defender* - so this policy gives practical protection by re-applying each check-in, **not** Microsoft Tamper Protection, and only reports Tamper Protection's state. The policy never disables antivirus.
  - **Encrypt disk (BitLocker) + escrow key** turns on BitLocker for the OS drive (XTS-AES-256, TPM + a recovery-password protector; optionally fixed data drives) and sends the 48-digit recovery key to IdaraOS, where it is **encrypted at rest** with `ENCRYPTION_KEY` (`lib/encryption.ts`) and stored in `security_device_bitlocker_keys`. The recovery key is kept DPAPI-protected in the agent's state file (SYSTEM/Administrators only) between check-ins, sent over HTTPS, and never written to the policy-result state. Needs a TPM for the OS drive; without one the policy reports it can't enable and does nothing. Reveal a key under **Devices → Actions → BitLocker recovery keys** (audited). The policy never decrypts a disk.
  - **Why the protective policies aren't reverted:** turning off **Block USB storage** restores USB access - that's the point of it. But the agent must never turn a firewall off, disable antivirus, or decrypt a disk on its own, so removing **Firewall / Defender / BitLocker** just stops re-applying them; it leaves the protection in place. A policy carries `revertOnDisable` (`lib/security/device-policies.ts`) saying which behaviour it has.
- **Agent self-update** needs agent 1.4.0 or later. The server serves its own `deployment/agent/IdaraOS-Agent.ps1` at `/api/updater/v1/agent-script`; the agent downloads it, checks the SHA-256 the check-in gave it, and overwrites its own script (the next scheduled run uses the new version). It updates the **agent script** only - changes to the installer or the scheduled task still need the installer re-run. The server must have the `deployment/agent` folder available (or set `AGENT_SCRIPT_PATH`); the released version is the `$AgentVersion` in that file, so deploying a new IdaraOS build publishes a new agent. Hardening: the script isn't Authenticode-signed yet; signing it and pinning the signer would protect against a compromised release endpoint.
- **Node.js (nvm) actions:** "List Node.js versions (nvm)" runs `nvm list`. "Update Node.js (nvm)" finds, for each installed Node line, the newest release in that major version on nodejs.org and runs `nvm install` if nvm doesn't have it (e.g. 22.2.1 → newest 22.x), keeps the active line current with `nvm use`, and records the `nvm list` before and after in the action's output. Both need **NVM for Windows** (Corey Butler) installed **machine-wide** - the installer must have set the `NVM_HOME`/`NVM_SYMLINK` machine environment variables and put nvm on the machine PATH. Because the agent runs as SYSTEM, a per-user nvm install isn't visible to it; in that case the action reports that nvm isn't installed machine-wide and does nothing. (nvm itself has no machine-wide winget package, so it's installed by hand - see the per-user installer note above.)
- Installs use machine scope. An app whose winget package only offers a per-user installer (for example `CoreyButler.NVMforWindows`) can't be installed by the agent. The request fails straight away with "This package has no machine-wide installer". Choose a different package ID (for Node.js, `OpenJS.NodeJS.LTS`) or install it by hand. Check a package with `winget show --id <id>` and look at the installer's **Scope**.
- A wrong package ID also fails the request straight away. Other failures (app in use, download errors) are retried at later check-ins until the request's deadline.
- Updates can't see per-user installs either, so a per-user app always shows as "not installed" in update runs.
- **Visual Studio:** without workloads, it installs only the core editor, and adding workloads later needs admin. In **Approved Software**, edit the Visual Studio app and choose its **workloads** (for example ASP.NET and web development). The agent installs them with Visual Studio, plus their recommended components, and never restarts the laptop on its own. Workloads need agent 1.0.2 or later; older agents install the core editor only. Expect 30–60+ minutes for the install.
- If the Intune **IdaraOS Updater** is also installed, remove it so updates don't run twice.
- The agent and `deployment/intune/idaraos-updater/IdaraOS-Updater.ps1` share the update-run code. A fix to one usually belongs in the other too.
