/**
 * Lightweight password-strength estimate (isomorphic, dependency-free).
 *
 * A rough entropy estimate: character-pool size ^ length, discounted by how repetitive the password is.
 * Good enough for a live meter and the generator. Phase 2 (Security Audit) adds a stronger estimator
 * (zxcvbn) server-side for policy scoring; this stays for instant client-side feedback.
 */

export interface StrengthResult {
  score: 0 | 1 | 2 | 3 | 4
  label: string
  bits: number
}

const LABELS = ["Very weak", "Weak", "Fair", "Strong", "Very strong"] as const

export function estimateStrength(password: string): StrengthResult {
  const pw = password ?? ""
  if (!pw) return { score: 0, label: "Empty", bits: 0 }

  let pool = 0
  if (/[a-z]/.test(pw)) pool += 26
  if (/[A-Z]/.test(pw)) pool += 26
  if (/[0-9]/.test(pw)) pool += 10
  if (/[^A-Za-z0-9]/.test(pw)) pool += 32

  // Discount for low character variety (e.g. "aaaaaaaa" is weak despite its length)
  const uniqueRatio = new Set(pw.split("")).size / pw.length
  const variety = Math.min(1, 0.4 + uniqueRatio * 0.6)
  const bits = Math.round(pw.length * Math.log2(pool || 1) * variety)

  const score = bits < 28 ? 0 : bits < 40 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4
  return { score: score as StrengthResult["score"], label: LABELS[score], bits }
}
