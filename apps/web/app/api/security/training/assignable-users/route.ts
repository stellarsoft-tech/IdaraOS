/**
 * Security Training Assignable Users API
 * GET /api/security/training/assignable-users - Users an admin can assign courses to
 */

import { NextResponse } from "next/server"
import { and, asc, eq, notInArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { requirePermission, handleApiError } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"

export async function GET() {
  try {
    const session = await requirePermission(...P.security.training.create())

    const rows = await db
      .select({ id: users.id, name: users.name, email: users.email, status: users.status })
      .from(users)
      .where(and(
        eq(users.orgId, session.orgId),
        notInArray(users.status, ["suspended", "deactivated"])
      ))
      .orderBy(asc(users.name))

    return NextResponse.json({ data: rows })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error fetching assignable users:", error)
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }
}
