import { describe, it, expect } from "vitest"
import { derivePasswordFields, evaluatePassword } from "@/lib/vault/audit-server"
import type { VaultSettings } from "@/lib/db/schema"

const settings = {
  id: "s",
  orgId: "o",
  minLength: 12,
  requireUpper: true,
  requireLower: true,
  requireDigit: true,
  requireSymbol: false,
  noReuse: true,
  maxAgeDays: 0,
  enforcement: "block",
  updatedById: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as VaultSettings

describe("vault policy evaluation", () => {
  it("accepts a compliant password", () => {
    expect(evaluatePassword("Abcdef123456", settings, new Set())).toEqual([])
  })

  it("flags too short and a missing character class", () => {
    const v = evaluatePassword("abcdef", settings, new Set())
    expect(v).toContain("at least 12 characters")
    expect(v).toContain("an uppercase letter")
    expect(v).toContain("a number")
  })

  it("flags reuse against existing fingerprints", () => {
    const fp = derivePasswordFields("Abcdef123456").passwordFingerprint
    expect(fp).not.toBeNull()
    const v = evaluatePassword("Abcdef123456", settings, new Set([fp as string]))
    expect(v.some((s) => s.includes("already using"))).toBe(true)
  })

  it("derives a fingerprint + strength for a password, null for none", () => {
    const d = derivePasswordFields("Abcdef123456")
    expect(d.passwordFingerprint).toMatch(/^[0-9a-f]{64}$/)
    expect(typeof d.passwordStrength).toBe("number")
    expect(derivePasswordFields(null)).toEqual({ passwordFingerprint: null, passwordStrength: null })
  })
})
