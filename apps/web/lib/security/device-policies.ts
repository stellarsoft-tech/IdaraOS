/**
 * IdaraOS Agent - device policies (pure helpers, no database access)
 *
 * A policy is one reviewed, bounded setting enforced on an agent device (block USB storage, ...).
 * The server sends the agent only a policy TYPE key from this allowlist plus bounded settings -
 * never a command - and the agent applies only the policy types it knows. This is the same safety
 * property that limits device actions and installs: nothing runs that wasn't reviewed and shipped.
 *
 * Shared with the agent (deployment/agent/IdaraOS-Agent.ps1): the policy type keys and the desired
 * state the agent enforces must match on both sides.
 */

/** A value a policy setting can hold: a boolean toggle, or a list of strings (domains / categories). */
export type PolicySettingValue = boolean | string[]

interface BaseSettingDef {
  key: string
  label: string
  /** Short helper text shown under the control (optional) */
  hint?: string
}

/** A boolean toggle setting */
export interface BooleanSettingDef extends BaseSettingDef {
  kind: "boolean"
  default: boolean
}

/** A free-entry list of domain patterns (one per line in the UI), bounded in count and length */
export interface StringListSettingDef extends BaseSettingDef {
  kind: "string-list"
  default: string[]
  /** Max number of entries kept */
  maxItems: number
  /** Max length of a single entry */
  maxLen: number
}

/** A pick-many-from-a-fixed-list setting (e.g. blocked categories) */
export interface MultiSelectSettingDef extends BaseSettingDef {
  kind: "multi-select"
  options: Array<{ value: string; label: string }>
  default: string[]
}

/** A setting a policy carries, chosen from a fixed allowlist (never arbitrary free text) */
export type PolicySettingDef = BooleanSettingDef | StringListSettingDef | MultiSelectSettingDef

export interface PolicyTypeDef {
  /** Stable key sent to the agent, e.g. "usb-storage-block" */
  type: string
  label: string
  /** What the policy does, shown before it is switched on */
  description: string
  settings: PolicySettingDef[]
  /**
   * Whether turning the policy off undoes it on the device. Access restrictions (block USB,
   * web filtering) are reverted - the whole point is to restore access. Protective policies
   * (firewall on, Defender on, BitLocker) are NOT torn down when removed: the agent just stops
   * forcing them. It never turns a firewall off, disables antivirus, or decrypts a disk on its own.
   */
  revertOnDisable: boolean
}

// ============================================================================
// WEB FILTERING - category list (single source of truth, shared with the list loader & agent)
// ============================================================================

/** The curated category lists IdaraOS ships (deployment/agent/filter-lists/<category>.txt). */
export const WEB_FILTERING_TYPE = "web-filtering"

/** Force-install the self-hosted IdaraOS Vault browser extension via Chrome/Edge policy. */
export const BROWSER_EXTENSION_TYPE = "browser-extension"

export const WEB_FILTERING_CATEGORIES = [
  "gambling",
  "social",
  "streaming",
  "gaming",
  "dating",
  "piracy",
  "ads",
] as const

export type WebFilteringCategory = (typeof WEB_FILTERING_CATEGORIES)[number]

const WEB_FILTERING_CATEGORY_LABELS: Record<WebFilteringCategory, string> = {
  gambling: "Gambling",
  social: "Social media",
  streaming: "Streaming & video",
  gaming: "Gaming",
  dating: "Dating",
  piracy: "Piracy & torrents",
  ads: "Ads & trackers",
}

/** Whether `value` names a curated web-filtering category. */
export function isWebFilteringCategory(value: string): value is WebFilteringCategory {
  return (WEB_FILTERING_CATEGORIES as readonly string[]).includes(value)
}

/**
 * The policies the agent supports. Adding one means shipping a new agent version that enforces its
 * type (see IdaraOS-Agent.ps1) - there is no runtime command input. The `type` is plain text in the
 * database, so a new type needs no migration.
 */
export const POLICY_TYPES: PolicyTypeDef[] = [
  {
    type: "usb-storage-block",
    label: "Block USB storage",
    description:
      "Disables USB mass-storage devices (USB sticks, external drives) so they can't mount. Keyboards, mice, webcams and other non-storage USB devices keep working. Reversible - turning the policy off restores USB storage. Applies to everyone on the device, including the signed-in user.",
    settings: [],
    revertOnDisable: true,
  },
  {
    type: "firewall-on",
    label: "Firewall always on",
    description:
      "Keeps Windows Defender Firewall turned on for all profiles (Domain, Private, Public) with inbound connections blocked by default, re-applied at every check-in. If someone turns the firewall off, the agent turns it back on within one check-in. Turning the policy off stops enforcing it but never leaves the firewall off itself.",
    settings: [],
    revertOnDisable: false,
  },
  {
    type: "defender-on",
    label: "Microsoft Defender always on",
    description:
      "Keeps Microsoft Defender Antivirus running with real-time protection on, re-applied at every check-in, and reports whether Windows Tamper Protection is enabled. Note: Tamper Protection can only be switched on from Intune/MDM, and while it is on Windows blocks scripted changes - so this gives practical protection by re-applying each check-in, not Microsoft Tamper Protection. Turning the policy off stops enforcing it but never disables antivirus.",
    settings: [],
    revertOnDisable: false,
  },
  {
    type: "bitlocker",
    label: "Encrypt disk (BitLocker) + escrow key",
    description:
      "Turns on BitLocker for the operating-system drive (XTS-AES-256, using the TPM plus a recovery password) and escrows the recovery key to IdaraOS, encrypted at rest. The key can be revealed later from the device's actions, and every reveal is audited. Needs a TPM; encryption runs in the background. Turning the policy off stops enforcing it but never decrypts the disk.",
    settings: [{ key: "includeDataDrives", label: "Also encrypt fixed data drives", kind: "boolean", default: false }],
    revertOnDisable: false,
  },
  {
    type: WEB_FILTERING_TYPE,
    label: "Web content filtering",
    description:
      "Filters web access on the device: blocks whole categories (gambling, social media, ...), enforces admin allow/block lists, forces SafeSearch, and blocks malware/phishing. Enforced by the agent with a filtering DNS resolver, a hosts-file category block, browser policies (Chrome, Edge, Firefox) and Microsoft Defender network protection, re-applied every check-in. Reversible - turning the policy off restores normal browsing. Applies to everyone on the device.",
    settings: [
      { key: "securityFiltering", label: "Block malware & phishing sites", kind: "boolean", default: true },
      { key: "blockAdult", label: "Block adult content", kind: "boolean", default: true },
      {
        key: "enforceSafeSearch",
        label: "Force SafeSearch (Google, Bing, YouTube)",
        kind: "boolean",
        default: true,
      },
      {
        key: "categories",
        label: "Blocked categories",
        kind: "multi-select",
        options: WEB_FILTERING_CATEGORIES.map((c) => ({ value: c, label: WEB_FILTERING_CATEGORY_LABELS[c] })),
        default: [],
      },
      {
        key: "blocklist",
        label: "Always block these domains",
        hint: "One domain per line (e.g. example.com). Paths are ignored - filtering is domain-level.",
        kind: "string-list",
        default: [],
        maxItems: 500,
        maxLen: 253,
      },
      {
        key: "allowlist",
        label: "Always allow these domains",
        hint: "One domain per line. These are never blocked, even if a category would block them.",
        kind: "string-list",
        default: [],
        maxItems: 500,
        maxLen: 253,
      },
      {
        key: "allowlistOnly",
        label: "Allow only the domains above (block everything else)",
        kind: "boolean",
        default: false,
      },
      {
        key: "disableDoh",
        label: "Turn off browser DNS-over-HTTPS (stops filtering bypass)",
        kind: "boolean",
        default: true,
      },
      { key: "lockDns", label: "Pin and re-apply the filtering DNS each check-in", kind: "boolean", default: true },
    ],
    revertOnDisable: true,
  },
  {
    type: BROWSER_EXTENSION_TYPE,
    label: "Deploy Vault browser extension",
    description:
      "Force-installs the IdaraOS Vault browser extension on this device's Chrome and/or Edge, so users get password autofill without installing anything by hand. The agent sets the browser's ExtensionInstallForcelist policy, pointing at the signed copy IdaraOS self-hosts - no web store and no Intune. Reversible: turning the policy off removes the forced install. Each user still signs the extension in to their own vault with a token.",
    settings: [
      { key: "chrome", label: "Install on Google Chrome", kind: "boolean", default: true },
      { key: "edge", label: "Install on Microsoft Edge", kind: "boolean", default: true },
    ],
    revertOnDisable: true,
  },
]

const POLICY_BY_TYPE: Record<string, PolicyTypeDef> = Object.fromEntries(POLICY_TYPES.map((p) => [p.type, p]))

/** The policy definition for a type, or undefined if it isn't a known policy */
export function getPolicyType(type: string): PolicyTypeDef | undefined {
  return POLICY_BY_TYPE[type]
}

/** Whether `type` is a known policy type */
export function isValidPolicyType(type: string): boolean {
  return Object.prototype.hasOwnProperty.call(POLICY_BY_TYPE, type)
}

/** The display name for a policy type, falling back to the type key */
export function policyName(type: string): string {
  return POLICY_BY_TYPE[type]?.label ?? type
}

/**
 * Normalize a domain pattern from an allow/block list: lower-case, strip any scheme/path/port and
 * common adblock punctuation, keep an optional leading "*." wildcard, and validate it looks like a
 * domain. Returns null for anything that isn't a plausible domain (filtering is domain-level, so a
 * URL path is dropped). Keeps garbage and arbitrary data out of what reaches the agent.
 */
const DOMAIN_PATTERN_RE = /^(\*\.)?([a-z0-9-]+\.)+[a-z]{2,}$/

export function normalizeDomainPattern(value: string): string | null {
  let s = value.trim().toLowerCase()
  if (!s || s.startsWith("#") || s.startsWith("!")) return null
  s = s.replace(/^https?:\/\//, "") // scheme
  s = s.replace(/^\|\|/, "").replace(/[\^$].*$/, "") // adblock prefix/suffix
  s = s.replace(/^\*\./, "") // wildcard prefix -> apex (a host block covers subdomains anyway)
  s = s.replace(/\/.*$/, "") // path
  s = s.replace(/:\d+$/, "") // port
  s = s.replace(/^\.+/, "") // leading dots
  if (!s || s.length > 253) return null
  if (!DOMAIN_PATTERN_RE.test(s)) return null
  return s
}

/** Coerce one raw setting value to its declared kind, falling back to the default. */
function sanitizeSettingValue(setting: PolicySettingDef, raw: unknown): PolicySettingValue {
  switch (setting.kind) {
    case "boolean":
      return typeof raw === "boolean" ? raw : setting.default
    case "multi-select": {
      if (!Array.isArray(raw)) return [...setting.default]
      const allowed = new Set(setting.options.map((o) => o.value))
      const seen = new Set<string>()
      const out: string[] = []
      for (const v of raw) {
        if (typeof v !== "string" || !allowed.has(v) || seen.has(v)) continue
        seen.add(v)
        out.push(v)
      }
      return out
    }
    case "string-list": {
      if (!Array.isArray(raw)) return [...setting.default]
      const seen = new Set<string>()
      const out: string[] = []
      for (const v of raw) {
        if (typeof v !== "string") continue
        const cleaned = normalizeDomainPattern(v)
        if (!cleaned || cleaned.length > setting.maxLen || seen.has(cleaned)) continue
        seen.add(cleaned)
        out.push(cleaned)
        if (out.length >= setting.maxItems) break
      }
      return out
    }
  }
}

/**
 * Keep only settings the policy defines, coercing each to its declared kind and filling defaults.
 * Anything the policy doesn't define is dropped, so no arbitrary data reaches the agent.
 */
export function sanitizePolicySettings(
  type: string,
  input: Record<string, unknown> | null | undefined
): Record<string, PolicySettingValue> {
  const def = POLICY_BY_TYPE[type]
  if (!def) return {}
  const clean: Record<string, PolicySettingValue> = {}
  for (const setting of def.settings) {
    const raw = input && Object.prototype.hasOwnProperty.call(input, setting.key) ? input[setting.key] : undefined
    clean[setting.key] = sanitizeSettingValue(setting, raw)
  }
  return clean
}

/** One policy as delivered to the agent: the type and its sanitized settings */
export interface EffectivePolicy {
  type: string
  settings: Record<string, PolicySettingValue>
}

/** Merge two values for the same setting key: strictest wins (boolean OR, list union). */
function mergeSettingValue(a: PolicySettingValue | undefined, b: PolicySettingValue): PolicySettingValue {
  if (a === undefined) return b
  if (typeof a === "boolean" && typeof b === "boolean") return a || b
  if (Array.isArray(a) && Array.isArray(b)) return [...new Set([...a, ...b])]
  return b // mismatched kinds for one key shouldn't happen; prefer the later value
}

/**
 * Combine the enabled policies that apply to a device into the effective desired state the agent
 * enforces. A device can be reached by several groups; for each policy type the strictest wins -
 * a boolean "block" setting is OR-ed (one group enabling a restriction is enough), and a list
 * setting (allow/block lists, categories) is the union across groups.
 */
export function combinePolicies(
  applied: Array<{ type: string; enabled: boolean; settings: Record<string, unknown> }>
): EffectivePolicy[] {
  const byType = new Map<string, Record<string, PolicySettingValue>>()
  for (const policy of applied) {
    if (!policy.enabled || !isValidPolicyType(policy.type)) continue
    const settings = sanitizePolicySettings(policy.type, policy.settings)
    const existing = byType.get(policy.type)
    if (!existing) {
      byType.set(policy.type, settings)
    } else {
      for (const [key, value] of Object.entries(settings)) {
        existing[key] = mergeSettingValue(existing[key], value)
      }
    }
  }
  // Keep the allowlist's order
  return POLICY_TYPES.filter((p) => byType.has(p.type)).map((p) => ({ type: p.type, settings: byType.get(p.type)! }))
}

// ============================================================================
// AGENT VERSION (self-update)
// ============================================================================

/**
 * Compare two agent version strings ("1.3.0"). Returns true when `a` is older than `b`.
 * A missing/garbled version counts as older, so such a device is offered the update.
 */
export function isAgentVersionOlder(a: string | null | undefined, b: string): boolean {
  if (!a) return true
  const parse = (v: string) => v.trim().replace(/^v/i, "").split(".").map((n) => parseInt(n, 10))
  const pa = parse(a)
  const pb = parse(b)
  if (pa.some((n) => Number.isNaN(n))) return true
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0
    const y = pb[i] ?? 0
    if (x !== y) return x < y
  }
  return false
}
