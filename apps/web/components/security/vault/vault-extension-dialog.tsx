"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { Copy, Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useCreateExtensionToken, useExtensionTokens, useRevokeExtensionToken } from "@/lib/api/security-my-vault"

export function VaultExtensionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const tokens = useExtensionTokens()
  const create = useCreateExtensionToken()
  const revoke = useRevokeExtensionToken()
  const [newToken, setNewToken] = useState<string | null>(null)

  const generate = async () => {
    try {
      const res = await create.mutateAsync(undefined)
      setNewToken(res.data.token)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create the token")
    }
  }

  const copy = async (v: string) => {
    try {
      await navigator.clipboard.writeText(v)
      toast.success("Token copied")
    } catch {
      toast.error("Couldn't copy to the clipboard")
    }
  }

  const doRevoke = async (id: string) => {
    if (!window.confirm("Revoke this token? Any extension using it will stop working.")) return
    try {
      await revoke.mutateAsync(id)
      toast.success("Token revoked")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't revoke the token")
    }
  }

  const list = tokens.data?.data ?? []

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setNewToken(null)
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Browser extension</DialogTitle>
          <DialogDescription>
            Generate a token for the IdaraOS Vault browser extension, then paste your server URL + this token into the
            extension&apos;s settings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {newToken && (
            <div className="rounded-md border border-green-300 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950">
              <p className="mb-1 text-sm font-medium">Copy your token now — it won&apos;t be shown again:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded bg-background p-2 font-mono text-xs">{newToken}</code>
                <Button variant="ghost" size="icon" onClick={() => copy(newToken)} aria-label="Copy token">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <Button onClick={generate} disabled={create.isPending}>
            {create.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />} Generate token
          </Button>

          <div className="space-y-2">
            <p className="text-sm font-medium">Active tokens</p>
            {tokens.isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : list.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tokens yet.</p>
            ) : (
              list.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{t.name}</span>
                    <span className="text-xs text-muted-foreground">
                      created {formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}
                      {t.lastUsedAt ? ` · used ${formatDistanceToNow(new Date(t.lastUsedAt), { addSuffix: true })}` : " · never used"}
                    </span>
                  </span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => doRevoke(t.id)} aria-label="Revoke token">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Install: Chrome/Edge → Extensions → Load unpacked → select the <code>apps/extension</code> folder, then set
            your server URL and paste this token.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
