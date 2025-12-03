/**
 * Audit Logs Export API
 * GET /api/audit/logs/export - Export audit logs as CSV or JSON
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and, gte, lte, ilike, or, desc, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { auditLogs } from "@/lib/db/schema"
import { requireOrgId } from "@/lib/api/context"

export async function GET(request: NextRequest) {
  try {
    const orgId = await requireOrgId()
    const searchParams = request.nextUrl.searchParams
    
    // Parse query parameters
    const format = searchParams.get("format") ?? "json"
    const moduleFilter = searchParams.get("module")
    const modulePrefix = searchParams.get("modulePrefix")
    const action = searchParams.get("action")
    const entityType = searchParams.get("entityType")
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const search = searchParams.get("search")
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "1000"), 10000)
    
    // Build conditions
    const conditions = [eq(auditLogs.orgId, orgId)]
    
    if (moduleFilter) {
      conditions.push(eq(auditLogs.module, moduleFilter))
    }
    
    if (modulePrefix) {
      conditions.push(sql`${auditLogs.module} LIKE ${modulePrefix + "%"}`)
    }
    
    if (action) {
      conditions.push(eq(auditLogs.action, action))
    }
    
    if (entityType) {
      conditions.push(eq(auditLogs.entityType, entityType))
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
    
    // Fetch logs
    const logs = await db
      .select({
        id: auditLogs.id,
        module: auditLogs.module,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        entityName: auditLogs.entityName,
        actorEmail: auditLogs.actorEmail,
        actorName: auditLogs.actorName,
        actorIp: auditLogs.actorIp,
        description: auditLogs.description,
        changedFields: auditLogs.changedFields,
        timestamp: auditLogs.timestamp,
      })
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit)
    
    // Format as CSV or JSON
    if (format === "csv") {
      const headers = [
        "Timestamp",
        "Module",
        "Action",
        "Entity Type",
        "Entity ID",
        "Entity Name",
        "Actor Email",
        "Actor Name",
        "Actor IP",
        "Changed Fields",
        "Description",
      ]
      
      const rows = logs.map(log => [
        log.timestamp.toISOString(),
        log.module,
        log.action,
        log.entityType,
        log.entityId ?? "",
        log.entityName ?? "",
        log.actorEmail,
        log.actorName ?? "",
        log.actorIp ?? "",
        log.changedFields?.join("; ") ?? "",
        log.description ?? "",
      ])
      
      const csv = [
        headers.join(","),
        ...rows.map(row => 
          row.map(cell => {
            // Escape double quotes and wrap in quotes if contains comma
            const stringCell = String(cell)
            if (stringCell.includes(",") || stringCell.includes('"') || stringCell.includes("\n")) {
              return `"${stringCell.replace(/"/g, '""')}"`
            }
            return stringCell
          }).join(",")
        ),
      ].join("\n")
      
      const timestamp = new Date().toISOString().split("T")[0]
      const filename = `audit-logs-${timestamp}.csv`
      
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      })
    }
    
    // Default to JSON
    const jsonLogs = logs.map(log => ({
      ...log,
      timestamp: log.timestamp.toISOString(),
    }))
    
    const timestamp = new Date().toISOString().split("T")[0]
    const filename = `audit-logs-${timestamp}.json`
    
    return new NextResponse(JSON.stringify(jsonLogs, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("Error exporting audit logs:", error)
    return NextResponse.json(
      { error: "Failed to export audit logs" },
      { status: 500 }
    )
  }
}
