"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { AlertTriangle, Play } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { DEVICE_ACTIONS } from "@/lib/security/device-actions"
import { useCancelWipe, useQueueDeviceAction, useWipeDevice, type PendingWipe } from "@/lib/api/security-software"
import { useUser } from "@/lib/rbac/context"

export function DeviceActionsTab({
  deviceId,
  hostname,
  isAgent,
  canEdit,
  pendingWipe,
}: {
  deviceId: string
  hostname: string
  isAgent: boolean
  canEdit: boolean
  pendingWipe: PendingWipe | null
}) {
  const queue = useQueueDeviceAction()
  const wipe = useWipeDevice()
  const cancelWipe = useCancelWipe()
  const { user } = useUser()
  const [params, setParams] = useState<Record<string, string>>({})
  const [wipeOpen, setWipeOpen] = useState(false)
  const [confirmText, setConfirmText] = useState("")

  const isOwner = user?.role === "Owner"
  const openWipe =
    pendingWipe && (pendingWipe.status === "pending" || pendingWipe.status === "sent") ? pendingWipe : null

  if (!isAgent) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
        Device actions are only available for IdaraOS Agent devices.
      </div>
    )
  }

  const run = async (actionKey: string, param: string | null) => {
    try {
      await queue.mutateAsync({ id: deviceId, action: actionKey, param })
      toast.success(`Queued for ${hostname} — it runs at the next check-in`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to queue the action")
    }
  }

  const doWipe = async () => {
    try {
      await wipe.mutateAsync({ id: deviceId, confirm: confirmText.trim() })
      toast.success("Reset queued")
      setWipeOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to queue the reset")
    }
  }

  const doCancelWipe = async () => {
    try {
      await cancelWipe.mutateAsync(deviceId)
      toast.success("Reset cancelled")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel the reset")
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        A queued action runs the next time the device checks in. The agent runs only these reviewed actions — never a
        typed command. Output appears in the <strong>Audit log</strong> tab.
      </p>
      {DEVICE_ACTIONS.map((action) => {
        const needsParam = !!action.param
        const chosen = params[action.key] ?? ""
        const disabled = !canEdit || queue.isPending || (needsParam && !chosen)
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
              <Button size="sm" disabled={disabled} onClick={() => run(action.key, needsParam ? chosen : null)}>
                <Play className="mr-1.5 h-3.5 w-3.5" />
                Run
              </Button>
            </div>
          </div>
        )
      })}

      {isOwner && (
        <div className="mt-6 space-y-3 rounded-lg border border-red-300 p-4 dark:border-red-900">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-red-600">
              <AlertTriangle className="h-4 w-4" /> Danger zone
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Factory-reset this device and erase all its data. Irreversible, and only an Owner can do it.
            </p>
          </div>
          {openWipe ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950/30">
              <span>
                {openWipe.cancellable
                  ? `Reset queued — the device wipes ${formatDistanceToNow(new Date(openWipe.dispatchAt), { addSuffix: true })} unless cancelled.`
                  : "Reset sent to the device — it can no longer be cancelled."}
              </span>
              {openWipe.cancellable && (
                <Button variant="outline" size="sm" disabled={cancelWipe.isPending} onClick={doCancelWipe}>
                  Cancel reset
                </Button>
              )}
            </div>
          ) : (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setConfirmText("")
                setWipeOpen(true)
              }}
            >
              <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
              Reset Windows (remove everything)
            </Button>
          )}
        </div>
      )}

      <AlertDialog open={wipeOpen} onOpenChange={setWipeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset {hostname} to factory settings?</AlertDialogTitle>
            <AlertDialogDescription>
              This erases <strong>all</strong> data, apps and settings on the device and resets Windows. It cannot be
              undone. The device has a short cancel window before it starts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="wipe-confirm">
              Type the hostname <span className="font-mono font-medium">{hostname}</span> to confirm
            </Label>
            <Input
              id="wipe-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              placeholder={hostname}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmText.trim() !== hostname || wipe.isPending}
              onClick={(e) => {
                e.preventDefault()
                doWipe()
              }}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Reset device
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
