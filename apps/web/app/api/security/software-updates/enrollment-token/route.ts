/**
 * Updater Enrollment Token API
 * POST /api/security/software-updates/enrollment-token - Create (or replace) the token the Intune package uses.
 * The token is returned once; only its hash is stored. Enrolled devices keep working after a replace.
 */

import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { softwareUpdateSettings } from "@/lib/db/schema"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { getSoftwareUpdateSettings } from "@/lib/security/software-server"
import { generateSecret, hashSecret } from "@/lib/security/software-updates-server"

export async function POST() {
  try {
    const session = await requirePermission(...P.security.softwareUpdates.edit())
    const existing = await getSoftwareUpdateSettings(session.orgId)

    const token = generateSecret("iue")
    const now = new Date()
    await db
      .update(softwareUpdateSettings)
      .set({
        enrollmentTokenHash: hashSecret(token),
        enrollmentTokenHint: token.slice(-4),
        enrollmentTokenCreatedAt: now,
        updatedById: session.userId,
        updatedAt: now,
      })
      .where(eq(softwareUpdateSettings.id, existing.id))

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.software-updates",
        action: existing.enrollmentTokenHash ? "rotate_enrollment_token" : "create_enrollment_token",
        entityType: "software_update_settings",
        entityId: existing.id,
        description: existing.enrollmentTokenHash
          ? "Replaced the updater enrollment token"
          : "Created the updater enrollment token",
      })
    }

    return NextResponse.json({ data: { token, createdAt: now } }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error creating enrollment token:", error)
    return NextResponse.json({ error: "Failed to create the enrollment token" }, { status: 500 })
  }
}
