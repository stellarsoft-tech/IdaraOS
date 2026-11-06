"use client"

import { Protected } from "@/components/primitives/protected"
import { VaultAdmin } from "@/components/security/vault/vault-admin"

export default function VaultAdminPage() {
  return (
    <Protected module="security.vault" action="view" showDenied>
      <VaultAdmin />
    </Protected>
  )
}
