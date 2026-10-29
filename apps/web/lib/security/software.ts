/**
 * Security Software - shared helpers
 * Pure functions used by API routes and UI (no database or network access here)
 */

import type {
  SoftwareAccess,
  SoftwareInstallStatus,
  SoftwareUpdateMethod,
  SoftwareUpdateOutcome,
  SoftwareUpdatePackageResult,
  SoftwareUpdateRunStatus,
} from "@/lib/db/schema/security-software"

// ============================================================================
// LABELS
// ============================================================================

export const softwareAccessLabels: Record<SoftwareAccess, string> = {
  approval: "Request + approval",
  self_service: "Self-service (Company Portal)",
  managed: "Installed on every device",
}

export const softwareUpdateMethodLabels: Record<SoftwareUpdateMethod, string> = {
  winget: "IdaraOS Updater (winget)",
  self: "App's own updater",
  windows_update: "Windows Update",
  manual: "Manual (Intune supersedence)",
}

export const softwareInstallStatusLabels: Record<SoftwareInstallStatus, string> = {
  pending: "Waiting to assign",
  assigned: "Installing",
  installed: "Installed",
  failed: "Install failed",
  cancelled: "Cancelled",
}

export const softwareInstallStatusClassNames: Record<SoftwareInstallStatus, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  assigned: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  installed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
}

export const softwareUpdateRunStatusLabels: Record<SoftwareUpdateRunStatus, string> = {
  running: "Running",
  succeeded: "Succeeded",
  partial: "Partly failed",
  failed: "Failed",
}

export const softwareUpdateRunStatusClassNames: Record<SoftwareUpdateRunStatus, string> = {
  running: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  succeeded: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  partial: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
}

export const softwareUpdateOutcomeLabels: Record<SoftwareUpdateOutcome, string> = {
  updated: "Updated",
  up_to_date: "Up to date",
  not_installed: "Not installed",
  failed: "Failed",
}

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Winget package IDs, e.g. "Git.Git", "Notepad++.Notepad++", "Microsoft.VisualStudio.2022.Professional".
 * The updater runs as SYSTEM, so anything else is rejected on both the server and the device.
 */
export const WINGET_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.+_-]{0,127}$/

export function isValidWingetId(id: string): boolean {
  return WINGET_ID_PATTERN.test(id) && !id.includes("..")
}

export const SCHEDULE_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone })
    return true
  } catch {
    return false
  }
}

/** Longest a device may take to report a run before it's marked failed */
export const RUN_TIMEOUT_MINUTES = 4 * 60

/** Largest log tail kept per run */
export const MAX_RUN_LOG_CHARS = 64_000

export function truncateLog(log: string | null | undefined, max = MAX_RUN_LOG_CHARS): string | null {
  if (!log) return null
  return log.length > max ? `…(truncated)\n${log.slice(log.length - max)}` : log
}

/** The sweep retries adding a device to an install group this many times */
export const MAX_INSTALL_ATTEMPTS = 5

// ============================================================================
// RECOMMENDED APPS
// ============================================================================

export interface DefaultCatalogApp {
  name: string
  publisher: string
  description: string
  notes: string
  access: SoftwareAccess
  wingetId: string | null
  updateMethod: SoftwareUpdateMethod
  autoUpdate: boolean
}

/**
 * Added to each organization's catalog once. IT then links each app to its Intune app and install group.
 */
export const DEFAULT_CATALOG_APPS: DefaultCatalogApp[] = [
  {
    name: "Microsoft 365 Apps",
    publisher: "Microsoft",
    description: "Word, Excel, PowerPoint, Outlook, OneNote and Teams",
    notes:
      "Deploy with Intune's built-in Microsoft 365 Apps app type to all devices. Click-to-Run updates itself as SYSTEM; set the update channel in Intune.",
    access: "managed",
    wingetId: null,
    updateMethod: "self",
    autoUpdate: false,
  },
  {
    name: "Google Chrome",
    publisher: "Google",
    description: "Web browser",
    notes:
      "Deploy the Chrome Enterprise MSI to all devices. Google's updater service updates it as SYSTEM, so it's left out of the winget update list.",
    access: "managed",
    wingetId: "Google.Chrome",
    updateMethod: "self",
    autoUpdate: false,
  },
  {
    name: "Git",
    publisher: "Git for Windows",
    description: "Git version control",
    notes: "Install for the whole machine. Updated by the IdaraOS Updater.",
    access: "managed",
    wingetId: "Git.Git",
    updateMethod: "winget",
    autoUpdate: true,
  },
  {
    name: "Visual Studio 2022 Professional",
    publisher: "Microsoft",
    description: "IDE for .NET, C++ and web development",
    notes:
      "Package with Install-WingetApp.ps1 and a .vsconfig listing your workloads. Raise the Intune install timeout to 120+ minutes. Adding workloads later needs admin, so publish workload add-ons as separate catalog apps. Use the edition you're licensed for.",
    access: "approval",
    wingetId: "Microsoft.VisualStudio.2022.Professional",
    updateMethod: "winget",
    autoUpdate: true,
  },
  {
    name: "SQL Server Management Studio",
    publisher: "Microsoft",
    description: "Manage SQL Server and Azure SQL databases",
    notes: "Newer SSMS versions use the Visual Studio installer. Check the package ID with `winget search SSMS`.",
    access: "approval",
    wingetId: "Microsoft.SQLServerManagementStudio",
    updateMethod: "winget",
    autoUpdate: true,
  },
  {
    name: "SQL Server 2022 Developer",
    publisher: "Microsoft",
    description: "Local SQL Server instance for development",
    notes:
      "Patches come through Microsoft Update: turn on 'Microsoft product updates' in the Intune update ring. Set the SQL admins in the install (SQLSYSADMINACCOUNTS) or the user can't manage the instance. LocalDB (Visual Studio 'Data storage' workload) covers most developers without admin.",
    access: "approval",
    wingetId: "Microsoft.SQLServer.2022.Developer",
    updateMethod: "windows_update",
    autoUpdate: false,
  },
  {
    name: "NVM for Windows",
    publisher: "Corey Butler",
    description: "Node.js version manager",
    notes:
      "`nvm use` needs admin every time a user switches Node versions (it writes to Program Files). fnm (Schniz.fnm) or Volta switch versions per user without admin.",
    access: "approval",
    wingetId: "CoreyButler.NVMforWindows",
    updateMethod: "winget",
    autoUpdate: true,
  },
  {
    name: "Windows Subsystem for Linux",
    publisher: "Microsoft",
    description: "Run Linux distributions on Windows",
    notes:
      "Package with Install-WSL.ps1: enables Virtual Machine Platform, installs WSL and returns 3010 (reboot). Linux distros then install per user without admin.",
    access: "approval",
    wingetId: "Microsoft.WSL",
    updateMethod: "winget",
    autoUpdate: true,
  },
]

// ============================================================================
// SCHEDULE
// ============================================================================

export interface UpdateSchedule {
  enabled: boolean
  /** 0 = Sunday ... 6 = Saturday */
  days: number[]
  /** "HH:mm" */
  time: string
  timezone: string
}

interface ZonedParts {
  year: number
  month: number
  day: number
  weekday: number
  hour: number
  minute: number
}

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
const DAY_MS = 24 * 60 * 60 * 1000

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: WEEKDAY_INDEX[get("weekday")] ?? 0,
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  }
}

/** Time-zone offset (local - UTC) in ms at a given instant */
function zoneOffsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute)
  return asUtc - Math.floor(date.getTime() / 60_000) * 60_000
}

/** Convert a wall-clock time in a time zone to an instant */
function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute)
  const first = guess - zoneOffsetMs(new Date(guess), timeZone)
  const second = guess - zoneOffsetMs(new Date(first), timeZone)
  return new Date(second)
}

function occurrenceOn(date: Date, schedule: UpdateSchedule): Date | null {
  const local = zonedParts(date, schedule.timezone)
  if (!schedule.days.includes(local.weekday)) return null
  const [hour, minute] = schedule.time.split(":").map(Number)
  return zonedTimeToUtc(local.year, local.month, local.day, hour, minute, schedule.timezone)
}

/**
 * Most recent scheduled run at or before `now` (looks back one week)
 */
export function latestScheduledRun(schedule: UpdateSchedule, now: Date): Date | null {
  if (!schedule.enabled || schedule.days.length === 0) return null
  for (let i = 0; i <= 7; i++) {
    const occurrence = occurrenceOn(new Date(now.getTime() - i * DAY_MS), schedule)
    if (occurrence && occurrence.getTime() <= now.getTime()) return occurrence
  }
  return null
}

/**
 * Next scheduled run after `now`
 */
export function nextScheduledRun(schedule: UpdateSchedule, now: Date): Date | null {
  if (!schedule.enabled || schedule.days.length === 0) return null
  for (let i = 0; i <= 7; i++) {
    const occurrence = occurrenceOn(new Date(now.getTime() + i * DAY_MS), schedule)
    if (occurrence && occurrence.getTime() > now.getTime()) return occurrence
  }
  return null
}

/**
 * A device runs once per scheduled time. A device that was off at that time runs at its next check-in.
 */
export function isScheduledRunDue(
  schedule: UpdateSchedule,
  lastRunAt: Date | null,
  enrolledAt: Date,
  now: Date
): boolean {
  const occurrence = latestScheduledRun(schedule, now)
  if (!occurrence) return false
  if (occurrence.getTime() < enrolledAt.getTime()) return false
  return !lastRunAt || lastRunAt.getTime() < occurrence.getTime()
}

// ============================================================================
// RUNS
// ============================================================================

export interface RunSummary {
  status: Exclude<SoftwareUpdateRunStatus, "running">
  updatedCount: number
  failedCount: number
  rebootRequired: boolean
}

export function summarizeRun(results: SoftwareUpdatePackageResult[], error?: string | null): RunSummary {
  const updatedCount = results.filter((r) => r.outcome === "updated").length
  const failedCount = results.filter((r) => r.outcome === "failed").length
  const okCount = results.filter((r) => r.outcome === "updated" || r.outcome === "up_to_date").length
  const rebootRequired = results.some((r) => r.rebootRequired)

  let status: RunSummary["status"]
  if (error && results.length === 0) status = "failed"
  else if (failedCount === 0 && !error) status = "succeeded"
  else if (okCount > 0) status = "partial"
  else status = "failed"

  return { status, updatedCount, failedCount, rebootRequired }
}

// ============================================================================
// INTUNE
// ============================================================================

export type IntuneInstallState = "installed" | "failed" | "pending" | "unknown"

/**
 * Map an Intune install-state value (text or the numeric resultantAppState) to what IdaraOS tracks.
 * Numeric: 1 installed, 2 failed, 3 not installed, 4 uninstall failed, 5 pending install, 99 unknown.
 */
export function mapIntuneInstallState(value: unknown): IntuneInstallState {
  if (typeof value === "number") {
    if (value === 1) return "installed"
    if (value === 2) return "failed"
    if (value === 5) return "pending"
    return "unknown"
  }
  if (typeof value !== "string") return "unknown"
  const v = value.toLowerCase().replace(/[\s_-]/g, "")
  if (v === "installed") return "installed"
  if (v.includes("fail")) return "failed"
  if (v.includes("pending") || v.includes("inprogress")) return "pending"
  return "unknown"
}
