/**
 * API Context Utilities
 * 
 * Provides centralized helpers for multi-tenant API routes:
 * - Get organization ID from authenticated session
 * - Build queries with automatic organization filtering
 * - Create audit loggers from session context
 * - Authorization checks with RBAC permissions
 */

import { getSession, type SessionPayload } from "@/lib/auth/session"
import { eq, and, type SQL } from "drizzle-orm"
import { createAuditLogger, extractActor, type AuditLogger } from "@/lib/audit"
import { checkUserPermission } from "@/lib/rbac/server"
import { NextResponse } from "next/server"

// =============================================================================
// Custom Error Classes for API Error Handling
// =============================================================================

/**
 * Error thrown when authentication is required but missing
 */
export class AuthenticationError extends Error {
  constructor(message: string = "Authentication required") {
    super(message)
    this.name = "AuthenticationError"
  }
}

/**
 * Error thrown when user lacks required permissions
 */
export class AuthorizationError extends Error {
  constructor(message: string = "Permission denied") {
    super(message)
    this.name = "AuthorizationError"
  }
}

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

// =============================================================================
// Authorization Helpers
// =============================================================================

/**
 * Require specific permission from authenticated session
 * Combines authentication and authorization in one call
 * 
 * Uses database-driven RBAC: queries the user's roles and their associated
 * permissions to check authorization dynamically.
 * 
 * @param resource - The module slug to check permission for (e.g., "people.person", "assets.inventory")
 * @param action - The action slug to check (e.g., "view", "create", "edit", "delete")
 * @returns Session payload if authorized
 * @throws AuthenticationError if not authenticated
 * @throws AuthorizationError if not authorized
 * 
 * @example
 * // In a route handler:
 * const session = await requirePermission("people.person", "edit")
 * // Now you can use session.orgId, session.userId, etc.
 */
export async function requirePermission(
  resource: string,
  action: string = "view"
): Promise<SessionPayload> {
  const session = await getSession()
  
  if (!session) {
    throw new AuthenticationError()
  }
  
  // Dynamic database permission check
  const hasPermission = await checkUserPermission(session.userId, resource, action)
  
  if (!hasPermission) {
    throw new AuthorizationError(`Permission denied: ${resource}:${action}`)
  }
  
  return session
}

/**
 * Handle API errors and return appropriate HTTP responses
 * Use this in catch blocks to convert errors to proper responses
 * 
 * @param error - The error to handle
 * @returns NextResponse with appropriate status code, or null if error should be re-thrown
 * 
 * @example
 * try {
 *   const session = await requirePermission("people.person", "write")
 *   // ... route logic
 * } catch (error) {
 *   const response = handleApiError(error)
 *   if (response) return response
 *   // Handle other errors
 *   console.error("Error:", error)
 *   return NextResponse.json({ error: "Internal error" }, { status: 500 })
 * }
 */
export function handleApiError(error: unknown): NextResponse | null {
  if (error instanceof AuthenticationError) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    )
  }
  
  if (error instanceof AuthorizationError) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    )
  }
  
  // Legacy error handling for backwards compatibility
  if (error instanceof Error && error.message === "Authentication required") {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    )
  }
  
  return null // Let caller handle other errors
}
