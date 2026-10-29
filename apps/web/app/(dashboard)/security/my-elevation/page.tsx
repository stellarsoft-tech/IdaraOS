"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { KeyRound, Laptop, Plus, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import { PageShell } from "@/components/primitives/page-shell"
import { Protected } from "@/components/primitives/protected"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { CredentialReveal } from "@/components/security/elevation/credential-reveal"
import { GrantCountdown } from "@/components/security/elevation/grant-countdown"
import { RequestAccessDialog } from "@/components/security/elevation/request-access-dialog"
import { useCancelElevationRequest, useMyElevation, type MyElevationRequest } from "@/lib/api/security-elevation"
import {
  elevationGrantModeLabels,
  elevationGrantStatusLabels,
  elevationRequestStatusClassNames,
  elevationRequestStatusLabels,
  formatMinutes,
} from "@/lib/security/elevation"

function isLive(item: MyElevationRequest): boolean {
  return item.grant?.status === "active" && new Date(item.grant.expiresAt).getTime() > Date.now()
}

export default function MyElevationPage() {
  const { data, isLoading, refetch } = useMyElevation()
  const cancel = useCancelElevationRequest()
  const [requestOpen, setRequestOpen] = useState(false)

  const items = data?.data ?? []
  const devices = data?.devices ?? []
  const options = data?.options ?? { durationOptions: [], requireReason: true, maxRevealsPerGrant: 5 }
  const active = items.filter(isLive)
  const others = items.filter((i) => !isLive(i))

  const handleCancel = async (id: string) => {
    try {
      await cancel.mutateAsync(id)
      toast.success("Request cancelled")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel request")
    }
  }

  return (
    <PageShell
      title="My Admin Access"
      description="Request temporary local admin rights on your work devices. Access ends automatically."
      icon={KeyRound}
      action={
        <Protected module="security.my-elevation" action="create">
          <Button onClick={() => setRequestOpen(true)} disabled={devices.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            Request access
          </Button>
        </Protected>
      }
    >
      {!isLoading && devices.length === 0 && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-900/10">
          No Entra-joined devices are assigned to you in Assets yet. Ask IT to sync devices from Intune and assign
          your laptop to you.
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      )}

      {active.length > 0 && (
        <section className="mb-8 space-y-3">
          <h2 className="text-lg font-semibold">Active access</h2>
          {active.map((item) => (
            <div key={item.id} className="space-y-3 rounded-lg border border-green-300 p-4 dark:border-green-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-green-600" />
                  <span className="font-semibold">{item.deviceName}</span>
                  <Badge variant="outline">{elevationGrantModeLabels[item.grant!.mode]}</Badge>
                </div>
                <GrantCountdown expiresAt={item.grant!.expiresAt} onExpire={() => refetch()} />
              </div>
              {item.decisionNote && (
                <p className="text-sm text-muted-foreground">Approver note: {item.decisionNote}</p>
              )}
              {item.grant!.mode === "credentials" && (
                <CredentialReveal
                  grantId={item.grant!.id}
                  revealCount={item.grant!.revealCount}
                  maxReveals={options.maxRevealsPerGrant}
                />
              )}
            </div>
          ))}
        </section>
      )}

      {!isLoading && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Requests</h2>
          {others.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
              <KeyRound className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">You haven&apos;t requested admin access yet.</p>
            </div>
          )}
          {others.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Laptop className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{item.deviceName}</span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${elevationRequestStatusClassNames[item.status]}`}
                  >
                    {elevationRequestStatusLabels[item.status]}
                  </span>
                  {item.grant && item.grant.status !== "active" && (
                    <Badge variant="outline">{elevationGrantStatusLabels[item.grant.status]}</Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{formatMinutes(item.requestedMinutes)} requested</span>
                  <span>{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</span>
                  {item.reason && <span className="truncate">Reason: {item.reason}</span>}
                </div>
                {item.decisionNote && (
                  <p className="text-sm text-muted-foreground">Approver note: {item.decisionNote}</p>
                )}
              </div>
              {item.status === "pending" && (
                <Button variant="outline" size="sm" onClick={() => handleCancel(item.id)} disabled={cancel.isPending}>
                  Cancel request
                </Button>
              )}
            </div>
          ))}
        </section>
      )}

      <RequestAccessDialog open={requestOpen} onOpenChange={setRequestOpen} devices={devices} options={options} />
    </PageShell>
  )
}
