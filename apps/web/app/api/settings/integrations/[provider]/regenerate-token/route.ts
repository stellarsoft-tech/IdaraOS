/**
 * Regenerate SCIM Token API
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { integrations } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import crypto from "crypto"

const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001"
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "demo-key-change-in-production-32c"

function encrypt(text: string): string {
  const algorithm = "aes-256-cbc"
  const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32)
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(algorithm, key, iv)
  let encrypted = cipher.update(text, "utf8", "hex")
  encrypted += cipher.final("hex")
  return iv.toString("hex") + ":" + encrypted
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params

    const existing = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.orgId, DEMO_ORG_ID),
          eq(integrations.provider, provider)
        )
      )
      .limit(1)

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Integration not found" },
        { status: 404 }
      )
    }

    // Generate new token
    const newToken = `scim_${crypto.randomBytes(24).toString("hex")}`

    await db
      .update(integrations)
      .set({
        scimTokenEncrypted: encrypt(newToken),
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, existing[0].id))

    return NextResponse.json({
      scimToken: newToken,
      message: "SCIM token regenerated successfully",
    })
  } catch (error) {
    console.error("Error regenerating token:", error)
    return NextResponse.json(
      { error: "Failed to regenerate token" },
      { status: 500 }
    )
  }
}

