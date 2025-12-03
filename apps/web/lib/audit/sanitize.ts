/**
 * Sensitive Data Sanitizer
 * 
 * Masks sensitive fields in objects before storing in audit logs.
 * This ensures passwords, tokens, and other secrets are not logged.
 */

import { SENSITIVE_FIELDS } from "./types"

/**
 * Mask used to replace sensitive values
 */
const MASK = "[REDACTED]"

/**
 * Check if a field name indicates sensitive data
 */
function isSensitiveField(fieldName: string): boolean {
  const lowerField = fieldName.toLowerCase()
  
  // Check against known sensitive field names
  for (const sensitive of SENSITIVE_FIELDS) {
    if (lowerField.includes(sensitive.toLowerCase())) {
      return true
    }
  }
  
  // Additional patterns
  const sensitivePatterns = [
    /password/i,
    /secret/i,
    /token/i,
    /key/i,
    /auth/i,
    /credential/i,
    /private/i,
  ]
  
  return sensitivePatterns.some(pattern => pattern.test(fieldName))
}

/**
 * Check if a value looks like a sensitive value
 * (e.g., long random strings that might be tokens)
 */
function looksSensitive(value: unknown): boolean {
  if (typeof value !== "string") {
    return false
  }
  
  // JWT tokens
  if (value.startsWith("eyJ") && value.split(".").length === 3) {
    return true
  }
  
  // Long random-looking strings (likely tokens/keys)
  if (value.length > 40 && /^[a-zA-Z0-9+/=_-]+$/.test(value)) {
    return true
  }
  
  return false
}

/**
 * Sanitize a value, masking it if sensitive
 */
function sanitizeValue(key: string, value: unknown): unknown {
  // Check if the field name indicates sensitive data
  if (isSensitiveField(key)) {
    return MASK
  }
  
  // Check if the value looks sensitive
  if (looksSensitive(value)) {
    return MASK
  }
  
  // Recursively sanitize objects
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return sanitizeObject(value as Record<string, unknown>)
  }
  
  // Recursively sanitize arrays
  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeValue(String(index), item))
  }
  
  return value
}

/**
 * Sanitize an object by masking sensitive fields
 * 
 * @param obj - The object to sanitize
 * @returns A new object with sensitive fields masked
 */
export function sanitizeObject(
  obj: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!obj) {
    return null
  }
  
  const sanitized: Record<string, unknown> = {}
  
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeValue(key, value)
  }
  
  return sanitized
}

/**
 * Sanitize both previous and new values
 */
export function sanitizeChanges(
  previous: Record<string, unknown> | null | undefined,
  current: Record<string, unknown> | null | undefined
): {
  previousValues: Record<string, unknown> | null
  newValues: Record<string, unknown> | null
} {
  return {
    previousValues: sanitizeObject(previous),
    newValues: sanitizeObject(current),
  }
}

/**
 * Check if a changed field is sensitive
 * Used to potentially hide the entire change
 */
export function hasSensitiveChanges(changedFields: string[]): boolean {
  return changedFields.some(isSensitiveField)
}

/**
 * Filter out sensitive fields from a list
 */
export function filterSensitiveFields(fields: string[]): string[] {
  return fields.filter(field => !isSensitiveField(field))
}
