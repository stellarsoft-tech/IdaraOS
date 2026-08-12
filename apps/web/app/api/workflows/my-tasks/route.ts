/**
 * My Workflow Tasks API
 * GET /api/workflows/my-tasks - Steps assigned to the current user
 *
 * A task "belongs to" the current user when either:
 *  - the step's assigned person is the person linked to the user, OR
 *  - the step is directly assigned to the user account (assigneeId)
 *
 * Only steps from non-cancelled instances are returned.
 */

import { NextResponse } from "next/server"
import { and, asc, eq, inArray, ne, or } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  workflowInstances,
  workflowInstanceSteps,
  users,
  persons,
} from "@/lib/db/schema"
import { requirePermission, handleApiError } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"

export async function GET() {
  try {
    const session = await requirePermission(...P.workflows.tasks.view())
    const orgId = session.orgId

    // Resolve the directory person linked to this user account (if any).
    const [currentUser] = await db
      .select({ personId: users.personId })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1)

    const personId = currentUser?.personId ?? null

    // Build the "assigned to me" condition. Always match direct user
    // assignment; additionally match person assignment when the user is
    // linked to a directory person.
    const assignedToMe = personId
      ? or(
          eq(workflowInstanceSteps.assigneeId, session.userId),
          eq(workflowInstanceSteps.assignedPersonId, personId)
        )
      : eq(workflowInstanceSteps.assigneeId, session.userId)

    const rows = await db
      .select({
        step: workflowInstanceSteps,
        instanceName: workflowInstances.name,
        instanceStatus: workflowInstances.status,
        instanceEntityType: workflowInstances.entityType,
        instanceEntityId: workflowInstances.entityId,
      })
      .from(workflowInstanceSteps)
      .innerJoin(
        workflowInstances,
        eq(workflowInstanceSteps.instanceId, workflowInstances.id)
      )
      .where(
        and(
          eq(workflowInstances.orgId, orgId),
          ne(workflowInstances.status, "cancelled"),
          assignedToMe
        )
      )
      .orderBy(asc(workflowInstanceSteps.dueAt), asc(workflowInstanceSteps.orderIndex))

    // Resolve entity names for person-type instances.
    const personEntityIds = [
      ...new Set(
        rows
          .filter((r) => r.instanceEntityType === "person")
          .map((r) => r.instanceEntityId)
          .filter(Boolean) as string[]
      ),
    ]

    const entityNameById = new Map<string, string>()
    if (personEntityIds.length > 0) {
      const entities = await db
        .select({ id: persons.id, name: persons.name })
        .from(persons)
        .where(inArray(persons.id, personEntityIds))
      for (const entity of entities) {
        entityNameById.set(entity.id, entity.name)
      }
    }

    const tasks = rows.map(({ step, instanceName, instanceStatus, instanceEntityType, instanceEntityId }) => ({
      id: step.id,
      instanceId: step.instanceId,
      instanceName,
      instanceStatus,
      entityName:
        instanceEntityType === "person" && instanceEntityId
          ? entityNameById.get(instanceEntityId) ?? null
          : null,
      name: step.name,
      description: step.description ?? undefined,
      status: step.status,
      dueAt: step.dueAt?.toISOString() ?? undefined,
      startedAt: step.startedAt?.toISOString() ?? undefined,
      completedAt: step.completedAt?.toISOString() ?? undefined,
      assigneeId: step.assigneeId ?? undefined,
      assignedPersonId: step.assignedPersonId ?? undefined,
    }))

    return NextResponse.json(tasks)
  } catch (error) {
    const handled = handleApiError(error)
    if (handled) return handled

    console.error("Error fetching my workflow tasks:", error)
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    )
  }
}
