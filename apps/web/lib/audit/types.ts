/**
 * Audit Logging Types
 * 
 * TypeScript interfaces for the audit logging system
 */

import type { AuditAction } from "@/lib/db/schema/audit"

/**
 * Actor information for audit logs
 */
export interface AuditActor {
  id: string | null
  email: string
  name: string | null
  ip: string | null
  userAgent: string | null
}

/**
 * Input for creating an audit log entry
 */
export interface AuditLogInput {
  // Required fields
  module: string
  action: AuditAction | string
  entityType: string
  
  // Entity details (optional for some actions like login)
  entityId?: string
  entityName?: string
  
  // Change tracking (for create/update operations)
  previous?: Record<string, unknown>
  current?: Record<string, unknown>
  
  // Optional overrides (otherwise extracted from request)
  actor?: Partial<AuditActor>
  
  // Additional context
  description?: string
  metadata?: Record<string, unknown>
}

/**
 * Context needed for audit logging
 * Typically extracted from the request
 */
export interface AuditContext {
  orgId: string
  actor: AuditActor
}

/**
 * Result of a field diff calculation
 */
export interface FieldChange {
  field: string
  previousValue: unknown
  newValue: unknown
}

/**
 * Result of comparing two objects
 */
export interface DiffResult {
  changedFields: string[]
  previousValues: Record<string, unknown>
  newValues: Record<string, unknown>
}

/**
 * Fields that should be masked in audit logs
 */
export const SENSITIVE_FIELDS = [
  "password",
  "passwordHash",
  "secret",
  "clientSecret",
  "accessToken",
  "refreshToken",
  "apiKey",
  "token",
  "scimToken",
  "encryptionKey",
  "privateKey",
] as const

/**
 * Fields that should be excluded from audit logs entirely
 */
export const EXCLUDED_FIELDS = [
  "createdAt",
  "updatedAt",
  "orgId",
] as const

/**
 * Audit log query filters
 */
export interface AuditLogFilters {
  module?: string
  modulePrefix?: string
  action?: string
  entityType?: string
  entityId?: string
  actorId?: string
  from?: Date
  to?: Date
  search?: string
  limit?: number
  offset?: number
}

/**
 * Paginated audit log response
 */
export interface AuditLogResponse {
  logs: AuditLogEntry[]
  total: number
  limit: number
  offset: number
}

/**
 * Single audit log entry for API responses
 */
export interface AuditLogEntry {
  id: string
  module: string
  action: string
  entityType: string
  entityId: string | null
  entityName: string | null
  actorId: string | null
  actorEmail: string
  actorName: string | null
  actorIp: string | null
  previousValues: Record<string, unknown> | null
  newValues: Record<string, unknown> | null
  changedFields: string[] | null
  description: string | null
  timestamp: string
}
