"use client"

import { useParams, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Globe, Info, Laptop, ScrollText, ShieldCheck, Terminal } from "lucide-react"

import { PageShell } from "@/components/primitives/page-shell"
import { Protected } from "@/components/primitives/protected"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { usePermission } from "@/lib/rbac/context"
import { useUpdaterDevice } from "@/lib/api/security-software"
import { DeviceOverviewTab } from "@/components/security/software/device/device-overview-tab"
import { DevicePoliciesTab } from "@/components/security/software/device/device-policies-tab"
import { DeviceWebFilteringTab } from "@/components/security/software/device/device-web-filtering-tab"
import { DeviceActionsTab } from "@/components/security/software/device/device-actions-tab"
import { DeviceAuditTab } from "@/components/security/software/device/device-audit-tab"

const TABS = [
  { key: "overview", label: "Overview", icon: Info },
  { key: "policies", label: "Policies", icon: ShieldCheck },
  { key: "web-filtering", label: "Web filtering", icon: Globe },
  { key: "actions", label: "Actions", icon: Terminal },
  { key: "audit", label: "Audit log", icon: ScrollText },
] as const

function StatusBadge({ status, offline }: { status: string; offline: boolean }) {
  if (status === "revoked") return <Badge variant="destructive">Revoked</Badge>
  if (offline) return <Badge variant="outline" className="border-amber-400 text-amber-600">Offline</Badge>
  return <Badge variant="outline" className="border-green-400 text-green-600">Online</Badge>
}

export default function DeviceDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab = searchParams.get("tab") ?? "overview"
  const canEdit = usePermission("security.software-updates", "edit")

  const { data, isLoading } = useUpdaterDevice(id)
  const device = data?.data
  const compliance = data?.compliance ?? []
  const isAgent = !!device?.machineId && !device?.entraDeviceId

  const setTab = (key: string) =>
    router.replace(`/security/software-updates/devices/${id}?tab=${key}`, { scroll: false })

  const backButton = (
    <Button variant="ghost" size="icon" asChild>
      <Link href="/security/software-updates" aria-label="Back to devices">
        <ArrowLeft className="h-4 w-4" />
      </Link>
    </Button>
  )

  return (
    <Protected module="security.software-updates" action="view" showDenied>
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : !device ? (
        <PageShell title="Device not found" backButton={backButton} icon={Laptop}>
          <p className="text-muted-foreground">This device doesn&apos;t exist or you don&apos;t have access to it.</p>
        </PageShell>
      ) : (
        <PageShell
          title={device.hostname}
          icon={Laptop}
          backButton={backButton}
          statusBadge={<StatusBadge status={device.status} offline={device.offline} />}
          description={device.assetName ?? undefined}
        >
          <div className="flex flex-col gap-6 lg:flex-row">
            <nav className="flex gap-1 overflow-x-auto pb-1 lg:w-48 lg:shrink-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0">
              {TABS.map((t) => {
                const active = tab === t.key
                const Icon = t.icon
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                      active
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {t.label}
                  </button>
                )
              })}
            </nav>
            <div className="min-w-0 flex-1">
              {tab === "overview" && <DeviceOverviewTab device={device} internet={data?.internet} canEdit={canEdit} />}
              {tab === "policies" && <DevicePoliciesTab compliance={compliance} />}
              {tab === "web-filtering" && <DeviceWebFilteringTab device={device} compliance={compliance} />}
              {tab === "actions" && (
                <DeviceActionsTab
                  deviceId={id}
                  hostname={device.hostname}
                  isAgent={isAgent}
                  canEdit={canEdit}
                  pendingWipe={data?.pendingWipe ?? null}
                />
              )}
              {tab === "audit" && <DeviceAuditTab deviceId={id} />}
            </div>
          </div>
        </PageShell>
      )}
    </Protected>
  )
}
