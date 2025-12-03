/**
 * Audit Logger Service
 * 
 * Central service for creating audit log entries.
 * Handles:
 * - Field diff calculation
 * - Sensitive data masking
 * - Actor extraction from request context
 * - Database insertion
 */

import { headers } from "next/headers"
import { db } from "@/lib/db"
import { auditLogs } from "@/lib/db/schema"
import type { AuditLogInput, AuditContext, AuditActor } from "./types"
import { calculateDiff, describeChanges } from "./diff"
import { sanitizeObject } from "./sanitize"

/**
 * Extract actor information from request headers and session
 */
export async function extractActor(
  userId: string | null,
  userEmail: string,
  userName: string | null
): Promise<AuditActor> {
  const headerStore = await headers()
  
  // Try to get IP from various headers
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() 
    ?? headerStore.get("x-real-ip") 
    ?? headerStore.get("cf-connecting-ip")
    ?? null
  
  const userAgent = headerStore.get("user-agent") ?? null
  
  return {
    id: userId,
    email: userEmail,
    name: userName,
    ip,
    userAgent,
  }
}

/**
 * Create an audit log entry
 * 
 * @param context - Organization and actor context
 * @param input - Audit log input data
 */
export async function createAuditLog(
  context: AuditContext,
  input: AuditLogInput
): Promise<void> {
  try {
    // Calculate diff if previous and current values provided
    let previousValues: Record<string, unknown> | null = null
    let newValues: Record<string, unknown> | null = null
    let changedFields: string[] | null = null
    let description = input.description
    
    if (input.previous || input.current) {
      const diff = calculateDiff(input.previous, input.current)
      
      // Sanitize the values to mask sensitive data
      previousValues = sanitizeObject(diff.previousValues)
      newValues = sanitizeObject(diff.newValues)
      changedFields = diff.changedFields.length > 0 ? diff.changedFields : null
      
      // Auto-generate description if not provided
      if (!description && changedFields && changedFields.length > 0) {
        description = describeChanges(changedFields)
      }
    }
    
    // For create operations, store the new values
    if (input.action === "create" && input.current && !previousValues) {
      newValues = sanitizeObject(input.current)
    }
    
    // For delete operations, store the previous values
    if (input.action === "delete" && input.previous && !previousValues) {
      previousValues = sanitizeObject(input.previous)
    }
    
    // Merge actor overrides
    const actor: AuditActor = {
      ...context.actor,
      ...input.actor,
    }
    
    // Insert the audit log entry
    await db.insert(auditLogs).values({
      orgId: context.orgId,
      module: input.module,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      entityName: input.entityName ?? null,
      actorId: actor.id ?? null,
      actorEmail: actor.email,
      actorName: actor.name ?? null,
      actorIp: actor.ip ?? null,
      actorUserAgent: actor.userAgent ?? null,
      previousValues,
      newValues,
      changedFields,
      description,
      metadata: input.metadata ?? null,
    })
  } catch (error) {
    // Log errors but don't throw - audit logging should not break the main operation
    console.error("[AuditLogger] Failed to create audit log:", error)
  }
}

/**
 * Convenience class for audit logging within a request context
 */
export class AuditLogger {
  private context: AuditContext
  
  constructor(context: AuditContext) {
    this.context = context
  }
  
  /**
   * Log an action
   */
  async log(input: AuditLogInput): Promise<void> {
    await createAuditLog(this.context, input)
  }
  
  /**
   * Log a create action
   */
  async logCreate(
    module: string,
    entityType: string,
    entity: { id: string; name?: string } & Record<string, unknown>
  ): Promise<void> {
    await this.log({
      module,
      action: "create",
      entityType,
      entityId: entity.id,
      entityName: entity.name,
      current: entity,
      description: `Created ${entityType}`,
    })
  }
  
  /**
   * Log an update action
   */
  async logUpdate(
    module: string,
    entityType: string,
    entityId: string,
    entityName: string | undefined,
    previous: Record<string, unknown>,
    current: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      module,
      action: "update",
      entityType,
      entityId,
      entityName,
      previous,
      current,
    })
  }
  
  /**
   * Log a delete action
   */
  async logDelete(
    module: string,
    entityType: string,
    entity: { id: string; name?: string } & Record<string, unknown>
  ): Promise<void> {
    await this.log({
      module,
      action: "delete",
      entityType,
      entityId: entity.id,
      entityName: entity.name,
      previous: entity,
      description: `Deleted ${entityType}`,
    })
  }
  
  /**
   * Log a login action
   */
  async logLogin(userId: string, email: string, method: string): Promise<void> {
    await this.log({
      module: "auth",
      action: "login",
      entityType: "user",
      entityId: userId,
      entityName: email,
      description: `User logged in via ${method}`,
      metadata: { method },
    })
  }
  
  /**
   * Log a logout action
   */
  async logLogout(userId: string, email: string): Promise<void> {
    await this.log({
      module: "auth",
      action: "logout",
      entityType: "user",
      entityId: userId,
      entityName: email,
      description: "User logged out",
    })
  }
}

/**
 * Create an AuditLogger instance from request context
 */
export function createAuditLogger(
  orgId: string,
  actor: AuditActor
): AuditLogger {
  return new AuditLogger({ orgId, actor })
}
