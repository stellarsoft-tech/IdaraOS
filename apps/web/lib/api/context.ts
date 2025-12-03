/**
 * API Context Utilities
 * 
 * Provides centralized helpers for multi-tenant API routes:
 * - Get organization ID from authenticated session
 * - Build queries with automatic organization filtering
 * - Create audit loggers from session context
 */

import { getSession, type SessionPayload } from "@/lib/auth/session"
import { eq, and, type SQL } from "drizzle-orm"
import { createAuditLogger, extractActor, type AuditLogger } from "@/lib/audit"

/**
 * Get organization ID from authenticated session
 * 
 * @param _request - Unused, kept for backward compatibility
 * @returns Organization ID or null if not authenticated
 * @throws Error if authentication is required but missing
 */
export async function getOrgIdFromSession(_request?: unknown): Promise<string | null> {
  const session = await getSession()
  
  if (!session) {
    return null
  }
  
  return session.orgId
}

/**
 * Require organization ID from authenticated session
 * Throws error if not authenticated
 * 
 * @param _request - Unused, kept for backward compatibility
 * @returns Organization ID
 * @throws Error if not authenticated
 */
export async function requireOrgId(_request?: unknown): Promise<string> {
  const orgId = await getOrgIdFromSession()
  
  if (!orgId) {
    throw new Error("Authentication required")
  }
  
  return orgId
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle ORM column typing
type DrizzleColumn = any

/**
 * Build a query condition that filters by organization ID
 * 
 * @param orgId - Organization ID to filter by
 * @param orgIdColumn - The column to filter on (e.g., users.orgId, persons.orgId)
 * @returns Drizzle SQL condition
 */
export function orgFilter(orgId: string, orgIdColumn: { orgId: DrizzleColumn }): SQL {
  return eq(orgIdColumn.orgId, orgId)
}

/**
 * Combine organization filter with other conditions
 * 
 * @param orgId - Organization ID to filter by
 * @param orgIdColumn - The column to filter on
 * @param additionalConditions - Additional SQL conditions to combine
 * @returns Combined SQL condition using AND
 */
export function orgFilterWith(
  orgId: string,
  orgIdColumn: { orgId: DrizzleColumn },
  ...additionalConditions: SQL[]
): SQL {
  const conditions = [eq(orgIdColumn.orgId, orgId), ...additionalConditions]
  return conditions.length === 1 ? conditions[0] : and(...conditions)!
}

/**
 * Demo organization ID for development/testing
 * TODO: Remove this once all APIs use session-based orgId
 */
export const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001"

/**
 * Get the current session for the request
 * 
 * @returns Session payload or null if not authenticated
 */
export async function getCurrentSession(): Promise<SessionPayload | null> {
  return getSession()
}

/**
 * Require session and return it
 * Throws error if not authenticated
 * 
 * @returns Session payload
 * @throws Error if not authenticated
 */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession()
  
  if (!session) {
    throw new Error("Authentication required")
  }
  
  return session
}

/**
 * Create an audit logger from the current session
 * Returns null if not authenticated
 * 
 * @returns AuditLogger instance or null
 */
export async function getAuditLogger(): Promise<AuditLogger | null> {
  const session = await getSession()
  
  if (!session) {
    return null
  }
  
  const actor = await extractActor(session.userId, session.email, session.name)
  return createAuditLogger(session.orgId, actor)
}

/**
 * Require an audit logger from the current session
 * Throws error if not authenticated
 * 
 * @returns AuditLogger instance
 * @throws Error if not authenticated
 */
export async function requireAuditLogger(): Promise<AuditLogger> {
  const session = await requireSession()
  const actor = await extractActor(session.userId, session.email, session.name)
  return createAuditLogger(session.orgId, actor)
}
