# Web content filtering (IdaraOS Agent)

Web filtering is a device policy enforced by the IdaraOS Agent - no Intune, no cloud filtering
service. It is the `web-filtering` entry in `POLICY_TYPES`
([`lib/security/device-policies.ts`](../../../apps/web/lib/security/device-policies.ts)),
assigned to a device group, delivered at check-in and re-applied every cycle like the other device
policies (firewall, Defender, BitLocker, USB).

## What it does

| Goal | Mechanism (on the device, by the agent) |
|---|---|
| Block categories | Curated per-category domain lists IdaraOS ships are sinkholed to `0.0.0.0` in a marked region of the Windows `hosts` file |
| Allow / block lists | Chrome & Edge `URLBlocklist` / `URLAllowlist` registry policies; an `allowlistOnly` lockdown blocks everything except the allowlist |
| SafeSearch | `ForceGoogleSafeSearch` + `ForceYouTubeRestrict` browser policies |
| Malware / phishing | Microsoft Defender **network protection** + SmartScreen, plus a filtering DNS resolver |
| Anti-bypass | Browser DNS-over-HTTPS forced off; the filtering DNS resolver is pinned and re-applied each check-in |

Resolver presets (Cloudflare for Families): `1.1.1.2` / `1.0.0.2` for security, `1.1.1.3` / `1.0.0.3`
when **block adult content** is on. DNS is only pinned when `lockDns` is on and at least one of
security / adult filtering is selected.

## Settings model

Device-policy settings were boolean-only; web filtering needed lists and multi-selects, so
`PolicySettingDef` grew a `kind` (`"boolean" | "string-list" | "multi-select"`).
`sanitizePolicySettings` validates each kind (domain patterns are normalized by
`normalizeDomainPattern`; categories are checked against the fixed option list), and
`combinePolicies` merges across groups with **strictest-wins**: booleans OR, lists/categories union.
No DB migration was needed - `security_policies.settings` is already `jsonb`.

## Curated category lists

Lists live in `deployment/agent/filter-lists/<category>.txt` (one domain per line; the agent also
blocks the `www.` host). `WEB_FILTERING_CATEGORIES` in `device-policies.ts` is the single source of
truth for the category keys and must match the files on disk.

- Loader: [`lib/security/filter-lists.ts`](../../../apps/web/lib/security/filter-lists.ts) -
  mirrors `agent-release.ts` (candidate paths, mtime cache, per-file SHA-256).
- Serve route: `GET /api/updater/v1/filter-list/<category>` - device-authenticated (bearer token),
  returns the bytes + `X-List-SHA256`. Under the `/api/updater` prefix, which bypasses session auth.
- Distribution: the **check-in response** carries `webFilteringLists: [{ category, sha256 }]` for the
  selected categories. The agent re-downloads a list only when its advertised hash differs from the
  cached file, then rebuilds the hosts region. This mirrors the agent self-update integrity check.

## Agent

`Set-WebFiltering` / `Remove-WebFiltering` in
[`deployment/agent/IdaraOS-Agent.ps1`](../../../deployment/agent/IdaraOS-Agent.ps1) (agent **1.7.0**).
It is a **revertable** policy: removing it from every group clears the hosts region, browser policies
and DNS override at the next check-in (Defender network protection is left on - the agent never
disables a security feature). The agent only applies policy types it ships, so devices must be on
1.7.0+ (self-update handles the rollout).

## Honest limits

- **Domain-level, not full-URL.** hosts/DNS block whole hostnames; there is no per-path or
  content inspection (that would need a proxy + CA, out of scope for the self-contained model).
- **Bypass surface.** A VPN, phone hotspot, DoH (mitigated by forcing it off) or an unmanaged
  browser can still evade browser-level rules; hosts and DNS apply OS-wide.
- **Category depth is curation effort.** Native categories are only as good as the lists IdaraOS
  maintains; keep them focused (large hosts files slow the Windows DNS client).
- **Offline.** Unlike admin-password rotation, filtering persists while offline; changes wait for the
  next check-in.

## Website access requests

A member blocked by the filter can request temporary access to a specific site; an approver (anyone
with device-policy edit permission) grants it for a short, time-boxed window. The approved domain is
merged into that member's effective web-filtering `allowlist` at check-in, so the agent stops
blocking it; when the window ends the exception drops out and the agent re-blocks the site at the
next check-in (the member requests again to get back in). Per-member, so it applies to every agent
device they're signed in to.

- Table: `security_web_access_requests`
  ([`schema/security-web-access.ts`](../../../apps/web/lib/db/schema/security-web-access.ts)).
- Member: a **Website access** section on **My Admin Access** (`POST /api/security/web-access/my`).
- Approver: the **Website access** tab on **Software Updates** (`GET /api/security/web-access`,
  `.../[id]/approve`, `.../[id]/deny`).
- Merge: `getActiveWebAccessDomains`
  ([`web-access-server.ts`](../../../apps/web/lib/security/web-access-server.ts)) unions live
  exceptions into the allowlist in the check-in route; `expireDueWebAccess` marks passed windows.

True one-visit semantics ("block again on the very next visit") are not possible natively - there is
no proxy to count individual visits - so "for that moment" is a short time-boxed window (default
options 10 / 30 / 60 / 120 minutes).
