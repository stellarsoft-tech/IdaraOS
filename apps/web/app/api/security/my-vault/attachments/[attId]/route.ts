/**
 * One attachment
 * GET    /api/security/my-vault/attachments/[attId] -> download the decrypted file (audited)
 * DELETE /api/security/my-vault/attachments/[attId] -> delete it
 */

import { NextRequest, NextResponse } from "next/server"
import { requirePermission, handleApiError, getAuditLogger } from "@/lib/api/context"
import { P } from "@/lib/rbac/resources"
import { deleteAttachment, getAttachment } from "@/lib/security/vault-attachment-server"

interface RouteContext {
  params: Promise<{ attId: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.myVault.view())
    const { attId } = await context.params
    const file = await getAttachment(session.orgId, session.userId, attId)
    if (!file) return NextResponse.json({ error: "Attachment not found" }, { status: 404 })

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.my-vault",
        action: "vault_attachment_downloaded",
        entityType: "vault_attachment",
        entityId: attId,
        description: `Downloaded attachment "${file.filename}"`,
      })
    }

    const encoded = encodeURIComponent(file.filename)
    return new NextResponse(new Uint8Array(file.bytes), {
      headers: {
        "Content-Type": file.contentType || "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encoded}`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error downloading attachment:", error)
    return NextResponse.json({ error: "Failed to download the file" }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(...P.security.myVault.edit())
    const { attId } = await context.params
    const ok = await deleteAttachment(session.orgId, session.userId, attId)
    if (!ok) return NextResponse.json({ error: "Attachment not found" }, { status: 404 })

    const audit = await getAuditLogger()
    if (audit) {
      await audit.log({
        module: "security.my-vault",
        action: "vault_attachment_deleted",
        entityType: "vault_attachment",
        entityId: attId,
        description: "Deleted a vault attachment",
      })
    }
    return NextResponse.json({ data: { id: attId } })
  } catch (error) {
    const apiError = handleApiError(error)
    if (apiError) return apiError
    console.error("Error deleting attachment:", error)
    return NextResponse.json({ error: "Failed to delete the attachment" }, { status: 500 })
  }
}
