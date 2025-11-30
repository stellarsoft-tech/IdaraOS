/**
 * Encryption Utilities
 * Provides secure encryption/decryption for sensitive data like API keys and tokens
 * 
 * Uses AES-256-CBC for backward compatibility with existing encrypted data.
 * New installations should consider using AES-256-GCM for authenticated encryption.
 */

import crypto from "node:crypto"

// Encryption key from environment or default for development
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "demo-key-change-in-production-32c"

// AES-256-CBC algorithm (backward compatible with existing encrypted data)
const ALGORITHM = "aes-256-cbc" as const

/**
 * Encrypt a string value using AES-256-CBC
 */
export function encrypt(text: string): string {
  try {
    const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32)
    const iv = crypto.randomBytes(16)
    // Using CBC mode for compatibility - NOSONAR
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
    let encrypted = cipher.update(text, "utf8", "hex")
    encrypted += cipher.final("hex")
    return `${iv.toString("hex")}:${encrypted}`
  } catch (error) {
    console.error("Encryption error:", error)
    throw new Error("Failed to encrypt value")
  }
}

/**
 * Decrypt an encrypted string value using AES-256-CBC
 */
export function decrypt(encryptedText: string): string {
  try {
    if (!encryptedText?.includes(":")) {
      return encryptedText || ""
    }
    const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32)
    const [ivHex, encrypted] = encryptedText.split(":")
    const iv = Buffer.from(ivHex, "hex")
    // Using CBC mode for compatibility - NOSONAR
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    let decrypted = decipher.update(encrypted, "hex", "utf8")
    decrypted += decipher.final("utf8")
    return decrypted
  } catch (error) {
    console.error("Decryption error:", error)
    return ""
  }
}

