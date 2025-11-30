/**
 * API Context Utilities
 * 
 * Provides centralized helpers for multi-tenant API routes:
 * - Get organization ID from authenticated session
 * - Build queries with automatic organization filtering
 */

import { NextRequest } from "next/server"
import { getSession } from "@/lib/auth/session"
import { eq, and, type SQL } from "drizzle-orm"

/**
 * Get organization ID from authenticated session
 * 
 * @param request - Next.js request object
 * @returns Organization ID or null if not authenticated
 * @throws Error if authentication is required but missing
 */
export async function getOrgIdFromSession(request?: NextRequest): Promise<string | null> {
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
 * @param request - Next.js request object
 * @returns Organization ID
 * @throws Error if not authenticated
 */
export async function requireOrgId(request?: NextRequest): Promise<string> {
  const orgId = await getOrgIdFromSession(request)
  
  if (!orgId) {
    throw new Error("Authentication required")
  }
  
  return orgId
}

/**
 * Build a query condition that filters by organization ID
 * 
 * @param orgId - Organization ID to filter by
 * @param orgIdColumn - The column to filter on (e.g., users.orgId, persons.orgId)
 * @returns Drizzle SQL condition
 */
export function orgFilter<T>(orgId: string, orgIdColumn: { orgId: any }): SQL {
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
export function orgFilterWith<T>(
  orgId: string,
  orgIdColumn: { orgId: any },
  ...additionalConditions: SQL[]
): SQL {
  const conditions = [eq(orgIdColumn.orgId, orgId), ...additionalConditions]
  return conditions.length === 1 ? conditions[0] : and(...conditions)
}

/**
 * Demo organization ID for development/testing
 * TODO: Remove this once all APIs use session-based orgId
 */
export const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001"
