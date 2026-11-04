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

/** A setting a policy carries, chosen from a fixed allowlist (never free text) */
export interface PolicySettingDef {
  key: string
  label: string
  type: "boolean"
  default: boolean
}

export interface PolicyTypeDef {
  /** Stable key sent to the agent, e.g. "usb-storage-block" */
  type: string
  label: string
  /** What the policy does, shown before it is switched on */
  description: string
  settings: PolicySettingDef[]
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
 * Keep only settings the policy defines, coercing each to its declared type and filling defaults.
 * Anything the policy doesn't define is dropped, so no arbitrary data reaches the agent.
 */
export function sanitizePolicySettings(type: string, input: Record<string, unknown> | null | undefined): Record<string, boolean> {
  const def = POLICY_BY_TYPE[type]
  if (!def) return {}
  const clean: Record<string, boolean> = {}
  for (const setting of def.settings) {
    const value = input && Object.prototype.hasOwnProperty.call(input, setting.key) ? input[setting.key] : undefined
    clean[setting.key] = typeof value === "boolean" ? value : setting.default
  }
  return clean
}

/** One policy as delivered to the agent: the type and its sanitized settings */
export interface EffectivePolicy {
  type: string
  settings: Record<string, boolean>
}

/**
 * Combine the enabled policies that apply to a device into the effective desired state the agent
 * enforces. A device can be reached by several groups; for each policy type the strictest wins
 * (for a boolean "block" setting, true wins), so one group enabling a restriction is enough.
 */
export function combinePolicies(
  applied: Array<{ type: string; enabled: boolean; settings: Record<string, unknown> }>
): EffectivePolicy[] {
  const byType = new Map<string, Record<string, boolean>>()
  for (const policy of applied) {
    if (!policy.enabled || !isValidPolicyType(policy.type)) continue
    const settings = sanitizePolicySettings(policy.type, policy.settings)
    const existing = byType.get(policy.type)
    if (!existing) {
      byType.set(policy.type, settings)
    } else {
      // Strictest wins: OR the booleans together
      for (const [key, value] of Object.entries(settings)) {
        existing[key] = existing[key] || value
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
