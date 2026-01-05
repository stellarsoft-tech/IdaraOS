/**
 * RBAC Modules API
 * GET - List all available modules
 * 
 * SECURITY: Requires authentication. Module list should not be exposed
 * to unauthenticated users as it reveals system structure.
 */

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { modules } from "@/lib/db/schema"
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
    const allModules = await db
      .select()
      .from(modules)
      .orderBy(asc(modules.sortOrder), asc(modules.name))

    return NextResponse.json(allModules)
  } catch (error) {
    console.error("Error fetching modules:", error)
    return NextResponse.json(
      { error: "Failed to fetch modules" },
      { status: 500 }
    )
  }
}

