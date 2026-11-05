import { describe, it, expect } from "vitest"
import {
  POLICY_TYPES,
  combinePolicies,
  getPolicyType,
  isAgentVersionOlder,
  isValidPolicyType,
  policyName,
  sanitizePolicySettings,
} from "../../lib/security/device-policies"

describe("policy allowlist", () => {
  it("only accepts known policy types", () => {
    expect(isValidPolicyType("usb-storage-block")).toBe(true)
    expect(isValidPolicyType("rm -rf /")).toBe(false)
    expect(isValidPolicyType("")).toBe(false)
    // Prototype keys must not sneak through
    expect(isValidPolicyType("toString")).toBe(false)
    expect(isValidPolicyType("constructor")).toBe(false)
  })

  it("names every policy and no type repeats", () => {
    const types = POLICY_TYPES.map((p) => p.type)
    expect(new Set(types).size).toBe(types.length)
    for (const policy of POLICY_TYPES) {
      expect(policy.label.length).toBeGreaterThan(0)
      expect(policy.description.length).toBeGreaterThan(0)
      expect(typeof policy.revertOnDisable).toBe("boolean")
      expect(getPolicyType(policy.type)).toBe(policy)
    }
  })

  it("ships firewall, Defender and BitLocker policies", () => {
    for (const type of ["firewall-on", "defender-on", "bitlocker"]) {
      expect(isValidPolicyType(type)).toBe(true)
    }
    // Only USB blocking is reverted when removed; the protective policies are left in place
    expect(getPolicyType("usb-storage-block")?.revertOnDisable).toBe(true)
    expect(getPolicyType("firewall-on")?.revertOnDisable).toBe(false)
    expect(getPolicyType("defender-on")?.revertOnDisable).toBe(false)
    expect(getPolicyType("bitlocker")?.revertOnDisable).toBe(false)
  })

  it("falls back to the type for an unknown name", () => {
    expect(policyName("usb-storage-block")).toBe("Block USB storage")
    expect(policyName("nope")).toBe("nope")
  })
})

describe("policy settings", () => {
  it("drops anything the policy doesn't define", () => {
    // usb-storage-block declares no settings
    expect(sanitizePolicySettings("usb-storage-block", { evil: true, blocked: true })).toEqual({})
    expect(sanitizePolicySettings("unknown", { a: true })).toEqual({})
  })

  it("keeps BitLocker's includeDataDrives setting and fills its default", () => {
    expect(sanitizePolicySettings("bitlocker", { includeDataDrives: true, evil: true })).toEqual({
      includeDataDrives: true,
    })
    // Missing or wrong-typed -> the declared default (false), and nothing else
    expect(sanitizePolicySettings("bitlocker", {})).toEqual({ includeDataDrives: false })
    expect(sanitizePolicySettings("bitlocker", { includeDataDrives: "yes" })).toEqual({ includeDataDrives: false })
  })
})

describe("combinePolicies", () => {
  it("keeps enabled, allowlisted policies and drops the rest", () => {
    const result = combinePolicies([
      { type: "usb-storage-block", enabled: true, settings: {} },
      { type: "usb-storage-block", enabled: false, settings: {} },
      { type: "not-a-policy", enabled: true, settings: {} },
    ])
    expect(result).toEqual([{ type: "usb-storage-block", settings: {} }])
  })

  it("returns nothing when no enabled policy applies", () => {
    expect(combinePolicies([{ type: "usb-storage-block", enabled: false, settings: {} }])).toEqual([])
    expect(combinePolicies([])).toEqual([])
  })

  it("unions BitLocker's data-drives setting across groups (strictest wins)", () => {
    const result = combinePolicies([
      { type: "bitlocker", enabled: true, settings: { includeDataDrives: false } },
      { type: "bitlocker", enabled: true, settings: { includeDataDrives: true } },
    ])
    expect(result).toEqual([{ type: "bitlocker", settings: { includeDataDrives: true } }])
  })

  it("keeps the allowlist order across several policy types", () => {
    const result = combinePolicies([
      { type: "bitlocker", enabled: true, settings: {} },
      { type: "usb-storage-block", enabled: true, settings: {} },
      { type: "firewall-on", enabled: true, settings: {} },
    ])
    expect(result.map((p) => p.type)).toEqual(["usb-storage-block", "firewall-on", "bitlocker"])
  })
})

describe("isAgentVersionOlder", () => {
  it("compares semver-style versions numerically", () => {
    expect(isAgentVersionOlder("1.3.0", "1.4.0")).toBe(true)
    expect(isAgentVersionOlder("1.4.0", "1.4.0")).toBe(false)
    expect(isAgentVersionOlder("1.4.1", "1.4.0")).toBe(false)
    expect(isAgentVersionOlder("1.2.0", "1.10.0")).toBe(true) // numeric, not lexical
    expect(isAgentVersionOlder("2.0.0", "1.9.9")).toBe(false)
  })

  it("treats a missing or garbled version as older", () => {
    expect(isAgentVersionOlder(null, "1.4.0")).toBe(true)
    expect(isAgentVersionOlder(undefined, "1.4.0")).toBe(true)
    expect(isAgentVersionOlder("", "1.4.0")).toBe(true)
    expect(isAgentVersionOlder("nope", "1.4.0")).toBe(true)
  })
})
