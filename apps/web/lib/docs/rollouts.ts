import { and, eq, inArray } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  documentAcknowledgments,
  documentRollouts,
  persons,
  userRoles,
  users,
} from "@/lib/db/schema"
import type { RolloutTargetType } from "@/lib/docs/types"

export interface RolloutTargetUser {
  userId: string
  personId: string | null
  name: string
  email: string
}

/**
 * Resolve platform users included in a rollout target (org, team, role, or individual user).
 */
export async function resolveRolloutTargetUsers(
  targetType: RolloutTargetType,
  targetId: string | null,
  orgId: string
): Promise<RolloutTargetUser[]> {
  let rows: RolloutTargetUser[] = []

  switch (targetType) {
    case "organization": {
      const orgUsers = await db
        .select({
          userId: users.id,
          personId: users.personId,
          name: users.name,
          email: users.email,
        })
        .from(users)
        .where(eq(users.orgId, orgId))
      rows = orgUsers
      break
    }

    case "team": {
      if (!targetId) break
      const teamMembers = await db
        .select({
          userId: users.id,
          personId: persons.id,
          name: users.name,
          email: users.email,
        })
        .from(persons)
        .innerJoin(users, eq(users.personId, persons.id))
        .where(and(eq(persons.teamId, targetId), eq(persons.orgId, orgId)))
      rows = teamMembers
      break
    }

    case "role": {
      if (!targetId) break
      const roleMembers = await db
        .select({
          userId: users.id,
          personId: users.personId,
          name: users.name,
          email: users.email,
        })
        .from(userRoles)
        .innerJoin(users, eq(userRoles.userId, users.id))
        .where(and(eq(userRoles.roleId, targetId), eq(users.orgId, orgId)))
      rows = roleMembers
      break
    }

    case "user": {
      if (!targetId) break
      const [user] = await db
        .select({
          userId: users.id,
          personId: users.personId,
          name: users.name,
          email: users.email,
        })
        .from(users)
        .where(and(eq(users.id, targetId), eq(users.orgId, orgId)))
        .limit(1)
      if (user) {
        rows = [user]
      }
      break
    }
  }

  const seen = new Set<string>()
  return rows.filter((row) => {
    if (seen.has(row.userId)) return false
    seen.add(row.userId)
    return true
  })
}

/**
 * Users who already have an active rollout acknowledgment for the same document version.
 */
export async function findUsersAlreadyAssignedToDocumentVersion(
  documentId: string,
  version: string,
  userIds: string[]
): Promise<RolloutTargetUser[]> {
  if (userIds.length === 0) return []

  return db
    .selectDistinct({
      userId: documentAcknowledgments.userId,
      personId: documentAcknowledgments.personId,
      name: users.name,
      email: users.email,
    })
    .from(documentAcknowledgments)
    .innerJoin(
      documentRollouts,
      and(
        eq(documentAcknowledgments.rolloutId, documentRollouts.id),
        eq(documentRollouts.isActive, true),
        eq(documentRollouts.versionAtRollout, version)
      )
    )
    .innerJoin(users, eq(documentAcknowledgments.userId, users.id))
    .where(
      and(
        eq(documentAcknowledgments.documentId, documentId),
        inArray(documentAcknowledgments.userId, userIds)
      )
    )
}

export function partitionRolloutTargetUsers(
  targetUsers: RolloutTargetUser[],
  alreadyAssignedUsers: RolloutTargetUser[]
) {
  const assignedIds = new Set(alreadyAssignedUsers.map((user) => user.userId))
  const newUsers = targetUsers.filter((user) => !assignedIds.has(user.userId))

  return { newUsers, alreadyAssignedUsers }
}

export async function createRolloutAcknowledgments(
  rolloutId: string,
  documentId: string,
  targetUsers: RolloutTargetUser[]
) {
  if (targetUsers.length === 0) return

  await db.insert(documentAcknowledgments).values(
    targetUsers.map((user) => ({
      documentId,
      rolloutId,
      userId: user.userId,
      personId: user.personId,
      status: "pending" as const,
    }))
  )
}
