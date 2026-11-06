"use client"

import { useState } from "react"
import { Play } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DEVICE_ACTIONS } from "@/lib/security/device-actions"
import { useQueueDeviceAction } from "@/lib/api/security-software"

export function DeviceActionsTab({
  deviceId,
  hostname,
  isAgent,
  canEdit,
}: {
  deviceId: string
  hostname: string
  isAgent: boolean
  canEdit: boolean
}) {
  const queue = useQueueDeviceAction()
  const [params, setParams] = useState<Record<string, string>>({})

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
    </div>
  )
}
