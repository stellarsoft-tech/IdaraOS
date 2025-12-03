/**
 * Audit Logging Module
 * 
 * Provides comprehensive audit trail functionality for the application.
 * 
 * Usage:
 * ```typescript
 * import { createAuditLogger, extractActor } from "@/lib/audit"
 * 
 * // In an API route
 * const actor = await extractActor(user.id, user.email, user.name)
 * const audit = createAuditLogger(orgId, actor)
 * 
 * // Log various actions
 * await audit.logCreate("people.directory", "person", person)
 * await audit.logUpdate("people.directory", "person", id, name, oldData, newData)
 * await audit.logDelete("people.directory", "person", person)
 * 
 * // Or use the generic log method
 * await audit.log({
 *   module: "settings.users",
 *   action: "update",
 *   entityType: "user",
 *   entityId: user.id,
 *   entityName: user.email,
 *   previous: oldUser,
 *   current: newUser,
 * })
 * ```
 */

// Core logger
export { 
  AuditLogger, 
  createAuditLogger, 
  createAuditLog, 
  extractActor 
} from "./logger"

// Types
export type { 
  AuditLogInput, 
  AuditContext, 
  AuditActor,
  AuditLogFilters,
  AuditLogResponse,
  AuditLogEntry,
  FieldChange,
  DiffResult,
} from "./types"

export { SENSITIVE_FIELDS, EXCLUDED_FIELDS } from "./types"

// Utilities
export { calculateDiff, describeChanges, extractChanges } from "./diff"
export { sanitizeObject, sanitizeChanges, hasSensitiveChanges, filterSensitiveFields } from "./sanitize"
