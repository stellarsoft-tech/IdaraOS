"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { AlertTriangle, CheckCircle2, ChevronDown, Clock, Copy, Eye, EyeOff, KeyRound, Loader2, Play, RefreshCw, XCircle } from "lucide-react"
import { toast } from "sonner"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  useBitlockerKeys,
  useDeviceActions,
  useDeviceAdminCredential,
  useQueueDeviceAction,
  useRevealAdminCredential,
  useRevealBitlockerKey,
  useRotateAdminCredential,
  type DeviceActionJobEntry,
} from "@/lib/api/security-software"
import { DEVICE_ACTIONS } from "@/lib/security/device-actions"
import type { AgentJobStatus } from "@/lib/db/schema/security-agent"

interface DeviceActionsDialogProps {
  deviceId: string | null
  hostname: string
  onOpenChange: (open: boolean) => void
}

const statusMeta: Record<AgentJobStatus, { label: string; icon: typeof Clock; className: string }> = {
  pending: { label: "Queued", icon: Clock, className: "text-blue-600" },
  sent: { label: "Running", icon: Loader2, className: "text-blue-600" },
  succeeded: { label: "Done", icon: CheckCircle2, className: "text-green-600" },
  failed: { label: "Failed", icon: XCircle, className: "text-red-600" },
  cancelled: { label: "Cancelled", icon: XCircle, className: "text-muted-foreground" },
}

function HistoryRow({ job }: { job: DeviceActionJobEntry }) {
  const [open, setOpen] = useState(false)
  const meta = statusMeta[job.status]
  const Icon = meta.icon

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Icon className={`h-4 w-4 shrink-0 ${meta.className} ${job.status === "sent" ? "animate-spin" : ""}`} />
            {job.actionName}
            {job.param && <code className="rounded bg-muted px-1 text-xs">{job.param}</code>}
          </div>
          {job.message && <p className="mt-0.5 text-xs text-muted-foreground">{job.message}</p>}
        </div>
        <div className="shrink-0 text-right text-xs text-muted-foreground">
          <div>{meta.label}</div>
          <div>{formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}</div>
        </div>
      </div>
      {job.log && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
            {open ? "Hide output" : "Show output"}
          </button>
          {open && (
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 font-mono text-xs">{job.log}</pre>
          )}
        </div>
      )}
    </div>
  )
}

/** Escrowed BitLocker recovery keys for the device, with an audited per-volume reveal. */
export function BitlockerSection({ deviceId, showEmpty = false }: { deviceId: string; showEmpty?: boolean }) {
  const { data, isLoading } = useBitlockerKeys(deviceId)
  const reveal = useRevealBitlockerKey()
  const [revealed, setRevealed] = useState<Record<string, string>>({})

  const keys = data?.data ?? []
  const encryptionKeyConfigured = data?.encryptionKeyConfigured ?? true

  const toggleReveal = async (keyId: string) => {
    if (revealed[keyId]) {
      setRevealed((r) => {
        const next = { ...r }
        delete next[keyId]
        return next
      })
      return
    }
    try {
      const res = await reveal.mutateAsync({ deviceId, keyId })
      setRevealed((r) => ({ ...r, [keyId]: res.data.recoveryKey }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reveal the recovery key")
    }
  }

  const copyKey = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success("Recovery key copied")
    } catch {
      toast.error("Couldn't copy to the clipboard")
    }
  }

  if (isLoading) return null
  if (keys.length === 0) {
    if (!showEmpty) return null
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">BitLocker recovery keys</h3>
        <p className="text-sm text-muted-foreground">No recovery keys escrowed for this device yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">BitLocker recovery keys</h3>
      {!encryptionKeyConfigured && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            ENCRYPTION_KEY isn&apos;t set on the server, so these keys are only weakly protected at rest. Set it to
            secure escrowed keys.
          </span>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Revealing a key is recorded in the audit log.</p>
      <div className="space-y-2">
        {keys.map((k) => (
          <div key={k.id} className="rounded-md border p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <KeyRound className="h-4 w-4 text-muted-foreground" />
                  {k.volume}
                  {k.protectionOn ? (
                    <Badge variant="outline" className="text-[10px] text-green-600">
                      Protected
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      Encrypting{typeof k.encryptionPercentage === "number" ? ` ${k.encryptionPercentage}%` : ""}
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[k.encryptionMethod, k.recoveryKeyId ? `ID ${k.recoveryKeyId.slice(0, 8)}…` : null]
                    .filter(Boolean)
                    .join(" · ") || "Recovery password protector"}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => toggleReveal(k.id)} disabled={reveal.isPending}>
                {revealed[k.id] ? (
                  <>
                    <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                    Hide
                  </>
                ) : (
                  <>
                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                    Reveal key
                  </>
                )}
              </Button>
            </div>
            {revealed[k.id] && (
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 break-all rounded bg-muted p-2 font-mono text-xs">{revealed[k.id]}</code>
                <Button variant="ghost" size="sm" onClick={() => copyKey(revealed[k.id])} aria-label="Copy recovery key">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * The device's managed local admin password, with an audited break-glass reveal. Lets an admin read
 * the password to sign in locally when the device is offline or internet-quarantined.
 */
export function AdminPasswordSection({ deviceId, showEmpty = false }: { deviceId: string; showEmpty?: boolean }) {
  const { data, isLoading } = useDeviceAdminCredential(deviceId)
  const reveal = useRevealAdminCredential()
  const rotate = useRotateAdminCredential()
  const [revealed, setRevealed] = useState<{ accountName: string; password: string } | null>(null)

  const doRotate = async () => {
    if (!window.confirm("Rotate this device's managed admin password at its next check-in? The current password will stop working once it rotates.")) return
    try {
      await rotate.mutateAsync(deviceId)
      toast.success("Rotation requested — it happens at the next check-in")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't request the rotation")
    }
  }

  const view = data?.data ?? null
  const encryptionKeyConfigured = data?.encryptionKeyConfigured ?? true

  const toggleReveal = async () => {
    if (revealed) {
      setRevealed(null)
      return
    }
    try {
      const res = await reveal.mutateAsync(deviceId)
      setRevealed(res.data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reveal the admin password")
    }
  }

  const copyPassword = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success("Admin password copied")
    } catch {
      toast.error("Couldn't copy to the clipboard")
    }
  }

  if (isLoading) return null

  if (!view || !view.hasPassword) {
    if (!showEmpty) return null
    const reason = !view
      ? "The managed admin password isn't enabled, or the agent hasn't reported one yet."
      : view.lastStatus === "missing"
        ? `No password escrowed yet — the "${view.accountName}" account doesn't exist on the device.`
        : view.lastStatus === "error"
          ? `No password escrowed yet — the agent couldn't set it${view.lastError ? `: ${view.lastError}` : "."}`
          : "No password escrowed for this device yet."
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Local admin password</h3>
        <p className="text-sm text-muted-foreground">{reason}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Local admin password</h3>
      {!encryptionKeyConfigured && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            ENCRYPTION_KEY isn&apos;t set on the server, so this password is only weakly protected at rest. Set it to
            secure escrowed credentials.
          </span>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Revealing the password is recorded in the audit log. Use it to sign in locally when the device is offline or
        internet-quarantined.
      </p>
      <div className="rounded-md border p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              {view.accountName}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {view.rotatedAt
                ? `Local administrator · rotated ${formatDistanceToNow(new Date(view.rotatedAt), { addSuffix: true })}`
                : "Managed local administrator"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" onClick={doRotate} disabled={rotate.isPending || !!view.rotateRequestedAt}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${rotate.isPending ? "animate-spin" : ""}`} />
              {view.rotateRequestedAt ? "Rotation pending" : "Rotate"}
            </Button>
            <Button variant="outline" size="sm" onClick={toggleReveal} disabled={reveal.isPending}>
              {revealed ? (
                <>
                  <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                  Hide
                </>
              ) : (
                <>
                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                  Reveal password
                </>
              )}
            </Button>
          </div>
        </div>
        {view.rotateRequestedAt && (
          <p className="mt-2 text-xs text-muted-foreground">A rotation is queued — the password changes at the device&apos;s next check-in.</p>
        )}
        {revealed && (
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-muted p-2 font-mono text-xs">{revealed.password}</code>
            <Button variant="ghost" size="sm" onClick={() => copyPassword(revealed.password)} aria-label="Copy admin password">
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export function DeviceActionsDialog({ deviceId, hostname, onOpenChange }: DeviceActionsDialogProps) {
  const { data, isLoading } = useDeviceActions(deviceId)
  const queue = useQueueDeviceAction()
  // Chosen parameter per action that takes one (keyed by action key)
  const [params, setParams] = useState<Record<string, string>>({})

  const jobs = data?.data ?? []

  const run = async (actionKey: string, param: string | null) => {
    if (!deviceId) return
    try {
      await queue.mutateAsync({ id: deviceId, action: actionKey, param })
      toast.success(`Queued for ${hostname} — it runs at the next check-in`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to queue the action")
    }
  }

  return (
    <Dialog open={!!deviceId} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Device actions · {hostname}</DialogTitle>
          <DialogDescription>
            A queued action runs the next time the device checks in. The agent runs only these reviewed actions — never a typed command.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {DEVICE_ACTIONS.map((action) => {
            const needsParam = !!action.param
            const chosen = params[action.key] ?? ""
            const disabled = queue.isPending || (needsParam && !chosen)
            return (
              <div key={action.key} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {action.label}
                    {action.changesDevice && <Badge variant="outline" className="text-[10px]">Changes device</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{action.description}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {action.param && (
                    <Select value={chosen} onValueChange={(v) => setParams((p) => ({ ...p, [action.key]: v }))}>
                      <SelectTrigger className="w-44">
                        <SelectValue placeholder={action.param.label} />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(action.param.options).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    size="sm"
                    disabled={disabled}
                    onClick={() => run(action.key, needsParam ? chosen : null)}
                  >
                    <Play className="mr-1.5 h-3.5 w-3.5" />
                    Run
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        {deviceId && <BitlockerSection deviceId={deviceId} />}

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Recent actions</h3>
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No actions have been run on this device yet.</p>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => (
                <HistoryRow key={job.id} job={job} />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
