/**
 * Assignable owners for security objectives
 * Returns active platform users (not directory-only people records)
 */

import { NextResponse } from "next/server"
import { and, asc, eq, inArray } from "drizzle-orm"

import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { getSession } from "@/lib/auth/session"

const assignableUserStatuses = ["active", "invited"] as const

export async function GET() {
  try {
    const session = await getSession()
    if (!session?.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const assignableUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        status: users.status,
      })
      .from(users)
      .where(and(
        eq(users.orgId, session.orgId),
        inArray(users.status, [...assignableUserStatuses])
      ))
      .orderBy(asc(users.name))

    return NextResponse.json({ data: assignableUsers })
  } catch (error) {
    console.error("Error fetching assignable objective owners:", error)
    return NextResponse.json(
      { error: "Failed to fetch assignable owners" },
      { status: 500 }
    )
  }
}
