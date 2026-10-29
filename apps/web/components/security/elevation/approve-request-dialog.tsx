"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useApproveElevationRequest, type ApproverElevationRequest } from "@/lib/api/security-elevation"
import type { ElevationGrantMode } from "@/lib/db/schema/security-elevation"
import { DEFAULT_DURATION_OPTIONS, formatMinutes } from "@/lib/security/elevation"

interface ApproveRequestDialogProps {
  request: ApproverElevationRequest | null
  onOpenChange: (open: boolean) => void
  credentialModeEnabled: boolean
  canUseCredentials: boolean
}

export function ApproveRequestDialog({
  request,
  onOpenChange,
  credentialModeEnabled,
  canUseCredentials,
}: ApproveRequestDialogProps) {
  const approve = useApproveElevationRequest()
  const [mode, setMode] = useState<ElevationGrantMode>("credentials")
  const [minutes, setMinutes] = useState("")
  const [note, setNote] = useState("")

  // Approvers can shorten the requested duration, never extend it
  const durationChoices = useMemo(() => {
    if (!request) return []
    const shorter = DEFAULT_DURATION_OPTIONS.filter((m) => m < request.requestedMinutes)
    return [...shorter, request.requestedMinutes]
  }, [request])

  useEffect(() => {
    if (request) {
      setMode("credentials")
      setMinutes(request.requestedMinutes.toString())
      setNote("")
    }
  }, [request])

  const credentialsAllowed = credentialModeEnabled && canUseCredentials
  const canSubmit = mode === "credentials" && credentialsAllowed && !!minutes

  const handleApprove = async () => {
    if (!request) return
    try {
      await approve.mutateAsync({ id: request.id, mode, minutes: Number(minutes), note: note.trim() || null })
      toast.success(`Approved for ${formatMinutes(Number(minutes))}`)
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve request")
    }
  }

  return (
    <Dialog open={!!request} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Approve admin access</DialogTitle>
          <DialogDescription>
            {request && `${request.requesterName} on ${request.deviceName}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>How should access be given?</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as ElevationGrantMode)} className="gap-3">
              <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
                <RadioGroupItem value="credentials" id="mode-credentials" className="mt-1" disabled={!credentialsAllowed} />
                <div className="space-y-1">
                  <span className="text-sm font-medium">Reveal LAPS password</span>
                  <p className="text-xs text-muted-foreground">
                    {!credentialModeEnabled
                      ? "Turned off in admin access settings."
                      : !canUseCredentials
                        ? "You don't have permission to approve with credentials."
                        : "The requester sees the device's local admin password in IdaraOS. It's rotated when access ends."}
                  </p>
                </div>
              </label>
              <label className="flex cursor-not-allowed items-start gap-3 rounded-md border p-3 opacity-60">
                <RadioGroupItem value="elevate_app" id="mode-elevate-app" className="mt-1" disabled />
                <div className="space-y-1">
                  <span className="text-sm font-medium">Elevate one app</span>
                  <p className="text-xs text-muted-foreground">
                    Needs the IdaraOS endpoint agent on the device - coming soon.
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="approve-duration">Duration</Label>
            <Select value={minutes} onValueChange={setMinutes}>
              <SelectTrigger id="approve-duration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {durationChoices.map((m) => (
                  <SelectItem key={m} value={m.toString()}>
                    {formatMinutes(m)}
                    {m === request?.requestedMinutes ? " (requested)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="approve-note">Note to requester (optional)</Label>
            <Textarea id="approve-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApprove} disabled={!canSubmit || approve.isPending}>
            {approve.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
