"use client"

import { useState } from "react"
import Link from "next/link"
import { format, formatDistanceToNow } from "date-fns"
import { AlertTriangle, Clock, KeyRound, RefreshCw, Settings, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import { PageShell } from "@/components/primitives/page-shell"
import { Protected } from "@/components/primitives/protected"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ApproveRequestDialog } from "@/components/security/elevation/approve-request-dialog"
import { GrantCountdown } from "@/components/security/elevation/grant-countdown"
import { NoteDialog } from "@/components/security/elevation/note-dialog"
import {
  useDenyElevationRequest,
  useElevationRequests,
  useRevokeElevationGrant,
  useRetryInstall,
  useRotateElevationGrant,
  type ApproverElevationRequest,
} from "@/lib/api/security-elevation"
import { usePermission } from "@/lib/rbac/context"
import {
  elevationGrantModeLabels,
  elevationGrantStatusLabels,
  elevationRequestStatusClassNames,
  elevationRequestStatusLabels,
  elevationRotationStatusClassNames,
  elevationRotationStatusLabels,
  formatMinutes,
} from "@/lib/security/elevation"
import { softwareInstallStatusClassNames, softwareInstallStatusLabels } from "@/lib/security/software"

function RequestHeader({ item }: { item: ApproverElevationRequest }) {
  return (
    <div className="min-w-0 flex-1 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{item.requesterName}</span>
        <span className="text-sm text-muted-foreground">{item.requesterEmail}</span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {item.catalogAppId ? (
          <span className="font-medium text-foreground">Install {item.appName ?? "app"}</span>
        ) : (
          item.appName && <span className="font-medium text-foreground">For: {item.appName}</span>
        )}
        <span>Device: {item.deviceName}</span>
        {item.requestedMinutes !== null && <span>{formatMinutes(item.requestedMinutes)} requested</span>}
        <span>{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</span>
        {!item.intuneManaged && <span className="text-amber-600">Not Intune-managed - rotation must be manual</span>}
      </div>
      {item.reason && <p className="text-sm">{item.reason}</p>}
    </div>
  )
}

function InstallStatus({
  item,
  canEdit,
  onRetry,
  retrying,
}: {
  item: ApproverElevationRequest
  canEdit: boolean
  onRetry: (grantId: string) => void
  retrying: boolean
}) {
  const install = item.install
  if (!install || !item.grant) return null
  const canRetry =
    canEdit && item.grant.status !== "revoked" && (install.status === "failed" || (install.status === "pending" && !!install.error))
  return (
    <div className="flex flex-col items-start gap-1 text-xs sm:items-end">
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${softwareInstallStatusClassNames[install.status]}`}
      >
        {softwareInstallStatusLabels[install.status]}
      </span>
      {install.status === "assigned" && install.lastCheckedAt && (
        <span className="text-muted-foreground">
          Checked {formatDistanceToNow(new Date(install.lastCheckedAt), { addSuffix: true })}
          {install.lastIntuneState && install.lastIntuneState !== "unknown" ? ` · Intune: ${install.lastIntuneState}` : ""}
        </span>
      )}
      {install.status === "assigned" && (
        <span className="text-muted-foreground">Deadline {format(new Date(item.grant.expiresAt), "MMM d, HH:mm")}</span>
      )}
      {install.error && <span className="max-w-[320px] text-red-600">{install.error}</span>}
      {canRetry && (
        <Button variant="outline" size="sm" onClick={() => onRetry(item.grant!.id)} disabled={retrying}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Retry install
        </Button>
      )}
    </div>
  )
}

export default function ElevationApprovalsPage() {
  const { data, isLoading, refetch } = useElevationRequests()
  const deny = useDenyElevationRequest()
  const revoke = useRevokeElevationGrant()
  const rotate = useRotateElevationGrant()
  const retryInstall = useRetryInstall()
  const canEdit = usePermission("security.elevation", "edit")
  const canUseCredentials = usePermission("security.elevation-credentials", "edit")

  const [approving, setApproving] = useState<ApproverElevationRequest | null>(null)
  const [denying, setDenying] = useState<ApproverElevationRequest | null>(null)
  const [revoking, setRevoking] = useState<ApproverElevationRequest | null>(null)

  const items = data?.data ?? []
  const pending = items.filter((i) => i.status === "pending")
  const active = items.filter((i) => i.grant?.status === "active")
  const history = items.filter((i) => i.status !== "pending" && i.grant?.status !== "active")

  const handleDeny = async (note: string | null) => {
    if (!denying) return
    try {
      await deny.mutateAsync({ id: denying.id, note })
      toast.success("Request denied")
      setDenying(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to deny request")
    }
  }

  const handleRevoke = async (reason: string | null) => {
    if (!revoking?.grant) return
    try {
      await revoke.mutateAsync({ id: revoking.grant.id, reason })
      toast.success("Access revoked")
      setRevoking(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to revoke access")
    }
  }

  const handleRetryInstall = async (grantId: string) => {
    try {
      await retryInstall.mutateAsync(grantId)
      toast.success("Install retried. The device was added to the install group again.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to retry the install")
    }
  }

  const handleRotate = async (grantId: string) => {
    try {
      await rotate.mutateAsync(grantId)
      toast.success("Rotation requested. The device applies it at its next Intune check-in.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to request rotation")
    }
  }

  return (
    <PageShell
      title="Admin Access Approvals"
      description="Approve temporary local admin access on employee devices. Every decision and reveal is audited."
      icon={ShieldCheck}
      action={
        <Protected module="security.elevation-settings" action="view">
          <Button variant="outline" asChild>
            <Link href="/security/elevation/settings">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </Button>
        </Protected>
      }
    >
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-amber-50 p-4 dark:bg-amber-900/10">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800 dark:text-amber-400">Pending</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-amber-900 dark:text-amber-300">{data?.stats.pending ?? 0}</p>
        </div>
        <div className="rounded-lg border bg-green-50 p-4 dark:bg-green-900/10">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-800 dark:text-green-400">Active access</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-green-900 dark:text-green-300">{data?.stats.active ?? 0}</p>
        </div>
        <div className="rounded-lg border bg-red-50 p-4 dark:bg-red-900/10">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-sm font-medium text-red-800 dark:text-red-400">Rotation or install failures</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-red-900 dark:text-red-300">{(data?.stats.rotationIssues ?? 0) + (data?.stats.installIssues ?? 0)}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
            <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4 space-y-3">
            {pending.length === 0 && <p className="py-8 text-center text-muted-foreground">No pending requests.</p>}
            {pending.map((item) => (
              <div key={item.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center">
                <RequestHeader item={item} />
                {canEdit && (
                  <div className="flex shrink-0 items-center gap-2">
                    {item.isOwnRequest ? (
                      <span className="text-xs text-muted-foreground">Another approver must decide your own request</span>
                    ) : (
                      <>
                        <Button variant="outline" onClick={() => setDenying(item)}>
                          Deny
                        </Button>
                        <Button onClick={() => setApproving(item)}>Approve</Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </TabsContent>

          <TabsContent value="active" className="mt-4 space-y-3">
            {active.length === 0 && <p className="py-8 text-center text-muted-foreground">Nothing in progress right now.</p>}
            {active.map((item) => (
              <div key={item.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center">
                <RequestHeader item={item} />
                <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                  {item.grant!.mode === "credentials" ? (
                    <>
                      <GrantCountdown expiresAt={item.grant!.expiresAt} onExpire={() => refetch()} />
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">{elevationGrantModeLabels[item.grant!.mode]}</Badge>
                        <span>
                          {item.grant!.revealCount > 0
                            ? `Revealed ${item.grant!.revealCount}×`
                            : "Not revealed yet"}
                        </span>
                      </div>
                    </>
                  ) : (
                    <InstallStatus item={item} canEdit={canEdit} onRetry={handleRetryInstall} retrying={retryInstall.isPending} />
                  )}
                  {canEdit && (
                    <Button variant="destructive" size="sm" onClick={() => setRevoking(item)}>
                      {item.grant!.mode === "app_install" ? "Cancel install" : "Revoke now"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="history" className="mt-4 space-y-3">
            {history.length === 0 && <p className="py-8 text-center text-muted-foreground">No decided requests yet.</p>}
            {history.map((item) => {
              const grant = item.grant
              const canRetry =
                canEdit && grant?.mode === "credentials" && ["pending", "failed"].includes(grant.rotationStatus)
              return (
                <div key={item.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center">
                  <RequestHeader item={item} />
                  <div className="flex shrink-0 flex-col items-start gap-2 text-xs sm:items-end">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${elevationRequestStatusClassNames[item.status]}`}
                      >
                        {elevationRequestStatusLabels[item.status]}
                      </span>
                      {grant && <Badge variant="outline">{elevationGrantStatusLabels[grant.status]}</Badge>}
                      {grant && grant.rotationStatus !== "not_required" && (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${elevationRotationStatusClassNames[grant.rotationStatus]}`}
                        >
                          {elevationRotationStatusLabels[grant.rotationStatus]}
                        </span>
                      )}
                    </div>
                    {item.decidedAt && (
                      <span className="text-muted-foreground">
                        {item.decidedByName ? `${item.decidedByName} · ` : ""}
                        {format(new Date(item.decidedAt), "MMM d, yyyy HH:mm")}
                      </span>
                    )}
                    {item.decisionNote && <span className="text-muted-foreground">Note: {item.decisionNote}</span>}
                    {grant?.rotationError && <span className="text-red-600">{grant.rotationError}</span>}
                    {item.install && (
                      <InstallStatus item={item} canEdit={canEdit} onRetry={handleRetryInstall} retrying={retryInstall.isPending} />
                    )}
                    {canRetry && (
                      <Button variant="outline" size="sm" onClick={() => handleRotate(grant.id)} disabled={rotate.isPending}>
                        <RefreshCw className="mr-2 h-3.5 w-3.5" />
                        Rotate password now
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </TabsContent>
        </Tabs>
      )}

      <ApproveRequestDialog
        request={approving}
        onOpenChange={(open) => !open && setApproving(null)}
        credentialModeEnabled={data?.settings.credentialModeEnabled ?? false}
        canUseCredentials={canUseCredentials}
        maxMinutes={data?.settings.maxMinutes ?? 240}
      />
      <NoteDialog
        open={!!denying}
        onOpenChange={(open) => !open && setDenying(null)}
        title="Deny admin access"
        description={denying ? `${denying.requesterName} on ${denying.deviceName}` : undefined}
        noteLabel="Reason (shown to the requester, optional)"
        confirmLabel="Deny request"
        pending={deny.isPending}
        onConfirm={handleDeny}
      />
      <NoteDialog
        open={!!revoking}
        onOpenChange={(open) => !open && setRevoking(null)}
        title={revoking?.grant?.mode === "app_install" ? "Cancel install" : "Revoke admin access now"}
        description={
          revoking?.grant?.mode === "app_install"
            ? "The device leaves the install group so Intune won't install the app. If it's already installed, uninstall it in Intune."
            : "Access ends immediately. If the password was revealed, a LAPS rotation is requested right away."
        }
        noteLabel="Reason (optional)"
        confirmLabel={revoking?.grant?.mode === "app_install" ? "Cancel install" : "Revoke access"}
        pending={revoke.isPending}
        onConfirm={handleRevoke}
      />
    </PageShell>
  )
}
