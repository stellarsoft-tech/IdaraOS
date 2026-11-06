"use client"

import { formatDistanceToNow } from "date-fns"
import { CheckCircle2, CircleDashed, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { DevicePolicyCompliance } from "@/lib/api/security-software"

function StatusBadge({ status }: { status: DevicePolicyCompliance["status"] }) {
  if (status === "compliant") {
    return (
      <Badge variant="outline" className="gap-1 border-green-400 text-green-600">
        <CheckCircle2 className="h-3.5 w-3.5" /> Compliant
      </Badge>
    )
  }
  if (status === "error") {
    return (
      <Badge variant="outline" className="gap-1 border-red-400 text-red-600">
        <XCircle className="h-3.5 w-3.5" /> Error
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <CircleDashed className="h-3.5 w-3.5" /> Not reported
    </Badge>
  )
}

export function DevicePoliciesTab({ compliance }: { compliance: DevicePolicyCompliance[] }) {
  if (compliance.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
        No policies apply to this device. Add it to a group in Groups &amp; policies.
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {compliance.map((p) => (
        <div key={p.type} className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{p.name}</span>
              <StatusBadge status={p.status} />
            </div>
            {p.status === "error" && p.message && <p className="text-sm text-red-600">{p.message}</p>}
            {p.status === "compliant" && p.message && <p className="text-sm text-muted-foreground">{p.message}</p>}
            {p.status === "pending" && (
              <p className="text-sm text-muted-foreground">Waiting for the device to report this policy.</p>
            )}
          </div>
          {p.reportedAt && (
            <span className="shrink-0 text-xs text-muted-foreground">
              reported {formatDistanceToNow(new Date(p.reportedAt), { addSuffix: true })}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
