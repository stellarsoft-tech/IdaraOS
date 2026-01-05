/**
 * Audit Logs API
 * GET /api/audit/logs - List audit logs with filtering
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and, gte, lte, ilike, or, desc, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { auditLogs } from "@/lib/db/schema"
import { requireOrgId } from "@/lib/api/context"
import type { AuditLogEntry } from "@/lib/audit"

// Transform DB record to API response
function toApiResponse(record: typeof auditLogs.$inferSelect): AuditLogEntry {
  return {
    id: record.id,
    module: record.module,
    action: record.action,
    entityType: record.entityType,
    entityId: record.entityId ?? null,
    entityName: record.entityName ?? null,
    actorId: record.actorId ?? null,
    actorEmail: record.actorEmail,
    actorName: record.actorName ?? null,
    actorIp: record.actorIp ?? null,
    previousValues: record.previousValues as Record<string, unknown> | null,
    newValues: record.newValues as Record<string, unknown> | null,
    changedFields: record.changedFields ?? null,
    description: record.description ?? null,
    timestamp: record.timestamp.toISOString(),
  }
}

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Require authentication via session
    let orgId: string
    try {
      orgId = await requireOrgId()
    } catch (error) {
      if (error instanceof Error && error.message === "Authentication required") {
        return NextResponse.json(
          { error: "Not authenticated" },
          { status: 401 }
        )
      }
      throw error
    }
    const searchParams = request.nextUrl.searchParams
    
    // Parse query parameters
    const moduleFilter = searchParams.get("module")
    const modulePrefix = searchParams.get("modulePrefix")
    const action = searchParams.get("action")
    const entityType = searchParams.get("entityType")
    const entityId = searchParams.get("entityId")
    const actorId = searchParams.get("actorId")
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const search = searchParams.get("search")
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100)
    const offset = parseInt(searchParams.get("offset") ?? "0")
    
    // Build conditions
    const conditions = [eq(auditLogs.orgId, orgId)]
    
    if (moduleFilter) {
      conditions.push(eq(auditLogs.module, moduleFilter))
    }
    
    if (modulePrefix) {
      // Match modules starting with prefix (e.g., "people." matches "people.directory", "people.auditlog")
      conditions.push(sql`${auditLogs.module} LIKE ${modulePrefix + "%"}`)
    }
    
    if (action) {
      conditions.push(eq(auditLogs.action, action))
    }
    
    if (entityType) {
      conditions.push(eq(auditLogs.entityType, entityType))
    }
    
    if (entityId) {
      conditions.push(eq(auditLogs.entityId, entityId))
    }
    
    if (actorId) {
      conditions.push(eq(auditLogs.actorId, actorId))
    }
    
    if (from) {
      conditions.push(gte(auditLogs.timestamp, new Date(from)))
    }
    
    if (to) {
      conditions.push(lte(auditLogs.timestamp, new Date(to)))
    }
    
    if (search) {
      conditions.push(
        or(
          ilike(auditLogs.entityName, `%${search}%`),
          ilike(auditLogs.actorEmail, `%${search}%`),
          ilike(auditLogs.actorName, `%${search}%`),
          ilike(auditLogs.description, `%${search}%`)
        )!
      )
    }
    
    // Fetch logs with pagination
    const [logs, countResult] = await Promise.all([
      db
        .select()
        .from(auditLogs)
        .where(and(...conditions))
        .orderBy(desc(auditLogs.timestamp))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(auditLogs)
        .where(and(...conditions)),
    ])
    
    const total = countResult[0]?.count ?? 0
    
    return NextResponse.json({
      logs: logs.map(toApiResponse),
      total,
      limit,
      offset,
    })
  } catch (error) {
    console.error("Error fetching audit logs:", error)
    return NextResponse.json(
      { error: "Failed to fetch audit logs" },
      { status: 500 }
    )
  }
}
