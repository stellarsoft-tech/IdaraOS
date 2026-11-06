import { describe, it, expect } from "vitest"
import {
  decryptOptional,
  decryptSecret,
  encryptOptional,
  encryptSecret,
  passwordFingerprint,
} from "@/lib/vault/crypto-server"
import { DEFAULT_PASSWORD_OPTIONS, generatePassword } from "@/lib/vault/generator"
import { estimateStrength } from "@/lib/vault/strength"

describe("vault crypto", () => {
  it("round-trips a secret", () => {
    const pt = "S3cr3t!-value with spaces 🙂"
    const enc = encryptSecret(pt)
    expect(enc).toMatch(/^v1:/)
    expect(enc).not.toContain(pt)
    expect(decryptSecret(enc)).toBe(pt)
  })

  it("uses a unique IV per call", () => {
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"))
  })

  it("throws on tampered ciphertext (auth tag)", () => {
    const parts = encryptSecret("abc").split(":")
    parts[3] = parts[3].replace(/.$/, (c) => (c === "0" ? "1" : "0"))
    expect(() => decryptSecret(parts.join(":"))).toThrow()
  })

  it("handles the optional helpers", () => {
    expect(encryptOptional("")).toBeNull()
    expect(encryptOptional(null)).toBeNull()
    expect(decryptOptional(null)).toBeNull()
    const e = encryptOptional("x")
    expect(e).not.toBeNull()
    expect(decryptOptional(e)).toBe("x")
    expect(decryptOptional("garbage")).toBeNull()
  })

  it("fingerprints deterministically (reuse detection)", () => {
    expect(passwordFingerprint("a")).toBe(passwordFingerprint("a"))
    expect(passwordFingerprint("a")).not.toBe(passwordFingerprint("b"))
  })
})

describe("password generator", () => {
  it("honors the requested length", () => {
    expect(generatePassword({ ...DEFAULT_PASSWORD_OPTIONS, length: 32 })).toHaveLength(32)
  })

  it("includes at least one of each selected class", () => {
    const pw = generatePassword({ length: 40, uppercase: true, lowercase: true, digits: true, symbols: true, avoidAmbiguous: false })
    expect(pw).toMatch(/[A-Z]/)
    expect(pw).toMatch(/[a-z]/)
    expect(pw).toMatch(/[0-9]/)
    expect(pw).toMatch(/[^A-Za-z0-9]/)
  })

  it("avoids ambiguous characters when asked", () => {
    const pw = generatePassword({ length: 100, uppercase: true, lowercase: true, digits: true, symbols: false, avoidAmbiguous: true })
    expect(pw).not.toMatch(/[Il1O0o]/)
  })

  it("uses only the selected class", () => {
    const pw = generatePassword({ length: 16, uppercase: false, lowercase: false, digits: true, symbols: false, avoidAmbiguous: false })
    expect(pw).toMatch(/^[0-9]+$/)
  })
})

describe("password strength", () => {
  it("ranks a long diverse password above a short simple one", () => {
    expect(estimateStrength("Xk9$mQ2@wL7!zB4#").score).toBeGreaterThan(estimateStrength("aaaa").score)
  })

  it("scores an empty password as zero", () => {
    expect(estimateStrength("").score).toBe(0)
  })
})
