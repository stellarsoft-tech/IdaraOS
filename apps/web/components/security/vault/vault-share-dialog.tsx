"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { Loader2, Trash2, Users } from "lucide-react"
import { toast } from "sonner"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useItemShares, useRevokeShare, useShareItem, useShareTargets } from "@/lib/api/security-my-vault"

export function VaultShareDialog({
  open,
  itemId,
  onOpenChange,
}: {
  open: boolean
  itemId: string | null
  onOpenChange: (open: boolean) => void
}) {
  const shares = useItemShares(itemId, open)
  const targets = useShareTargets()
  const shareItem = useShareItem()
  const revoke = useRevokeShare()

  const [target, setTarget] = useState("")
  const [permission, setPermission] = useState<"view" | "edit">("view")
  const [expiresAt, setExpiresAt] = useState("")

  const add = async () => {
    if (!itemId || !target) return
    const [kind, id] = target.split(":")
    try {
      await shareItem.mutateAsync({
        itemId,
        targetUserId: kind === "user" ? id : null,
        targetGroupId: kind === "group" ? id : null,
        permission,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      })
      setTarget("")
      setExpiresAt("")
      toast.success("Shared")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't share the item")
    }
  }

  const doRevoke = async (shareId: string) => {
    if (!itemId) return
    try {
      await revoke.mutateAsync({ shareId, itemId })
      toast.success("Access removed")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove access")
    }
  }

  const t = targets.data?.data
  const current = shares.data?.data ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share item</DialogTitle>
          <DialogDescription>Give another member or a group access to this credential. Access is recorded in the audit log.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2 rounded-md border p-3">
            <Label>Share with</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a member or group…" />
              </SelectTrigger>
              <SelectContent>
                {t && t.groups.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Groups</SelectLabel>
                    {t.groups.map((g) => (
                      <SelectItem key={g.id} value={`group:${g.id}`}>
                        <span className="flex items-center gap-2">
                          <Users className="h-3.5 w-3.5" /> {g.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
                <SelectGroup>
                  <SelectLabel>Members</SelectLabel>
                  {t?.users.map((u) => (
                    <SelectItem key={u.id} value={`user:${u.id}`}>
                      {u.name ?? u.email}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Permission</Label>
                <Select value={permission} onValueChange={(v) => setPermission(v as "view" | "edit")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">View</SelectItem>
                    <SelectItem value="edit">Edit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Expires (optional)</Label>
                <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="h-9" />
              </div>
            </div>

            <Button className="w-full" onClick={add} disabled={!target || shareItem.isPending}>
              {shareItem.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Share
            </Button>
          </div>

          <div className="space-y-2">
            <Label>People with access</Label>
            {shares.isLoading ? (
              <div className="flex items-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : current.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not shared with anyone yet.</p>
            ) : (
              <div className="space-y-2">
                {current.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      {s.targetGroupId && <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                      <span className="truncate">{s.targetName ?? "Unknown"}</span>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {s.permission}
                      </Badge>
                      {s.expiresAt && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          expires {formatDistanceToNow(new Date(s.expiresAt), { addSuffix: true })}
                        </span>
                      )}
                    </span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => doRevoke(s.id)} disabled={revoke.isPending} aria-label="Remove access">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
