/**
 * Field Diff Calculator
 * 
 * Calculates differences between two objects for audit logging.
 * Handles nested objects, arrays, and various data types.
 */

import type { DiffResult } from "./types"
import { EXCLUDED_FIELDS } from "./types"

/**
 * Check if a value is an object (not null, not array)
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Deep equality check for two values
 */
function isEqual(a: unknown, b: unknown): boolean {
  // Handle null/undefined
  if (a === b) {
    return true
  }
  if (a === null || b === null || a === undefined || b === undefined) {
    return false
  }
  
  // Handle dates
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime()
  }
  if (a instanceof Date || b instanceof Date) {
    // Compare date to ISO string
    const aTime = a instanceof Date ? a.toISOString() : a
    const bTime = b instanceof Date ? b.toISOString() : b
    return aTime === bTime
  }
  
  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false
    }
    return a.every((item, index) => isEqual(item, b[index]))
  }
  
  // Handle objects
  if (isObject(a) && isObject(b)) {
    const keysA = Object.keys(a)
    const keysB = Object.keys(b)
    if (keysA.length !== keysB.length) {
      return false
    }
    return keysA.every(key => isEqual(a[key], b[key]))
  }
  
  // Primitive comparison
  return a === b
}

/**
 * Normalize a value for comparison and storage
 */
function normalizeValue(value: unknown): unknown {
  if (value === undefined) {
    return null
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (isObject(value)) {
    const normalized: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value)) {
      normalized[key] = normalizeValue(val)
    }
    return normalized
  }
  if (Array.isArray(value)) {
    return value.map(normalizeValue)
  }
  return value
}

/**
 * Calculate the difference between two objects
 * 
 * @param previous - The previous state of the object
 * @param current - The current state of the object
 * @returns Object containing changed fields and their before/after values
 */
export function calculateDiff(
  previous: Record<string, unknown> | null | undefined,
  current: Record<string, unknown> | null | undefined
): DiffResult {
  const changedFields: string[] = []
  const previousValues: Record<string, unknown> = {}
  const newValues: Record<string, unknown> = {}
  
  // Handle null/undefined cases
  if (!previous && !current) {
    return { changedFields, previousValues, newValues }
  }
  
  const prev = previous ?? {}
  const curr = current ?? {}
  
  // Get all unique keys from both objects
  const allKeys = new Set([...Object.keys(prev), ...Object.keys(curr)])
  
  for (const key of allKeys) {
    // Skip excluded fields
    if (EXCLUDED_FIELDS.includes(key as (typeof EXCLUDED_FIELDS)[number])) {
      continue
    }
    
    const prevValue = prev[key]
    const currValue = curr[key]
    
    // Check if values are different
    if (!isEqual(prevValue, currValue)) {
      changedFields.push(key)
      previousValues[key] = normalizeValue(prevValue)
      newValues[key] = normalizeValue(currValue)
    }
  }
  
  return { changedFields, previousValues, newValues }
}

/**
 * Extract only the changed fields from an object
 * Useful for displaying what changed in an update
 */
export function extractChanges(
  previous: Record<string, unknown>,
  current: Record<string, unknown>,
  fields: string[]
): { previous: Record<string, unknown>; current: Record<string, unknown> } {
  const prevChanges: Record<string, unknown> = {}
  const currChanges: Record<string, unknown> = {}
  
  for (const field of fields) {
    if (field in previous) {
      prevChanges[field] = normalizeValue(previous[field])
    }
    if (field in current) {
      currChanges[field] = normalizeValue(current[field])
    }
  }
  
  return { previous: prevChanges, current: currChanges }
}

/**
 * Create a human-readable description of changes
 */
export function describeChanges(changedFields: string[]): string {
  if (changedFields.length === 0) {
    return "No changes"
  }
  if (changedFields.length === 1) {
    return `Updated ${changedFields[0]}`
  }
  if (changedFields.length <= 3) {
    return `Updated ${changedFields.join(", ")}`
  }
  return `Updated ${changedFields.length} fields`
}
