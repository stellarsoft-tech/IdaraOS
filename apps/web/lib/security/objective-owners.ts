import { and, eq, inArray } from "drizzle-orm"

import { db } from "@/lib/db"
import { persons, users } from "@/lib/db/schema"

const assignableUserStatuses = ["active", "invited"] as const

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replaceAll(/[^\w\s-]/g, "")
    .replaceAll(/[\s_-]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
}

async function buildUniquePersonSlug(name: string): Promise<string> {
  const baseSlug = slugify(name) || "user"
  let slug = baseSlug
  let counter = 1

  while (true) {
    const [existing] = await db
      .select({ id: persons.id })
      .from(persons)
      .where(eq(persons.slug, slug))
      .limit(1)

    if (!existing) return slug

    counter += 1
    slug = `${baseSlug}-${counter}`
  }
}

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

/**
 * The running database stores objective.owner_id as a People person FK.
 * The UI selects platform users, so translate the selected user to its linked
 * person before writes. Existing person IDs are accepted for compatibility.
 */
export async function resolveObjectiveOwnerPersonId(
  orgId: string,
  ownerId: string | null | undefined
): Promise<{ ownerPersonId: string | null; error?: string }> {
  if (!ownerId) return { ownerPersonId: null }

  const [user] = await db
    .select({
      id: users.id,
      personId: users.personId,
      name: users.name,
      email: users.email,
      avatar: users.avatar,
    })
    .from(users)
    .where(and(
      eq(users.id, ownerId),
      eq(users.orgId, orgId),
      inArray(users.status, [...assignableUserStatuses])
    ))
    .limit(1)

  if (user) {
    if (user.personId) {
      const [linkedPerson] = await db
        .select({ id: persons.id })
        .from(persons)
        .where(and(
          eq(persons.id, user.personId),
          eq(persons.orgId, orgId)
        ))
        .limit(1)

      if (linkedPerson) return { ownerPersonId: linkedPerson.id }
    }

    const [personWithEmail] = await db
      .select({ id: persons.id })
      .from(persons)
      .where(and(
        eq(persons.email, user.email),
        eq(persons.orgId, orgId)
      ))
      .limit(1)

    if (personWithEmail) {
      await db
        .update(users)
        .set({
          personId: personWithEmail.id,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id))

      return { ownerPersonId: personWithEmail.id }
    }

    const slug = await buildUniquePersonSlug(user.name)
    const today = new Date().toISOString().split("T")[0]

    const [createdPerson] = await db
      .insert(persons)
      .values({
        orgId,
        slug,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        status: "active",
        startDate: today,
        source: "manual",
      })
      .returning({ id: persons.id })

    await db
      .update(users)
      .set({
        personId: createdPerson.id,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))

    return { ownerPersonId: createdPerson.id }
  }

  const [person] = await db
    .select({ id: persons.id })
    .from(persons)
    .where(and(
      eq(persons.id, ownerId),
      eq(persons.orgId, orgId)
    ))
    .limit(1)

  if (person) return { ownerPersonId: person.id }

  return {
    ownerPersonId: null,
    error: "Owner must be an active platform user linked to a People profile.",
  }
}
