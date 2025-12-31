/**
 * Document Rollout Stats API Route
 * GET /api/docs/rollouts/stats - Get organization-wide rollout statistics
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and, sql, lt } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  documents,
  documentRollouts,
  documentAcknowledgments,
} from "@/lib/db/schema"
import { requireSession } from "@/lib/api/context"

export interface RolloutStats {
  totalRollouts: number
  activeRollouts: number
  totalAcknowledgments: number
  pending: number
  viewed: number
  acknowledged: number
  signed: number
  completed: number
  overdue: number
  completionPercentage: number
}

/**
 * GET /api/docs/rollouts/stats
 * Returns organization-wide rollout statistics
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    // Get rollout counts
    const rolloutCounts = await db
      .select({
        total: sql<number>`count(*)`,
        active: sql<number>`count(*) filter (where ${documentRollouts.isActive} = true)`,
      })
      .from(documentRollouts)
      .innerJoin(documents, and(
        eq(documentRollouts.documentId, documents.id),
        eq(documents.orgId, session.orgId)
      ))
    
    // Get acknowledgment stats
    const ackStats = await db
      .select({
        total: sql<number>`count(*)`,
        pending: sql<number>`count(*) filter (where ${documentAcknowledgments.status} = 'pending')`,
        viewed: sql<number>`count(*) filter (where ${documentAcknowledgments.status} = 'viewed')`,
        acknowledged: sql<number>`count(*) filter (where ${documentAcknowledgments.status} = 'acknowledged')`,
        signed: sql<number>`count(*) filter (where ${documentAcknowledgments.status} = 'signed')`,
      })
      .from(documentAcknowledgments)
      .innerJoin(documentRollouts, eq(documentAcknowledgments.rolloutId, documentRollouts.id))
      .innerJoin(documents, and(
        eq(documentRollouts.documentId, documents.id),
        eq(documents.orgId, session.orgId)
      ))
    
    // Get overdue count (pending/viewed with due date in the past)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const overdueCount = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(documentAcknowledgments)
      .innerJoin(documentRollouts, eq(documentAcknowledgments.rolloutId, documentRollouts.id))
      .innerJoin(documents, and(
        eq(documentRollouts.documentId, documents.id),
        eq(documents.orgId, session.orgId)
      ))
      .where(and(
        sql`${documentAcknowledgments.status} in ('pending', 'viewed')`,
        sql`${documentRollouts.dueDate} < ${today.toISOString()}`
      ))
    
    const totalRollouts = Number(rolloutCounts[0]?.total || 0)
    const activeRollouts = Number(rolloutCounts[0]?.active || 0)
    const totalAcknowledgments = Number(ackStats[0]?.total || 0)
    const pending = Number(ackStats[0]?.pending || 0)
    const viewed = Number(ackStats[0]?.viewed || 0)
    const acknowledged = Number(ackStats[0]?.acknowledged || 0)
    const signed = Number(ackStats[0]?.signed || 0)
    const completed = acknowledged + signed
    const overdue = Number(overdueCount[0]?.count || 0)
    const completionPercentage = totalAcknowledgments > 0 
      ? Math.round((completed / totalAcknowledgments) * 100) 
      : 0
    
    const stats: RolloutStats = {
      totalRollouts,
      activeRollouts,
      totalAcknowledgments,
      pending,
      viewed,
      acknowledged,
      signed,
      completed,
      overdue,
      completionPercentage,
    }
    
    return NextResponse.json({ data: stats })
  } catch (error) {
    console.error("Error fetching rollout stats:", error)
    return NextResponse.json({ error: "Failed to fetch rollout stats" }, { status: 500 })
  }
}

