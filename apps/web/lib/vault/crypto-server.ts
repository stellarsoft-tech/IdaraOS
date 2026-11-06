/**
 * Vault at-rest encryption (server-only)
 *
 * The password vault stores secrets encrypted at rest with AES-256-GCM (authenticated encryption with
 * a per-record random IV + auth tag) - an upgrade over lib/encryption.ts (AES-256-CBC, constant salt,
 * no auth tag), which stays as-is for the existing device-secret escrow. Decryption happens server-side
 * for the authenticated owner; the session (SSO + 2FA) and RBAC gate access.
 *
 * Trust model (deliberate, see docs): this is NOT zero-knowledge. The server, and anyone with
 * ENCRYPTION_KEY + DB access, can decrypt. Keep ENCRYPTION_KEY in a real secret store, not the dev
 * fallback - isEncryptionKeyConfigured() surfaces that in the UI.
 */

import crypto from "node:crypto"

const DEV_FALLBACK_KEY = "demo-key-change-in-production-32c"
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || DEV_FALLBACK_KEY
const PREFIX = "v1"

// Derive the AES key once (scrypt is deliberately slow; per-record randomness comes from the IV, which
// is sufficient for GCM as long as (key, IV) never repeats - and the IV is random per call).
let cachedKey: Buffer | null = null
function vaultKey(): Buffer {
  if (!cachedKey) cachedKey = crypto.scryptSync(ENCRYPTION_KEY, "idaraos-vault-v1", 32)
  return cachedKey
}

/** Encrypt a secret string. Format: "v1:<ivHex>:<tagHex>:<cipherHex>". */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", vaultKey(), iv)
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}:${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`
}

/** Decrypt a secret string. Throws on a malformed blob or a failed auth tag (tampering/wrong key). */
export function decryptSecret(blob: string): string {
  const parts = blob.split(":")
  if (parts.length !== 4 || parts[0] !== PREFIX) throw new Error("Malformed vault ciphertext")
  const [, ivHex, tagHex, dataHex] = parts
  const decipher = crypto.createDecipheriv("aes-256-gcm", vaultKey(), Buffer.from(ivHex, "hex"))
  decipher.setAuthTag(Buffer.from(tagHex, "hex"))
  return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8")
}

/** Encrypt when a value is present; a null/empty value stays null (so "no value" is null in the DB). */
export function encryptOptional(value: string | null | undefined): string | null {
  const v = value?.trim()
  return v ? encryptSecret(v) : null
}

/** Decrypt when present; null → null. Returns null on failure rather than throwing (for bulk reads). */
export function decryptOptional(blob: string | null | undefined): string | null {
  if (!blob) return null
  try {
    return decryptSecret(blob)
  } catch {
    return null
  }
}

/**
 * A keyed, non-reversible fingerprint of a password (HMAC-SHA256). Lets us detect password REUSE within
 * a vault without storing or comparing plaintext. Used by the Security Audit / no-reuse policy.
 */
export function passwordFingerprint(password: string): string {
  return crypto.createHmac("sha256", vaultKey()).update(password).digest("hex")
}

/** Encrypt raw bytes (a file) to a base64 blob of (iv + authTag + ciphertext). */
export function encryptBufferToBase64(buf: Buffer): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", vaultKey(), iv)
  const enc = Buffer.concat([cipher.update(buf), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString("base64")
}

/** Decrypt a base64 blob produced by encryptBufferToBase64 back to raw bytes. Throws on tampering. */
export function decryptBufferFromBase64(b64: string): Buffer {
  const blob = Buffer.from(b64, "base64")
  const iv = blob.subarray(0, 12)
  const tag = blob.subarray(12, 28)
  const data = blob.subarray(28)
  const decipher = crypto.createDecipheriv("aes-256-gcm", vaultKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()])
}

export { isEncryptionKeyConfigured } from "@/lib/encryption"
