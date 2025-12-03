/**
 * Single Audit Log API
 * GET /api/audit/logs/[id] - Get single audit log entry details
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { db } from "@/lib/db"
import { auditLogs, users } from "@/lib/db/schema"
import { requireOrgId } from "@/lib/api/context"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const orgId = await requireOrgId()
    const { id } = await context.params
    
    // Fetch the audit log entry
    const log = await db.query.auditLogs.findFirst({
      where: and(
        eq(auditLogs.id, id),
        eq(auditLogs.orgId, orgId)
      ),
    })
    
    if (!log) {
      return NextResponse.json(
        { error: "Audit log not found" },
        { status: 404 }
      )
    }
    
    // Fetch actor details if available
    let actor = null
    if (log.actorId) {
      actor = await db.query.users.findFirst({
        where: eq(users.id, log.actorId),
        columns: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          status: true,
        },
      })
    }
    
    return NextResponse.json({
      id: log.id,
      module: log.module,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId ?? null,
      entityName: log.entityName ?? null,
      actorId: log.actorId ?? null,
      actorEmail: log.actorEmail,
      actorName: log.actorName ?? null,
      actorIp: log.actorIp ?? null,
      actorUserAgent: log.actorUserAgent ?? null,
      previousValues: log.previousValues as Record<string, unknown> | null,
      newValues: log.newValues as Record<string, unknown> | null,
      changedFields: log.changedFields ?? null,
      description: log.description ?? null,
      metadata: log.metadata as Record<string, unknown> | null,
      timestamp: log.timestamp.toISOString(),
      actor: actor ? {
        id: actor.id,
        name: actor.name,
        email: actor.email,
        avatar: actor.avatar,
        status: actor.status,
      } : null,
    })
  } catch (error) {
    console.error("Error fetching audit log:", error)
    return NextResponse.json(
      { error: "Failed to fetch audit log" },
      { status: 500 }
    )
  }
}
