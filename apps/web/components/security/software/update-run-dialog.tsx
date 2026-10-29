"use client"

import { format } from "date-fns"
import { Loader2 } from "lucide-react"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useUpdateRun } from "@/lib/api/security-software"
import {
  softwareUpdateOutcomeLabels,
  softwareUpdateRunStatusClassNames,
  softwareUpdateRunStatusLabels,
} from "@/lib/security/software"

interface UpdateRunDialogProps {
  runId: string | null
  onOpenChange: (open: boolean) => void
}

const outcomeVariants = {
  updated: "default",
  up_to_date: "secondary",
  not_installed: "outline",
  failed: "destructive",
} as const

export function UpdateRunDialog({ runId, onOpenChange }: UpdateRunDialogProps) {
  const { data, isLoading } = useUpdateRun(runId)
  const run = data?.data

  return (
    <Dialog open={!!runId} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Update run{run ? ` · ${run.hostname}` : ""}</DialogTitle>
          <DialogDescription>
            {run &&
              `${run.trigger === "manual" ? "Run now" : "Scheduled"} · started ${format(new Date(run.startedAt), "MMM d, yyyy HH:mm")}${
                run.finishedAt ? ` · finished ${format(new Date(run.finishedAt), "HH:mm")}` : ""
              }`}
          </DialogDescription>
        </DialogHeader>

        {isLoading || !run ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${softwareUpdateRunStatusClassNames[run.status]}`}
              >
                {softwareUpdateRunStatusLabels[run.status]}
              </span>
              <span className="text-muted-foreground">
                {run.updatedCount} updated · {run.failedCount} failed · {run.packages.length} checked
              </span>
              {run.rebootRequired && <Badge variant="outline">Restart needed</Badge>}
            </div>
            {run.error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/10 dark:text-red-400">{run.error}</p>}

            {run.results.length > 0 && (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Package</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {run.results.map((r) => (
                      <TableRow key={r.wingetId}>
                        <TableCell>
                          <div className="font-medium">{r.name ?? r.wingetId}</div>
                          <code className="text-xs text-muted-foreground">{r.wingetId}</code>
                        </TableCell>
                        <TableCell>
                          <Badge variant={outcomeVariants[r.outcome]}>{softwareUpdateOutcomeLabels[r.outcome]}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.outcome === "updated" && r.fromVersion && r.toVersion
                            ? `${r.fromVersion} → ${r.toVersion}`
                            : (r.toVersion ?? r.fromVersion ?? "—")}
                        </TableCell>
                        <TableCell className="max-w-[260px] text-xs text-muted-foreground">
                          {r.message}
                          {r.exitCode !== undefined && r.exitCode !== null && r.exitCode !== 0 && (
                            <span className="block font-mono">Exit code {r.exitCode}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Device log</h3>
              {run.log ? (
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs">{run.log}</pre>
              ) : (
                <p className="text-sm text-muted-foreground">No log was sent for this run.</p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
