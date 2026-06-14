import { and, eq, inArray } from "drizzle-orm"

import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"

const assignableUserStatuses = ["active", "invited"] as const

/** Returns true when ownerId is null or references an assignable user in the org. */
export async function isAssignableObjectiveOwner(
  orgId: string,
  ownerId: string | null | undefined
): Promise<boolean> {
  if (!ownerId) return true

  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(
      eq(users.id, ownerId),
      eq(users.orgId, orgId),
      inArray(users.status, [...assignableUserStatuses])
    ))
    .limit(1)

  return !!owner
}
