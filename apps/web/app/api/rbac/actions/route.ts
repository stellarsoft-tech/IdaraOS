/**
 * RBAC Actions API
 * GET - List all available actions (view, create, edit, delete)
 */

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { actions } from "@/lib/db/schema"
import { asc } from "drizzle-orm"

export async function GET() {
  try {
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

