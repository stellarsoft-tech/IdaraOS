"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Copy, KeyRound, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useCreateEnrollmentToken } from "@/lib/api/security-software"

interface EnrollmentTokenCardProps {
  hint: string | null
  createdAt: string | null
  canEdit: boolean
}

function installCommand(serverUrl: string, token: string) {
  return `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\\Install-IdaraOSUpdater.ps1 -ServerUrl "${serverUrl}" -EnrollmentToken "${token}"`
}

export function EnrollmentTokenCard({ hint, createdAt, canEdit }: EnrollmentTokenCardProps) {
  const create = useCreateEnrollmentToken()
  const [token, setToken] = useState<string | null>(null)
  const serverUrl = typeof window !== "undefined" ? window.location.origin : ""

  const handleCreate = async () => {
    try {
      const result = await create.mutateAsync()
      setToken(result.data.token)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create the enrollment token")
    }
  }

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    toast.success("Copied")
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="flex items-center gap-2 font-semibold">
            <KeyRound className="h-4 w-4" />
            Enrollment token
          </h3>
          <p className="text-sm text-muted-foreground">
            The Intune package uses this token to register each device once. Replacing it doesn&apos;t affect devices
            that are already enrolled.
          </p>
          <p className="text-sm">
            {hint && createdAt
              ? `Current token ends in …${hint}, created ${format(new Date(createdAt), "MMM d, yyyy")}`
              : "No token yet."}
          </p>
        </div>
        {canEdit && (
          <Button variant={hint ? "outline" : "default"} onClick={handleCreate} disabled={create.isPending}>
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {hint ? "Replace token" : "Create token"}
          </Button>
        )}
      </div>

      <Dialog open={!!token} onOpenChange={(open) => !open && setToken(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Enrollment token</DialogTitle>
            <DialogDescription>
              Copy it now - it won&apos;t be shown again. Use it in the Intune Win32 app&apos;s install command.
            </DialogDescription>
          </DialogHeader>
          {token && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded-md bg-muted p-3 text-xs">{token}</code>
                <Button variant="outline" size="icon" onClick={() => copy(token)} aria-label="Copy token">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Intune install command</p>
                <div className="flex items-start gap-2">
                  <code className="flex-1 break-all rounded-md bg-muted p-3 text-xs">{installCommand(serverUrl, token)}</code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copy(installCommand(serverUrl, token))}
                    aria-label="Copy install command"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setToken(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
