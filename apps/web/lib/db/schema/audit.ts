/**
 * Audit Log Schema - Comprehensive audit trail for compliance and security
 * 
 * This implements a centralized audit logging system that captures:
 * - All CRUD operations across modules
 * - Field-level change tracking with before/after values
 * - Actor information (who made the change)
 * - Request metadata (IP, user agent, etc.)
 * 
 * Best practices implemented:
 * - Immutable records (no update/delete operations on audit logs)
 * - JSONB for flexible change tracking
 * - Indexed fields for efficient querying
 * - Sensitive data masking handled at application layer
 */

import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { organizations } from "./organizations"
import { users } from "./users"

/**
 * Audit action types
 */
export const auditActionValues = [
  "create",
  "update", 
  "delete",
  "view",
  "login",
  "logout",
  "sync",
  "import",
  "export",
  "assign",
  "unassign",
  "enable",
  "disable",
  "approve",
  "reject",
] as const
export type AuditAction = (typeof auditActionValues)[number]

/**
 * Audit logs table - Central audit trail for all modules
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    
    // ========== Action Details ==========
    // Module identifier (e.g., "people.directory", "settings.users")
    module: text("module").notNull(),
    // Action performed (e.g., "create", "update", "delete")
    action: text("action").notNull(),
    // Type of entity affected (e.g., "person", "user", "role")
    entityType: text("entity_type").notNull(),
    // ID of the affected entity (nullable for actions like login)
    entityId: uuid("entity_id"),
    // Human-readable name/identifier for display (e.g., "John Doe", "Admin Role")
    entityName: text("entity_name"),
    
    // ========== Actor Details ==========
    // User who performed the action (nullable for system actions)
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    // Actor's email at time of action (stored separately for historical accuracy)
    actorEmail: text("actor_email").notNull(),
    // Actor's name at time of action
    actorName: text("actor_name"),
    // IP address of the request
    actorIp: text("actor_ip"),
    // User agent string for device/browser identification
    actorUserAgent: text("actor_user_agent"),
    
    // ========== Change Tracking ==========
    // Previous state of the entity (before the change)
    // Stored as JSONB for flexible querying
    previousValues: jsonb("previous_values"),
    // New state of the entity (after the change)
    newValues: jsonb("new_values"),
    // Array of field names that were changed (for quick filtering)
    changedFields: text("changed_fields").array(),
    
    // ========== Metadata ==========
    // Additional context (correlation ID, session ID, request ID, etc.)
    metadata: jsonb("metadata"),
    // Description of the action (optional, human-readable summary)
    description: text("description"),
    
    // ========== Timestamps ==========
    // When the action occurred
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Primary query patterns - indexed for performance
    index("idx_audit_logs_org").on(table.orgId),
    index("idx_audit_logs_module").on(table.module),
    index("idx_audit_logs_action").on(table.action),
    index("idx_audit_logs_entity_type").on(table.entityType),
    index("idx_audit_logs_entity_id").on(table.entityId),
    index("idx_audit_logs_actor_id").on(table.actorId),
    index("idx_audit_logs_timestamp").on(table.timestamp),
    // Composite index for common query patterns
    index("idx_audit_logs_org_module_timestamp").on(table.orgId, table.module, table.timestamp),
    index("idx_audit_logs_org_entity").on(table.orgId, table.entityType, table.entityId),
  ]
)

// ============ Relations ============

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [auditLogs.orgId],
    references: [organizations.id],
  }),
  actor: one(users, {
    fields: [auditLogs.actorId],
    references: [users.id],
  }),
}))

// ============ Type Exports ============

export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert

/**
 * Audit log entry for API responses
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
