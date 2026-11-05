"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { Globe, Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { GrantCountdown } from "@/components/security/elevation/grant-countdown"
import {
  useMyWebAccess,
  useCreateWebAccess,
  useCancelWebAccess,
  type MyWebAccessRequest,
} from "@/lib/api/security-web-access"

const STATUS_CLASS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  denied: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  cancelled: "bg-muted text-muted-foreground",
  expired: "bg-muted text-muted-foreground",
}
const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  denied: "Denied",
  cancelled: "Cancelled",
  expired: "Expired",
}

function isLive(r: MyWebAccessRequest): boolean {
  return r.status === "approved" && !!r.expiresAt && new Date(r.expiresAt).getTime() > Date.now()
}

function formatMins(m: number): string {
  return m % 60 === 0 ? `${m / 60} hr` : `${m} min`
}

export function MyWebAccess() {
  const { data, isLoading, refetch } = useMyWebAccess()
  const create = useCreateWebAccess()
  const cancel = useCancelWebAccess()
  const [open, setOpen] = useState(false)
  const [domain, setDomain] = useState("")
  const [minutes, setMinutes] = useState("")
  const [reason, setReason] = useState("")

  const options = data?.options.durationOptions ?? [10, 30, 60, 120]
  const items = data?.data ?? []

  const submit = async () => {
    try {
      await create.mutateAsync({ domain, minutes: Number(minutes || options[0]), reason: reason || null })
      toast.success("Request sent for approval")
      setOpen(false)
      setDomain("")
      setReason("")
      setMinutes("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send request")
    }
  }

  const doCancel = async (id: string) => {
    try {
      await cancel.mutateAsync(id)
      toast.success("Request cancelled")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel")
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Website access</h2>
          <p className="text-sm text-muted-foreground">
            Blocked from a site you need for work? Request temporary access - an approver can unblock it for a short
            time, then it&apos;s blocked again.
          </p>
        </div>
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Request access
        </Button>
      </div>

      {!isLoading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-muted-foreground">
          <Globe className="mb-3 h-8 w-8" />
          <p>No website access requests yet.</p>
        </div>
      )}

      {items.map((r) => {
        const live = isLive(r)
        return (
          <div key={r.id} className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{r.domain}</span>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[r.status] ?? ""}`}>
                  {live ? "Active" : STATUS_LABEL[r.status] ?? r.status}
                </span>
                {live && r.expiresAt && <GrantCountdown expiresAt={r.expiresAt} onExpire={() => refetch()} />}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>{formatMins(r.requestedMinutes)} requested</span>
                <span>{formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}</span>
                {r.reason && <span className="truncate">Reason: {r.reason}</span>}
              </div>
              {r.decisionNote && <p className="text-sm text-muted-foreground">Approver note: {r.decisionNote}</p>}
            </div>
            {r.status === "pending" && (
              <Button variant="outline" size="sm" onClick={() => doCancel(r.id)} disabled={cancel.isPending}>
                Cancel
              </Button>
            )}
          </div>
        )
      })}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request website access</DialogTitle>
            <DialogDescription>
              An approver reviews it; if approved, the site is unblocked for the time below, then blocked again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="wa-domain">Website</Label>
              <Input
                id="wa-domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="example.com"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wa-mins">How long</Label>
              <Select value={minutes} onValueChange={setMinutes}>
                <SelectTrigger id="wa-mins">
                  <SelectValue placeholder="Choose a duration" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {formatMins(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wa-reason">Reason</Label>
              <Textarea
                id="wa-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Why you need this site"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!domain.trim() || !minutes || create.isPending}>
              Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
