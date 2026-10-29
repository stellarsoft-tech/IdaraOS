"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { ExternalLink, KeyRound, Laptop, Package, Plus, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import { PageShell } from "@/components/primitives/page-shell"
import { Protected } from "@/components/primitives/protected"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { CredentialReveal } from "@/components/security/elevation/credential-reveal"
import { GrantCountdown } from "@/components/security/elevation/grant-countdown"
import { RequestAccessDialog } from "@/components/security/elevation/request-access-dialog"
import { RequestInstallDialog } from "@/components/security/software/request-install-dialog"
import {
  useCancelElevationRequest,
  useMyElevation,
  type MyCatalogApp,
  type MyElevationRequest,
} from "@/lib/api/security-elevation"
import { usePermission } from "@/lib/rbac/context"
import {
  elevationGrantModeLabels,
  elevationGrantStatusLabels,
  elevationRequestStatusClassNames,
  elevationRequestStatusLabels,
  formatMinutes,
} from "@/lib/security/elevation"
import { softwareInstallStatusClassNames, softwareInstallStatusLabels } from "@/lib/security/software"

function isLive(item: MyElevationRequest): boolean {
  return item.grant?.status === "active" && new Date(item.grant.expiresAt).getTime() > Date.now()
}

function InstallBadge({ item }: { item: MyElevationRequest }) {
  if (!item.install) return null
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${softwareInstallStatusClassNames[item.install.status]}`}
    >
      {softwareInstallStatusLabels[item.install.status]}
    </span>
  )
}

function CatalogCard({
  app,
  canRequest,
  onRequest,
}: {
  app: MyCatalogApp
  canRequest: boolean
  onRequest: (app: MyCatalogApp) => void
}) {
  return (
    <div className="flex flex-col justify-between gap-3 rounded-lg border p-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{app.name}</span>
        </div>
        {app.publisher && <p className="text-xs text-muted-foreground">{app.publisher}</p>}
        {app.description && <p className="text-sm text-muted-foreground">{app.description}</p>}
      </div>
      {app.access === "managed" && <p className="text-xs text-muted-foreground">Installed on every work device by IT.</p>}
      {app.access === "self_service" &&
        (app.companyPortalUrl ? (
          <Button variant="outline" size="sm" asChild>
            <a href={app.companyPortalUrl}>
              <ExternalLink className="mr-2 h-3.5 w-3.5" />
              Open in Company Portal
            </a>
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">Install it from Company Portal.</p>
        ))}
      {app.access === "approval" &&
        (app.requestable ? (
          canRequest && (
            <Button size="sm" onClick={() => onRequest(app)}>
              Request install
            </Button>
          )
        ) : (
          <p className="text-xs text-amber-600">IT is still setting this app up.</p>
        ))}
    </div>
  )
}

export default function MyElevationPage() {
  const { data, isLoading, refetch } = useMyElevation()
  const cancel = useCancelElevationRequest()
  const canCreate = usePermission("security.my-elevation", "create")
  const [requestOpen, setRequestOpen] = useState(false)
  const [installApp, setInstallApp] = useState<MyCatalogApp | null>(null)

  const items = data?.data ?? []
  const devices = data?.devices ?? []
  const catalog = data?.catalog ?? []
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
      description="Install approved software, or request temporary local admin rights on your work devices."
      icon={KeyRound}
      action={
        <Protected module="security.my-elevation" action="create">
          <Button variant="outline" onClick={() => setRequestOpen(true)} disabled={devices.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            Request admin access
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
          <h2 className="text-lg font-semibold">In progress</h2>
          {active.map((item) => (
            <div key={item.id} className="space-y-3 rounded-lg border border-green-300 p-4 dark:border-green-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-green-600" />
                  <span className="font-semibold">{item.appName && item.grant!.mode === "app_install" ? item.appName : item.deviceName}</span>
                  {item.grant!.mode === "app_install" && <span className="text-sm text-muted-foreground">on {item.deviceName}</span>}
                  <Badge variant="outline">{elevationGrantModeLabels[item.grant!.mode]}</Badge>
                  <InstallBadge item={item} />
                </div>
                {item.grant!.mode === "credentials" && (
                  <GrantCountdown expiresAt={item.grant!.expiresAt} onExpire={() => refetch()} />
                )}
              </div>
              {item.grant!.mode === "app_install" && (
                <p className="text-sm text-muted-foreground">
                  Intune is installing it. Keep your device on and connected - it usually takes a few minutes.
                </p>
              )}
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

      {!isLoading && catalog.length > 0 && (
        <section className="mb-8 space-y-3">
          <h2 className="text-lg font-semibold">Install software</h2>
          <p className="text-sm text-muted-foreground">
            Approved apps install without admin rights. Apps marked for approval are installed automatically once an
            approver agrees.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.map((app) => (
              <CatalogCard key={app.id} app={app} canRequest={canCreate && devices.length > 0} onRequest={setInstallApp} />
            ))}
          </div>
        </section>
      )}

      {!isLoading && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Requests</h2>
          {others.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
              <KeyRound className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">You haven&apos;t made any requests yet.</p>
            </div>
          )}
          {others.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  {item.catalogAppId ? (
                    <Package className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Laptop className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="font-medium">
                    {item.catalogAppId ? `Install ${item.appName ?? "app"}` : item.deviceName}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${elevationRequestStatusClassNames[item.status]}`}
                  >
                    {elevationRequestStatusLabels[item.status]}
                  </span>
                  {item.grant && item.grant.status !== "active" && !item.install && (
                    <Badge variant="outline">{elevationGrantStatusLabels[item.grant.status]}</Badge>
                  )}
                  <InstallBadge item={item} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {item.catalogAppId ? (
                    <span>On {item.deviceName}</span>
                  ) : (
                    item.requestedMinutes !== null && <span>{formatMinutes(item.requestedMinutes)} requested</span>
                  )}
                  {!item.catalogAppId && item.appName && <span>For: {item.appName}</span>}
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
      <RequestInstallDialog
        app={installApp}
        onOpenChange={(open) => !open && setInstallApp(null)}
        devices={devices}
        requireReason={options.requireReason}
      />
    </PageShell>
  )
}
