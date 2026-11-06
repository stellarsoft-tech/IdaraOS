"use client"

import { formatDistanceToNow } from "date-fns"
import { Globe, Loader2, Lock, MapPin, ShieldCheck, Unlock } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BitlockerSection } from "@/components/security/software/device-actions-dialog"
import {
  useDeviceLocation,
  useLockDeviceInternet,
  useUnlockDeviceInternet,
  type DeviceInternetStatus,
  type UpdaterDevice,
} from "@/lib/api/security-software"

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value ?? <span className="text-muted-foreground">—</span>}</dd>
    </div>
  )
}

function when(value: string | null): React.ReactNode {
  if (!value) return null
  return formatDistanceToNow(new Date(value), { addSuffix: true })
}

function InternetCard({
  device,
  internet,
  canEdit,
}: {
  device: UpdaterDevice
  internet: DeviceInternetStatus
  canEdit: boolean
}) {
  const lock = useLockDeviceInternet()
  const unlock = useUnlockDeviceInternet()
  const busy = lock.isPending || unlock.isPending

  const act = async (fn: Promise<unknown>, ok: string) => {
    try {
      await fn
      toast.success(ok)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed")
    }
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Internet access</span>
        </div>
        {internet.status === "quarantined" ? (
          <Badge variant="outline" className="border-red-400 text-red-600">Quarantined</Badge>
        ) : internet.status === "grace" ? (
          <Badge variant="outline" className="border-amber-400 text-amber-600">Grace period</Badge>
        ) : (
          <Badge variant="outline" className="border-green-400 text-green-600">Full access</Badge>
        )}
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        {internet.status === "quarantined" ? (
          <>Only IdaraOS is reachable. {internet.manual ? "Locked by an admin." : "Auto-quarantined — stayed non-compliant past the grace period."} Clears automatically once the device is compliant.</>
        ) : internet.status === "grace" ? (
          <>Non-compliant. {internet.graceEndsAt ? `Will be quarantined ${when(internet.graceEndsAt)}` : `Will be quarantined after ${internet.graceDays} day(s)`} unless fixed{internet.quarantineEnabled ? "" : " (quarantine is currently disabled org-wide)"}.</>
        ) : (
          <>Compliant — full internet access.</>
        )}
      </p>

      {canEdit && (
        <div className="mt-3">
          {internet.manual ? (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => act(unlock.mutateAsync(device.id), "Internet unlocked")}>
              <Unlock className="mr-1.5 h-3.5 w-3.5" /> Unlock internet
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => act(lock.mutateAsync(device.id), "Device quarantined")}>
              <Lock className="mr-1.5 h-3.5 w-3.5" /> Lock internet
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function LocationCard({ device }: { device: UpdaterDevice }) {
  const loc = useDeviceLocation(device.id)
  const geo = loc.data?.data ?? null

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-medium">
          <MapPin className="h-4 w-4 text-muted-foreground" /> Location
        </span>
        <Button variant="outline" size="sm" disabled={loc.isFetching} onClick={() => loc.refetch()}>
          {loc.isFetching ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Globe className="mr-1.5 h-3.5 w-3.5" />}
          Show location
        </Button>
      </div>
      {!loc.isFetched ? (
        <p className="text-sm text-muted-foreground">Approximate, from the device&apos;s public IP (city-level).</p>
      ) : geo ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">{[geo.city, geo.region, geo.country].filter(Boolean).join(", ") || "Unknown area"}</p>
          <p className="text-xs text-muted-foreground">IP {geo.ip} · approximate (city-level, via {geo.source})</p>
          {geo.lat != null && geo.lng != null && (
            <>
              <iframe
                title="Device location"
                className="h-56 w-full rounded-md border"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${geo.lng - 0.08}%2C${geo.lat - 0.06}%2C${geo.lng + 0.08}%2C${geo.lat + 0.06}&layer=mapnik&marker=${geo.lat}%2C${geo.lng}`}
              />
              <a
                className="text-xs underline"
                href={`https://www.openstreetmap.org/?mlat=${geo.lat}&mlon=${geo.lng}#map=11/${geo.lat}/${geo.lng}`}
                target="_blank"
                rel="noreferrer"
              >
                Open in OpenStreetMap
              </a>
            </>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {loc.data?.ip ? "Couldn't resolve a location for this IP." : "No public IP seen yet — the device hasn't checked in."}
        </p>
      )}
    </div>
  )
}

export function DeviceOverviewTab({
  device,
  internet,
  canEdit,
}: {
  device: UpdaterDevice
  internet?: DeviceInternetStatus
  canEdit: boolean
}) {
  const isAgent = !!device.machineId && !device.entraDeviceId
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-1 gap-4 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Hostname" value={device.hostname} />
        <Field
          label="Status"
          value={
            device.status === "revoked" ? (
              <Badge variant="destructive">Revoked</Badge>
            ) : device.offline ? (
              <Badge variant="outline" className="border-amber-400 text-amber-600">Offline</Badge>
            ) : (
              <Badge variant="outline" className="border-green-400 text-green-600">Online</Badge>
            )
          }
        />
        <Field label="Managed by" value={isAgent ? "IdaraOS Agent" : "Intune / Entra"} />
        <Field label="Operating system" value={device.osVersion} />
        <Field
          label="Agent version"
          value={
            <span className="flex items-center gap-2">
              {device.updaterVersion ?? "—"}
              {device.agentUpdateAvailable && (
                <Badge variant="outline" className="text-[10px]">Update available</Badge>
              )}
            </span>
          }
        />
        <Field label="winget version" value={device.wingetVersion} />
        <Field label="Last check-in" value={when(device.lastSeenAt)} />
        <Field label="Last update run" value={device.lastRunStatus ? `${device.lastRunStatus}${device.lastRunAt ? ` · ${when(device.lastRunAt)}` : ""}` : null} />
        <Field label="Linked member" value={device.linkedUserName} />
        <Field label="Signed-in Windows user" value={device.lastLoggedOnUser} />
        <Field label="Asset" value={device.assetName ? `${device.assetName}${device.assetTag ? ` · ${device.assetTag}` : ""}` : null} />
        <Field label="Serial number" value={device.serialNumber} />
        <Field label="Public IP" value={device.lastPublicIp} />
        <Field label="Enrolled" value={when(device.enrolledAt)} />
      </dl>

      {device.lastError && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-900/10">
          <span className="font-medium">Last reported error:</span> {device.lastError}
        </div>
      )}

      {isAgent && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {internet && <InternetCard device={device} internet={internet} canEdit={canEdit} />}
            <LocationCard device={device} />
          </div>
          <BitlockerSection deviceId={device.id} showEmpty />
        </>
      )}
    </div>
  )
}
