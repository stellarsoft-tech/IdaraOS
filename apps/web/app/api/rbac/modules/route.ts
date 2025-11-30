/**
 * RBAC Modules API
 * GET - List all available modules
 */

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { modules } from "@/lib/db/schema"
import { asc } from "drizzle-orm"

export async function GET() {
  try {
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

