/**
 * Attachments on an item
 * GET  /api/security/my-vault/items/[id]/attachments -> list (metadata)
 * POST /api/security/my-vault/items/[id]/attachments -> upload a file (multipart "file")
 */

import { NextRequest, NextResponse } from "next/server"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { addAttachment, listAttachments, MAX_ATTACHMENT_BYTES } from "@/lib/security/vault-attachment-server"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.myVault.view())
    const { id } = await context.params
    const list = await listAttachments(session.orgId, session.userId, id)
    if (list === null) return NextResponse.json({ error: "Item not found" }, { status: 404 })
    return NextResponse.json({ data: list })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error listing attachments:", error)
    return NextResponse.json({ error: "Failed to load attachments" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.myVault.edit())
    const { id } = await context.params
    const form = await request.formData()
    const file = form.get("file")
    if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 })
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json({ error: `File is too large (max ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB)` }, { status: 400 })
    }
    const bytes = Buffer.from(await file.arrayBuffer())
    const attachment = await addAttachment(session.orgId, session.userId, id, {
      filename: file.name || "file",
      contentType: file.type || null,
      bytes,
    })
    if (!attachment) return NextResponse.json({ error: "Item not found or not editable" }, { status: 404 })

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.my-vault",
        action: "vault_attachment_added",
        entityType: "vault_item",
        entityId: id,
        description: `Added attachment "${attachment.filename}"`,
      })
    }
    return NextResponse.json({ data: attachment }, { status: 201 })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error uploading attachment:", error)
    return NextResponse.json({ error: "Failed to upload the file" }, { status: 500 })
  }
}
