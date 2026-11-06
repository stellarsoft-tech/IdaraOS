"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AuditFieldDiff } from "@/components/audit/AuditFieldDiff"
import { useAuditLog, useAuditLogs } from "@/lib/api/audit"
import { POLICY_TYPES } from "@/lib/security/device-policies"
import type { AuditLogEntry } from "@/lib/audit"

const ACTION_LABELS: Record<string, string> = {
  device_action_completed: "Command completed",
  device_action_failed: "Command failed",
  device_action_queued: "Command queued",
  policy_reported_ok: "Policy compliant",
  policy_reported_error: "Policy error",
}

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ")
}

function Row({ entry }: { entry: AuditLogEntry }) {
  const [open, setOpen] = useState(false)
  const { data: detail, isLoading } = useAuditLog(open ? entry.id : null)
  const output = detail?.metadata?.output as string | undefined
  const metaEntries = detail?.metadata
    ? Object.entries(detail.metadata).filter(([k, v]) => k !== "output" && v != null)
    : []
  const fmt = (v: unknown) => (typeof v === "object" && v !== null ? JSON.stringify(v) : String(v))
  const changed = detail?.changedFields ?? []

  return (
    <div className="rounded-md border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 p-3 text-left hover:bg-muted/40"
      >
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            <span className="font-medium">{actionLabel(entry.action)}</span>
          </div>
          {entry.description && <p className="pl-5 text-sm text-muted-foreground">{entry.description}</p>}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
        </span>
      </button>
      {open && (
        <div className="space-y-2 border-t px-3 py-2 pl-8 text-xs">
          <div className="text-muted-foreground">
            by {entry.actorName ?? entry.actorEmail} · {new Date(entry.timestamp).toLocaleString()}
          </div>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <>
              {metaEntries.length > 0 && (
                <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1">
                  {metaEntries.map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="break-all font-mono">{fmt(v)}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {output && (
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded border bg-muted/50 p-2 font-mono">
                  {output}
                </pre>
              )}
              {changed.length > 0 && (
                <AuditFieldDiff
                  changedFields={changed}
                  previousValues={detail?.previousValues ?? null}
                  newValues={detail?.newValues ?? null}
                />
              )}
              {!output && metaEntries.length === 0 && changed.length === 0 && (
                <p className="text-muted-foreground">No additional details were recorded.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function DeviceAuditTab({ deviceId }: { deviceId: string }) {
  const [policy, setPolicy] = useState("all")
  const { data, isLoading } = useAuditLogs({
    entityId: deviceId,
    policyType: policy === "all" ? undefined : policy,
    limit: 100,
  })
  const logs = data?.logs ?? []

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Everything that happened on this device — commands, policy compliance, and more.</p>
        <Select value={policy} onValueChange={setPolicy}>
          <SelectTrigger className="h-8 w-56 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All activity</SelectItem>
            {POLICY_TYPES.map((p) => (
              <SelectItem key={p.type} value={p.type}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
          {policy === "all" ? "No activity recorded for this device yet." : "No activity for this policy."}
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((entry) => (
            <Row key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  )
}
