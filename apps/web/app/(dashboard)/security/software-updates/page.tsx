"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { format, formatDistanceToNow } from "date-fns"
import { AlertTriangle, Laptop, Loader2, PackageCheck, Play, RefreshCw, WifiOff } from "lucide-react"
import { toast } from "sonner"

import { PageShell } from "@/components/primitives/page-shell"
import { Protected } from "@/components/primitives/protected"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EnrollmentTokenCard } from "@/components/security/software/enrollment-token-card"
import { UpdateRunDialog } from "@/components/security/software/update-run-dialog"
import {
  useRevokeUpdaterDevice,
  useRunAllUpdates,
  useRunDeviceUpdate,
  useSoftwareUpdates,
  useUpdateRuns,
  useUpdateSchedule,
  type SoftwareUpdatesData,
  type UpdaterDevice,
} from "@/lib/api/security-software"
import { softwareUpdateRunStatusValues, type SoftwareUpdateRunStatus } from "@/lib/db/schema/security-software"
import { usePermission } from "@/lib/rbac/context"
import {
  SCHEDULE_TIME_PATTERN,
  WEEKDAY_LABELS,
  softwareUpdateRunStatusClassNames,
  softwareUpdateRunStatusLabels,
} from "@/lib/security/software"

const ALL = "all"

function RunStatus({ status }: { status: SoftwareUpdateRunStatus | null }) {
  if (!status) return <span className="text-xs text-muted-foreground">Never run</span>
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${softwareUpdateRunStatusClassNames[status]}`}>
      {softwareUpdateRunStatusLabels[status]}
    </span>
  )
}

function DevicesTab({
  devices,
  canEdit,
  onShowLog,
}: {
  devices: UpdaterDevice[]
  canEdit: boolean
  onShowLog: (deviceId: string) => void
}) {
  const runNow = useRunDeviceUpdate()
  const revoke = useRevokeUpdaterDevice()

  const handleRun = async (device: UpdaterDevice) => {
    try {
      await runNow.mutateAsync(device.id)
      toast.success(`${device.hostname} will run updates at its next check-in`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to request updates")
    }
  }

  const handleRevoke = async (device: UpdaterDevice) => {
    if (!window.confirm(`Stop software updates on ${device.hostname}? Its logs are kept.`)) return
    try {
      await revoke.mutateAsync(device.id)
      toast.success(`${device.hostname} revoked`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to revoke the device")
    }
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Device</TableHead>
            <TableHead>Last check-in</TableHead>
            <TableHead>Last update run</TableHead>
            <TableHead>Versions</TableHead>
            <TableHead className="w-56" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {devices.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                No devices yet. Deploy the IdaraOS Updater package from Intune (see the Schedule &amp; enrollment tab).
              </TableCell>
            </TableRow>
          )}
          {devices.map((d) => (
            <TableRow key={d.id} className={d.status === "revoked" ? "opacity-60" : undefined}>
              <TableCell>
                <div className="flex items-center gap-2 font-medium">
                  <Laptop className="h-4 w-4 text-muted-foreground" />
                  {d.hostname}
                </div>
                <div className="text-xs text-muted-foreground">
                  {[d.assetName, d.assetTag, d.serialNumber].filter(Boolean).join(" · ")}
                </div>
                {d.status === "revoked" && <Badge variant="outline" className="mt-1">Revoked</Badge>}
              </TableCell>
              <TableCell className="text-xs">
                {d.lastSeenAt ? formatDistanceToNow(new Date(d.lastSeenAt), { addSuffix: true }) : "Never"}
                {d.offline && d.status === "active" && (
                  <div className="mt-1 flex items-center gap-1 text-amber-600">
                    <WifiOff className="h-3 w-3" /> Offline
                  </div>
                )}
              </TableCell>
              <TableCell className="text-xs">
                <RunStatus status={d.lastRunStatus} />
                {d.lastRunAt && (
                  <div className="mt-1 text-muted-foreground">{format(new Date(d.lastRunAt), "MMM d, HH:mm")}</div>
                )}
                {d.runRequestedAt && <div className="mt-1 text-blue-600">Run requested - waiting for check-in</div>}
                {d.lastError && (
                  <div className="mt-1 flex max-w-[280px] items-start gap-1 text-red-600">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span className="line-clamp-2">{d.lastError}</span>
                  </div>
                )}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                <div>Updater {d.updaterVersion ?? "—"}</div>
                <div>winget {d.wingetVersion ?? "—"}</div>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => onShowLog(d.id)}>
                    Log
                  </Button>
                  {canEdit && d.status === "active" && (
                    <>
                      <Button size="sm" onClick={() => handleRun(d)} disabled={runNow.isPending}>
                        <Play className="mr-1.5 h-3.5 w-3.5" />
                        Run now
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleRevoke(d)} disabled={revoke.isPending}>
                        Revoke
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function LogTab({
  devices,
  deviceFilter,
  onDeviceFilter,
}: {
  devices: UpdaterDevice[]
  deviceFilter: string
  onDeviceFilter: (id: string) => void
}) {
  const [statusFilter, setStatusFilter] = useState(ALL)
  const [openRun, setOpenRun] = useState<string | null>(null)
  const { data, isLoading } = useUpdateRuns(
    deviceFilter === ALL ? undefined : deviceFilter,
    statusFilter === ALL ? undefined : statusFilter
  )
  const runs = data?.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Select value={deviceFilter} onValueChange={onDeviceFilter}>
          <SelectTrigger className="w-60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All devices</SelectItem>
            {devices.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.hostname}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All results</SelectItem>
            {softwareUpdateRunStatusValues.map((s) => (
              <SelectItem key={s} value={s}>
                {softwareUpdateRunStatusLabels[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Started</TableHead>
              <TableHead>Device</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Result</TableHead>
              <TableHead>Packages</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}
            {!isLoading && runs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No update runs yet.
                </TableCell>
              </TableRow>
            )}
            {runs.map((run) => (
              <TableRow key={run.id} className="cursor-pointer" onClick={() => setOpenRun(run.id)}>
                <TableCell className="whitespace-nowrap text-xs">{format(new Date(run.startedAt), "MMM d, yyyy HH:mm")}</TableCell>
                <TableCell className="font-medium">{run.hostname}</TableCell>
                <TableCell className="text-xs">
                  {run.trigger === "manual" ? `Run now${run.requestedByName ? ` · ${run.requestedByName}` : ""}` : "Scheduled"}
                </TableCell>
                <TableCell>
                  <RunStatus status={run.status} />
                  {run.error && <div className="mt-1 max-w-[280px] truncate text-xs text-red-600">{run.error}</div>}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {run.updatedCount} updated · {run.failedCount} failed · {run.packages.length} checked
                  {run.rebootRequired && <Badge variant="outline" className="ml-2">Restart needed</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <UpdateRunDialog runId={openRun} onOpenChange={(open) => !open && setOpenRun(null)} />
    </div>
  )
}

function ScheduleTab({ data, canEdit }: { data: SoftwareUpdatesData; canEdit: boolean }) {
  const update = useUpdateSchedule()
  const [form, setForm] = useState({
    scheduleEnabled: data.settings.scheduleEnabled,
    scheduleDays: data.settings.scheduleDays,
    scheduleTime: data.settings.scheduleTime,
    scheduleTimezone: data.settings.scheduleTimezone,
    checkInMinutes: data.settings.checkInMinutes,
  })

  useEffect(() => {
    setForm({
      scheduleEnabled: data.settings.scheduleEnabled,
      scheduleDays: data.settings.scheduleDays,
      scheduleTime: data.settings.scheduleTime,
      scheduleTimezone: data.settings.scheduleTimezone,
      checkInMinutes: data.settings.checkInMinutes,
    })
  }, [data.settings])

  const timeZones = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone")
    } catch {
      return ["UTC"]
    }
  }, [])

  const toggleDay = (day: number, checked: boolean) =>
    setForm((f) => ({
      ...f,
      scheduleDays: checked ? [...f.scheduleDays, day].sort() : f.scheduleDays.filter((d) => d !== day),
    }))

  const valid =
    SCHEDULE_TIME_PATTERN.test(form.scheduleTime) &&
    (!form.scheduleEnabled || form.scheduleDays.length > 0) &&
    form.checkInMinutes >= 5 &&
    form.checkInMinutes <= 240

  const handleSave = async () => {
    try {
      await update.mutateAsync(form)
      toast.success("Schedule saved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save the schedule")
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-5 rounded-lg border p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="schedule-enabled" className="text-base font-semibold">
              Scheduled updates for every device
            </Label>
            <p className="text-sm text-muted-foreground">
              Each device runs once per scheduled time. A device that was off runs at its next check-in.
            </p>
          </div>
          <Switch
            id="schedule-enabled"
            checked={form.scheduleEnabled}
            onCheckedChange={(v) => setForm((f) => ({ ...f, scheduleEnabled: v }))}
            disabled={!canEdit}
          />
        </div>

        <div className="space-y-2">
          <Label>Days</Label>
          <div className="flex flex-wrap gap-4">
            {WEEKDAY_LABELS.map((label, day) => (
              <label key={label} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.scheduleDays.includes(day)}
                  onCheckedChange={(checked) => toggleDay(day, checked === true)}
                  disabled={!canEdit}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="schedule-time">Time</Label>
            <Input
              id="schedule-time"
              type="time"
              value={form.scheduleTime}
              onChange={(e) => setForm((f) => ({ ...f, scheduleTime: e.target.value }))}
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="schedule-tz">Time zone</Label>
            <Select
              value={form.scheduleTimezone}
              onValueChange={(v) => setForm((f) => ({ ...f, scheduleTimezone: v }))}
              disabled={!canEdit}
            >
              <SelectTrigger id="schedule-tz">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {timeZones.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="check-in">Check-in every (minutes)</Label>
            <Input
              id="check-in"
              type="number"
              min={5}
              max={240}
              value={form.checkInMinutes}
              onChange={(e) => setForm((f) => ({ ...f, checkInMinutes: Number(e.target.value) }))}
              disabled={!canEdit}
            />
            <p className="text-xs text-muted-foreground">How quickly &quot;Run now&quot; reaches a device.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {data.settings.nextRunAt
              ? `Next scheduled run: ${format(new Date(data.settings.nextRunAt), "EEE MMM d, HH:mm")} (your time)`
              : "No scheduled runs."}
          </p>
          {canEdit && (
            <Button onClick={handleSave} disabled={!valid || update.isPending}>
              {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save schedule
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2 rounded-lg border p-4">
        <h3 className="font-semibold">Packages updated on each run</h3>
        <p className="text-sm text-muted-foreground">
          Enabled apps in{" "}
          <Link href="/security/software" className="underline">
            Approved Software
          </Link>{" "}
          with a winget ID and automatic updates on. New apps are picked up on the next run - nothing to redeploy.
        </p>
        {data.packages.length === 0 ? (
          <p className="text-sm text-amber-600">No apps are set to update automatically.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.packages.map((p) => (
              <Badge key={p.wingetId} variant="secondary" className="font-normal">
                {p.name} <code className="ml-1 text-muted-foreground">{p.wingetId}</code>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <EnrollmentTokenCard
        hint={data.settings.enrollmentTokenHint}
        createdAt={data.settings.enrollmentTokenCreatedAt}
        canEdit={canEdit}
      />
    </div>
  )
}

export default function SoftwareUpdatesPage() {
  const { data, isLoading } = useSoftwareUpdates()
  const runAll = useRunAllUpdates()
  const canEdit = usePermission("security.software-updates", "edit")
  const [tab, setTab] = useState("devices")
  const [deviceFilter, setDeviceFilter] = useState(ALL)

  const devices = data?.data ?? []

  const handleRunAll = async () => {
    if (!window.confirm("Run updates on every device at its next check-in?")) return
    try {
      const result = await runAll.mutateAsync()
      toast.success(`Requested updates on ${result.data.count} devices`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to request updates")
    }
  }

  const showLog = (deviceId: string) => {
    setDeviceFilter(deviceId)
    setTab("log")
  }

  return (
    <PageShell
      title="Software Updates"
      description="The IdaraOS Updater runs winget as SYSTEM on each device, so updates never ask users for admin rights."
      icon={RefreshCw}
      action={
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/security/software">
              <PackageCheck className="mr-2 h-4 w-4" />
              Approved software
            </Link>
          </Button>
          <Protected module="security.software-updates" action="edit">
            <Button onClick={handleRunAll} disabled={runAll.isPending || devices.length === 0}>
              {runAll.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Run on all devices
            </Button>
          </Protected>
        </div>
      }
    >
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-4">
          <span className="text-sm font-medium text-muted-foreground">Devices</span>
          <p className="mt-1 text-2xl font-bold">{data?.stats.devices ?? 0}</p>
        </div>
        <div className="rounded-lg border bg-red-50 p-4 dark:bg-red-900/10">
          <span className="text-sm font-medium text-red-800 dark:text-red-400">Last run failed</span>
          <p className="mt-1 text-2xl font-bold text-red-900 dark:text-red-300">{data?.stats.failing ?? 0}</p>
        </div>
        <div className="rounded-lg border bg-amber-50 p-4 dark:bg-amber-900/10">
          <span className="text-sm font-medium text-amber-800 dark:text-amber-400">Offline</span>
          <p className="mt-1 text-2xl font-bold text-amber-900 dark:text-amber-300">{data?.stats.offline ?? 0}</p>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="devices">Devices ({devices.length})</TabsTrigger>
            <TabsTrigger value="log">Update log</TabsTrigger>
            <TabsTrigger value="schedule">Schedule &amp; enrollment</TabsTrigger>
          </TabsList>
          <TabsContent value="devices" className="mt-4">
            <DevicesTab devices={devices} canEdit={canEdit} onShowLog={showLog} />
          </TabsContent>
          <TabsContent value="log" className="mt-4">
            <LogTab devices={devices} deviceFilter={deviceFilter} onDeviceFilter={setDeviceFilter} />
          </TabsContent>
          <TabsContent value="schedule" className="mt-4">
            <ScheduleTab data={data} canEdit={canEdit} />
          </TabsContent>
        </Tabs>
      )}
    </PageShell>
  )
}
