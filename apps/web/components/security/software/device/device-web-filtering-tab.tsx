"use client"

import { formatDistanceToNow } from "date-fns"
import { CheckCircle2, CircleDashed, Globe, Loader2, ShieldAlert, XCircle } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  useDeviceWebFiltering,
  useApproveWebAccess,
  useDenyWebAccess,
  type DeviceAccessRequest,
} from "@/lib/api/security-web-access"
import type { DevicePolicyCompliance, UpdaterDevice } from "@/lib/api/security-software"

const REQ_STATUS_CLASS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  denied: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  cancelled: "bg-muted text-muted-foreground",
  expired: "bg-muted text-muted-foreground",
}

function isLive(r: DeviceAccessRequest): boolean {
  return r.status === "approved" && !!r.expiresAt && new Date(r.expiresAt).getTime() > Date.now()
}

export function DeviceWebFilteringTab({
  device,
  compliance,
}: {
  device: UpdaterDevice
  compliance: DevicePolicyCompliance[]
}) {
  const wf = compliance.find((c) => c.type === "web-filtering")
  const { data, isLoading, refetch } = useDeviceWebFiltering(device.id)
  const approve = useApproveWebAccess()
  const deny = useDenyWebAccess()

  const decide = async (fn: Promise<unknown>, ok: string) => {
    try {
      await fn
      toast.success(ok)
      refetch()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed")
    }
  }

  const state = (wf?.state ?? {}) as { domains?: number; categories?: number; allowlistOnly?: boolean }
  const blockEvents = data?.blockEvents ?? []
  const requests = data?.accessRequests ?? []

  return (
    <div className="space-y-6">
      {/* Policy status */}
      <div className="rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Web content filtering</span>
          </div>
          {!wf ? (
            <Badge variant="outline" className="text-muted-foreground">Not enabled</Badge>
          ) : wf.status === "compliant" ? (
            <Badge variant="outline" className="gap-1 border-green-400 text-green-600">
              <CheckCircle2 className="h-3.5 w-3.5" /> Applied
            </Badge>
          ) : wf.status === "error" ? (
            <Badge variant="outline" className="gap-1 border-red-400 text-red-600">
              <XCircle className="h-3.5 w-3.5" /> Error
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <CircleDashed className="h-3.5 w-3.5" /> Not reported
            </Badge>
          )}
        </div>
        {wf?.status === "error" && wf.message && <p className="mt-2 text-sm text-red-600">{wf.message}</p>}
        {wf?.status === "compliant" && (
          <div className="mt-3 flex flex-wrap gap-6 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Blocked domains</div>
              <div className="font-medium">{state.domains ?? 0}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Blocked categories</div>
              <div className="font-medium">{state.categories ?? 0}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Allowlist-only</div>
              <div className="font-medium">{state.allowlistOnly ? "Yes" : "No"}</div>
            </div>
          </div>
        )}
        {!wf && (
          <p className="mt-2 text-sm text-muted-foreground">
            Web content filtering isn&apos;t enabled for this device. Turn it on in Groups &amp; policies.
          </p>
        )}
      </div>

      {/* Blocked attempts */}
      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldAlert className="h-4 w-4 text-muted-foreground" /> Blocked site attempts
        </h3>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : blockEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No blocked attempts recorded. The device reports these on agent 1.8.0+ (sites that resolved to a block).
          </p>
        ) : (
          <div className="divide-y rounded-lg border">
            {blockEvents.map((e) => (
              <div key={e.domain} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <span className="truncate font-medium">{e.domain}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {e.hitCount} {e.hitCount === 1 ? "attempt" : "attempts"} · {formatDistanceToNow(new Date(e.lastSeenAt), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Access requests */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Website access requests</h3>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No website access requests from this device&apos;s member.</p>
        ) : (
          <div className="space-y-2">
            {requests.map((r) => {
              const live = isLive(r)
              return (
                <div key={r.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{r.domain}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${REQ_STATUS_CLASS[r.status] ?? ""}`}>
                        {live ? "Active" : r.status}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.requestedMinutes} min · {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                      {r.reason ? ` · ${r.reason}` : ""}
                    </div>
                  </div>
                  {r.status === "pending" && (
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" disabled={approve.isPending} onClick={() => decide(approve.mutateAsync({ id: r.id }), "Access approved")}>
                        Approve
                      </Button>
                      <Button variant="outline" size="sm" disabled={deny.isPending} onClick={() => decide(deny.mutateAsync({ id: r.id }), "Request denied")}>
                        Deny
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
