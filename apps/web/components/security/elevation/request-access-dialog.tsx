"use client"

import { useEffect, useState } from "react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCreateElevationRequest, type MyElevationData } from "@/lib/api/security-elevation"
import { formatMinutes } from "@/lib/security/elevation"

interface RequestAccessDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  devices: MyElevationData["devices"]
  options: MyElevationData["options"]
}

export function RequestAccessDialog({ open, onOpenChange, devices, options }: RequestAccessDialogProps) {
  const create = useCreateElevationRequest()
  const [assetId, setAssetId] = useState("")
  const [minutes, setMinutes] = useState("")
  const [reason, setReason] = useState("")
  const [appName, setAppName] = useState("")

  useEffect(() => {
    if (open) {
      setAssetId(devices.length === 1 ? devices[0].id : "")
      setMinutes(options.durationOptions[0]?.toString() ?? "")
      setReason("")
      setAppName("")
    }
  }, [open, devices, options.durationOptions])

  const canSubmit = !!assetId && !!minutes && (!options.requireReason || reason.trim().length > 0)

  const handleSubmit = async () => {
    try {
      await create.mutateAsync({
        assetId,
        minutes: Number(minutes),
        appName: appName.trim() || null,
        reason: reason.trim() || null,
      })
      toast.success("Request sent. You'll see it here once an approver decides.")
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send request")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request admin access</DialogTitle>
          <DialogDescription>
            An approver will decide how long you get and how access is given.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="elevation-device">Device</Label>
            <Select value={assetId} onValueChange={setAssetId}>
              <SelectTrigger id="elevation-device">
                <SelectValue placeholder="Choose a device" />
              </SelectTrigger>
              <SelectContent>
                {devices.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                    {d.model ? ` · ${d.model}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="elevation-duration">How long do you need it?</Label>
            <Select value={minutes} onValueChange={setMinutes}>
              <SelectTrigger id="elevation-duration">
                <SelectValue placeholder="Choose a duration" />
              </SelectTrigger>
              <SelectContent>
                {options.durationOptions.map((m) => (
                  <SelectItem key={m} value={m.toString()}>
                    {formatMinutes(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="elevation-app">What do you need admin for? (optional)</Label>
            <Input
              id="elevation-app"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              maxLength={200}
              placeholder="e.g. VPN client update"
            />
            <p className="text-xs text-muted-foreground">
              If it&apos;s listed under Install software, request it there instead - no password needed.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="elevation-reason">
              Reason{options.requireReason ? "" : " (optional)"}
            </Label>
            <Textarea
              id="elevation-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="e.g. Install the VPN client update"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || create.isPending}>
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
