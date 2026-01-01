/**
 * Document Rollouts API Routes
 * GET /api/docs/rollouts - List rollouts
 * POST /api/docs/rollouts - Create rollout
 */

import { NextRequest, NextResponse } from "next/server"
import { eq, and, desc, inArray, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  documents,
  documentRollouts,
  documentAcknowledgments,
  teams,
  roles,
  users,
  persons,
} from "@/lib/db/schema"
import { CreateRolloutSchema } from "@/lib/docs/types"
import { requireSession, getAuditLogger } from "@/lib/api/context"
import { readDocumentContent } from "@/lib/docs/mdx"

/**
 * GET /api/docs/rollouts
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const searchParams = request.nextUrl.searchParams
    const documentId = searchParams.get("documentId")
    const targetType = searchParams.get("targetType")
    const isActive = searchParams.get("isActive")
    
    // Build conditions
    const conditions = []
    
    if (documentId) {
      conditions.push(eq(documentRollouts.documentId, documentId))
    }
    
    if (targetType) {
      conditions.push(eq(documentRollouts.targetType, targetType as typeof documentRollouts.targetType.enumValues[number]))
    }
    
    if (isActive !== null && isActive !== undefined) {
      conditions.push(eq(documentRollouts.isActive, isActive === "true"))
    }
    
    // Query rollouts
    const rolloutsResult = await db
      .select({
        id: documentRollouts.id,
        documentId: documentRollouts.documentId,
        name: documentRollouts.name,
        documentTitle: documents.title,
        documentSlug: documents.slug,
        targetType: documentRollouts.targetType,
        targetId: documentRollouts.targetId,
        requirement: documentRollouts.requirement,
        dueDate: documentRollouts.dueDate,
        isActive: documentRollouts.isActive,
        sendNotification: documentRollouts.sendNotification,
        reminderFrequencyDays: documentRollouts.reminderFrequencyDays,
        createdAt: documentRollouts.createdAt,
        updatedAt: documentRollouts.updatedAt,
      })
      .from(documentRollouts)
      .innerJoin(documents, and(
        eq(documentRollouts.documentId, documents.id),
        eq(documents.orgId, session.orgId)
      ))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(documentRollouts.createdAt))
    
    // Resolve target names
    const teamIds = rolloutsResult.filter((r) => r.targetType === "team" && r.targetId).map((r) => r.targetId!)
    const roleIds = rolloutsResult.filter((r) => r.targetType === "role" && r.targetId).map((r) => r.targetId!)
    const userIds = rolloutsResult.filter((r) => r.targetType === "user" && r.targetId).map((r) => r.targetId!)
    
    const [teamNames, roleNames, userNames] = await Promise.all([
      teamIds.length > 0
        ? db.select({ id: teams.id, name: teams.name }).from(teams).where(inArray(teams.id, teamIds))
        : [],
      roleIds.length > 0
        ? db.select({ id: roles.id, name: roles.name }).from(roles).where(inArray(roles.id, roleIds))
        : [],
      userIds.length > 0
        ? db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, userIds))
        : [],
    ])
    
    const teamNameMap = new Map(teamNames.map((t) => [t.id, t.name]))
    const roleNameMap = new Map(roleNames.map((r) => [r.id, r.name]))
    const userNameMap = new Map(userNames.map((u) => [u.id, u.name]))
    
    // Get acknowledgment counts per rollout
    const rolloutIds = rolloutsResult.map((r) => r.id)
    const ackCounts = rolloutIds.length > 0
      ? await db
          .select({
            rolloutId: documentAcknowledgments.rolloutId,
            total: sql<number>`count(*)`,
            acknowledged: sql<number>`count(*) filter (where ${documentAcknowledgments.status} in ('acknowledged', 'signed'))`,
          })
          .from(documentAcknowledgments)
          .where(inArray(documentAcknowledgments.rolloutId, rolloutIds))
          .groupBy(documentAcknowledgments.rolloutId)
      : []
    
    const ackCountMap = new Map(ackCounts.map((a) => [a.rolloutId, { total: a.total, acknowledged: a.acknowledged }]))
    
    // Build response
    const data = rolloutsResult.map((rollout) => {
      let targetName: string | null = null
      
      switch (rollout.targetType) {
        case "organization":
          targetName = "Entire Organization"
          break
        case "team":
          targetName = rollout.targetId ? teamNameMap.get(rollout.targetId) || null : null
          break
        case "role":
          targetName = rollout.targetId ? roleNameMap.get(rollout.targetId) || null : null
          break
        case "user":
          targetName = rollout.targetId ? userNameMap.get(rollout.targetId) || null : null
          break
      }
      
      const ackCount = ackCountMap.get(rollout.id) || { total: 0, acknowledged: 0 }
      
      return {
        ...rollout,
        targetName,
        acknowledgedCount: ackCount.acknowledged,
        targetCount: ackCount.total,
      }
    })
    
    return NextResponse.json({ data })
  } catch (error) {
    console.error("Error fetching rollouts:", error)
    return NextResponse.json({ error: "Failed to fetch rollouts" }, { status: 500 })
  }
}

/**
 * POST /api/docs/rollouts
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const body = await request.json()
    
    // Validate request body
    const parseResult = CreateRolloutSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }
    
    const data = parseResult.data
    
    // Verify document exists and belongs to org, and get version/content
    const [doc] = await db
      .select({ 
        id: documents.id, 
        slug: documents.slug,
        currentVersion: documents.currentVersion,
      })
      .from(documents)
      .where(and(eq(documents.id, data.documentId), eq(documents.orgId, session.orgId)))
      .limit(1)
    
    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }
    
    // Get current document content to snapshot
    const contentSnapshot = await readDocumentContent(doc.slug)
    
    // Validate target exists if specified
    if (data.targetType !== "organization" && data.targetId) {
      let targetExists = false
      
      switch (data.targetType) {
        case "team":
          const [team] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, data.targetId)).limit(1)
          targetExists = !!team
          break
        case "role":
          const [role] = await db.select({ id: roles.id }).from(roles).where(eq(roles.id, data.targetId)).limit(1)
          targetExists = !!role
          break
        case "user":
          const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, data.targetId)).limit(1)
          targetExists = !!user
          break
      }
      
      if (!targetExists) {
        return NextResponse.json({ error: `Target ${data.targetType} not found` }, { status: 404 })
      }
    }
    
    // Create rollout with version snapshot
    const [created] = await db
      .insert(documentRollouts)
      .values({
        documentId: data.documentId,
        name: data.name,
        versionAtRollout: doc.currentVersion,
        contentSnapshot: contentSnapshot,
        targetType: data.targetType,
        targetId: data.targetType === "organization" ? null : data.targetId,
        requirement: data.requirement,
        dueDate: data.dueDate,
        isActive: data.isActive,
        sendNotification: data.sendNotification,
        reminderFrequencyDays: data.reminderFrequencyDays,
        createdById: session.userId,
      })
      .returning()
    
    // Create acknowledgment records for target users
    await createAcknowledgmentsForRollout(created.id, data.documentId, data.targetType, data.targetId || null, session.orgId)
    
    // Audit log
    const audit = await getAuditLogger()
    if (audit) {
      await audit.logCreate("docs.rollouts", "rollout", {
        id: created.id,
        documentId: data.documentId,
        targetType: data.targetType,
        targetId: data.targetId,
      })
    }
    
    return NextResponse.json({ data: created }, { status: 201 })
  } catch (error) {
    console.error("Error creating rollout:", error)
    return NextResponse.json({ error: "Failed to create rollout" }, { status: 500 })
  }
}

/**
 * Helper function to create acknowledgment records for a rollout
 */
async function createAcknowledgmentsForRollout(
  rolloutId: string,
  documentId: string,
  targetType: string,
  targetId: string | null,
  orgId: string
) {
  let userRecords: { userId: string; personId: string | null }[] = []
  
  switch (targetType) {
    case "organization":
      // All users in org
      const orgUsers = await db
        .select({ id: users.id, personId: users.personId })
        .from(users)
        .where(eq(users.orgId, orgId))
      userRecords = orgUsers.map((u) => ({ userId: u.id, personId: u.personId }))
      break
      
    case "team":
      // Users in team (via person -> team relationship)
      if (targetId) {
        const teamMembers = await db
          .select({ userId: users.id, personId: persons.id })
          .from(persons)
          .innerJoin(users, eq(users.personId, persons.id))
          .where(and(eq(persons.teamId, targetId), eq(persons.orgId, orgId)))
        userRecords = teamMembers.map((m) => ({ userId: m.userId, personId: m.personId }))
      }
      break
      
    case "role":
      // Users with this role (via RBAC user_roles)
      if (targetId) {
        const roleMembers = await db
          .select({ id: users.id, personId: users.personId })
          .from(users)
          .where(eq(users.orgId, orgId))
        // Note: In a full implementation, you'd join with user_roles table
        // For now, we'll create acknowledgments for all users
        userRecords = roleMembers.map((u) => ({ userId: u.id, personId: u.personId }))
      }
      break
      
    case "user":
      // Specific user
      if (targetId) {
        const [user] = await db
          .select({ id: users.id, personId: users.personId })
          .from(users)
          .where(eq(users.id, targetId))
          .limit(1)
        if (user) {
          userRecords = [{ userId: user.id, personId: user.personId }]
        }
      }
      break
  }
  
  // Create acknowledgment records
  if (userRecords.length > 0) {
    await db.insert(documentAcknowledgments).values(
      userRecords.map((u) => ({
        documentId,
        rolloutId,
        userId: u.userId,
        personId: u.personId,
        status: "pending" as const,
      }))
    )
  }
}

