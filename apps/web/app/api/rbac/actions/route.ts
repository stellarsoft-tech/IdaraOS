/**
 * RBAC Actions API
 * GET - List all available actions (view, create, edit, delete)
 * 
 * SECURITY: Requires authentication. Action list should not be exposed
 * to unauthenticated users as it reveals system structure.
 */

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { actions } from "@/lib/db/schema"
import { asc } from "drizzle-orm"
import { getSession } from "@/lib/auth/session"

export async function GET() {
  try {
    // SECURITY: Require authentication
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }
    const allActions = await db
      .select()
      .from(actions)
      .orderBy(asc(actions.sortOrder), asc(actions.name))

    return NextResponse.json(allActions)
  } catch (error) {
    console.error("Error fetching actions:", error)
    return NextResponse.json(
      { error: "Failed to fetch actions" },
      { status: 500 }
    )
  }
}

