/**
 * TOTP / 2FA codes (RFC 6238), server-side, dependency-free.
 *
 * Accepts a base32 secret or a full otpauth:// URI and derives the current 6-digit code. Used to show
 * live 2FA codes for a vault item without storing anything but the (encrypted) secret.
 */

import crypto from "node:crypto"

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase()
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of clean) {
    const idx = BASE32.indexOf(ch)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

export interface TotpConfig {
  secret: string
  digits: number
  period: number
  algorithm: string
}

/** Parse a base32 secret or an otpauth:// URI into a config. Returns null if there is no usable secret. */
export function parseTotp(input: string): TotpConfig | null {
  const raw = input.trim()
  if (!raw) return null
  if (raw.toLowerCase().startsWith("otpauth://")) {
    try {
      const url = new URL(raw)
      const secret = url.searchParams.get("secret")
      if (!secret) return null
      return {
        secret,
        digits: Number(url.searchParams.get("digits")) || 6,
        period: Number(url.searchParams.get("period")) || 30,
        algorithm: (url.searchParams.get("algorithm") || "SHA1").toUpperCase(),
      }
    } catch {
      return null
    }
  }
  return { secret: raw, digits: 6, period: 30, algorithm: "SHA1" }
}

export interface TotpCode {
  code: string
  period: number
  remaining: number
}

/** The current TOTP code for a secret/URI, or null if it can't be parsed. */
export function generateTotp(input: string, now: number = Date.now()): TotpCode | null {
  const cfg = parseTotp(input)
  if (!cfg) return null
  const key = base32Decode(cfg.secret)
  if (key.length === 0) return null
  const algo = cfg.algorithm === "SHA256" ? "sha256" : cfg.algorithm === "SHA512" ? "sha512" : "sha1"
  const counter = Math.floor(now / 1000 / cfg.period)
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64BE(BigInt(counter))
  const hmac = crypto.createHmac(algo, key).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0xf
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  const code = (bin % 10 ** cfg.digits).toString().padStart(cfg.digits, "0")
  const remaining = cfg.period - (Math.floor(now / 1000) % cfg.period)
  return { code, period: cfg.period, remaining }
}
