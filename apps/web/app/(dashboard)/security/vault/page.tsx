"use client"

import { Protected } from "@/components/primitives/protected"
import { VaultView } from "@/components/security/vault/vault-view"

export default function VaultPage() {
  return (
    <Protected module="security.my-vault" action="view" showDenied>
      <VaultView />
    </Protected>
  )
}
