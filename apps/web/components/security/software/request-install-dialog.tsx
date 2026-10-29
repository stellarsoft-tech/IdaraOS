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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCreateElevationRequest, type MyCatalogApp, type MyElevationData } from "@/lib/api/security-elevation"

interface RequestInstallDialogProps {
  app: MyCatalogApp | null
  onOpenChange: (open: boolean) => void
  devices: MyElevationData["devices"]
  requireReason: boolean
}

export function RequestInstallDialog({ app, onOpenChange, devices, requireReason }: RequestInstallDialogProps) {
  const create = useCreateElevationRequest()
  const managedDevices = devices.filter((d) => d.intuneManaged)
  const [assetId, setAssetId] = useState("")
  const [reason, setReason] = useState("")

  useEffect(() => {
    if (app) {
      setAssetId(managedDevices.length === 1 ? managedDevices[0].id : "")
      setReason("")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app])

  const canSubmit = !!app && !!assetId && (!requireReason || reason.trim().length > 0)

  const handleSubmit = async () => {
    if (!app) return
    try {
      await create.mutateAsync({ assetId, catalogAppId: app.id, reason: reason.trim() || null })
      toast.success(`Request sent. ${app.name} installs automatically once it's approved.`)
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send request")
    }
  }

  return (
    <Dialog open={!!app} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request {app?.name}</DialogTitle>
          <DialogDescription>
            After approval, Intune installs it on your device for you. You don&apos;t need admin rights.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="install-device">Device</Label>
            <Select value={assetId} onValueChange={setAssetId}>
              <SelectTrigger id="install-device">
                <SelectValue placeholder="Choose a device" />
              </SelectTrigger>
              <SelectContent>
                {managedDevices.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                    {d.model ? ` · ${d.model}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {managedDevices.length === 0 && (
              <p className="text-xs text-amber-600">None of your devices are managed by Intune.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="install-reason">Reason{requireReason ? "" : " (optional)"}</Label>
            <Textarea
              id="install-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="e.g. Needed for the API project"
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
