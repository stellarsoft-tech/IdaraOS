"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { Globe, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { GrantCountdown } from "@/components/security/elevation/grant-countdown"
import {
  useWebAccessApprovals,
  useApproveWebAccess,
  useDenyWebAccess,
  type WebAccessApproval,
} from "@/lib/api/security-web-access"

const STATUS_CLASS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  denied: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  cancelled: "bg-muted text-muted-foreground",
  expired: "bg-muted text-muted-foreground",
}
const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  denied: "Denied",
  cancelled: "Cancelled",
  expired: "Expired",
}

function isLive(r: WebAccessApproval): boolean {
  return r.status === "approved" && !!r.expiresAt && new Date(r.expiresAt).getTime() > Date.now()
}
function formatMins(m: number): string {
  return m % 60 === 0 ? `${m / 60} hr` : `${m} min`
}

function PendingRow({
  item,
  options,
  busy,
  onApprove,
  onDeny,
}: {
  item: WebAccessApproval
  options: number[]
  busy: boolean
  onApprove: (id: string, minutes: number) => void
  onDeny: (id: string) => void
}) {
  const [mins, setMins] = useState(String(item.requestedMinutes))
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-amber-300 p-4 dark:border-amber-900 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{item.domain}</span>
          <span className="text-sm text-muted-foreground">
            {item.requesterName ?? item.requesterEmail} · {formatMins(item.requestedMinutes)} requested
          </span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</span>
          {item.reason && <span className="truncate">Reason: {item.reason}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Select value={mins} onValueChange={setMins}>
          <SelectTrigger className="h-8 w-24 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((m) => (
              <SelectItem key={m} value={String(m)}>
                {formatMins(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => onApprove(item.id, Number(mins))} disabled={busy}>
          Approve
        </Button>
        <Button variant="outline" size="sm" onClick={() => onDeny(item.id)} disabled={busy}>
          Deny
        </Button>
      </div>
    </div>
  )
}

export function WebAccessApprovalsTab({ canEdit }: { canEdit: boolean }) {
  const { data, isLoading, refetch } = useWebAccessApprovals()
  const approve = useApproveWebAccess()
  const deny = useDenyWebAccess()

  const items = data?.data ?? []
  const options = data?.options.durationOptions ?? [10, 30, 60, 120]
  const pending = items.filter((i) => i.status === "pending")
  const decided = items.filter((i) => i.status !== "pending")
  const busy = approve.isPending || deny.isPending

  const doApprove = async (id: string, minutes: number) => {
    try {
      await approve.mutateAsync({ id, minutes })
      toast.success("Access approved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve")
    }
  }
  const doDeny = async (id: string) => {
    try {
      await deny.mutateAsync({ id })
      toast.success("Request denied")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to deny")
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Members request temporary access to sites the web-filtering policy blocks. Approving one unblocks that site for
        the chosen time; when it ends, the agent re-blocks it at the next check-in.
      </p>

      {pending.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">Pending</h4>
          {pending.map((item) =>
            canEdit ? (
              <PendingRow key={item.id} item={item} options={options} busy={busy} onApprove={doApprove} onDeny={doDeny} />
            ) : (
              <div key={item.id} className="rounded-lg border p-4 text-sm">
                {item.domain} · {item.requesterName ?? item.requesterEmail}
              </div>
            )
          )}
        </div>
      )}

      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase text-muted-foreground">Recent</h4>
        {decided.length === 0 ? (
          <p className="text-sm text-muted-foreground">No decided requests yet.</p>
        ) : (
          decided.map((item) => {
            const live = isLive(item)
            return (
              <div key={item.id} className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{item.domain}</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[item.status] ?? ""}`}>
                      {live ? "Active" : STATUS_LABEL[item.status] ?? item.status}
                    </span>
                    {live && item.expiresAt && <GrantCountdown expiresAt={item.expiresAt} onExpire={() => refetch()} />}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{item.requesterName ?? item.requesterEmail}</span>
                    {item.decidedByName && <span>by {item.decidedByName}</span>}
                    <span>{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</span>
                  </div>
                  {item.decisionNote && <p className="text-sm text-muted-foreground">Note: {item.decisionNote}</p>}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
