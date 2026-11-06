"use client"

import { useState } from "react"
import { ChevronDown, Loader2, Plus, Trash2, Users } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  useAddGroupMember,
  useCreateVaultGroup,
  useDeleteVaultGroup,
  useGroupMembers,
  useRemoveGroupMember,
  useVaultGroups,
  type VaultGroup,
} from "@/lib/api/security-vault-admin"
import { useShareTargets } from "@/lib/api/security-my-vault"

function GroupRow({ group, canEdit }: { group: VaultGroup; canEdit: boolean }) {
  const [open, setOpen] = useState(false)
  const [pick, setPick] = useState("")
  const members = useGroupMembers(group.id, open)
  const targets = useShareTargets()
  const add = useAddGroupMember()
  const remove = useRemoveGroupMember()
  const del = useDeleteVaultGroup()

  const memberList = members.data?.data ?? []
  const memberIds = new Set(memberList.map((m) => m.userId))
  const available = (targets.data?.data.users ?? []).filter((u) => !memberIds.has(u.id))

  const addMember = async () => {
    if (!pick) return
    try {
      await add.mutateAsync({ groupId: group.id, userId: pick })
      setPick("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add the member")
    }
  }

  const deleteGroup = async () => {
    if (!window.confirm(`Delete the group "${group.name}"? Shares to this group stop working.`)) return
    try {
      await del.mutateAsync(group.id)
      toast.success("Group deleted")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete the group")
    }
  }

  return (
    <div className="rounded-md border">
      <div className="flex items-center gap-2 p-3">
        <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setOpen((v) => !v)}>
          <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
          <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium">{group.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{group.memberCount} member{group.memberCount === 1 ? "" : "s"}</span>
        </button>
        {canEdit && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={deleteGroup} aria-label="Delete group">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {open && (
        <div className="space-y-3 border-t p-3">
          {members.isLoading ? (
            <Skeleton className="h-8 w-full" />
          ) : memberList.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          ) : (
            <div className="space-y-1.5">
              {memberList.map((m) => (
                <div key={m.userId} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    {m.name ?? m.email} {m.name && <span className="text-xs text-muted-foreground">{m.email}</span>}
                  </span>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => remove.mutate({ groupId: group.id, userId: m.userId })}
                      aria-label="Remove member"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          {canEdit && (
            <div className="flex gap-2">
              <Select value={pick} onValueChange={setPick}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Add a member…" />
                </SelectTrigger>
                <SelectContent>
                  {available.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">Everyone is already a member</div>
                  ) : (
                    available.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name ?? u.email}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button onClick={addMember} disabled={!pick || add.isPending}>
                {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function VaultGroups({ canEdit }: { canEdit: boolean }) {
  const groups = useVaultGroups()
  const create = useCreateVaultGroup()
  const [name, setName] = useState("")

  const addGroup = async () => {
    if (!name.trim()) return
    try {
      await create.mutateAsync(name.trim())
      setName("")
      toast.success("Group created")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create the group")
    }
  }

  const list = groups.data?.data ?? []

  return (
    <div className="rounded-lg border p-5">
      <h2 className="mb-1 text-lg font-semibold">Sharing groups</h2>
      <p className="mb-4 text-sm text-muted-foreground">Reusable sets of members. Anyone can share a vault item or folder with a group.</p>

      {canEdit && (
        <div className="mb-4 flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New group name" onKeyDown={(e) => e.key === "Enter" && addGroup()} />
          <Button onClick={addGroup} disabled={!name.trim() || create.isPending}>
            <Plus className="mr-1.5 h-4 w-4" /> Create
          </Button>
        </div>
      )}

      {groups.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">No groups yet.</p>
      ) : (
        <div className="space-y-2">
          {list.map((g) => (
            <GroupRow key={g.id} group={g} canEdit={canEdit} />
          ))}
        </div>
      )}
    </div>
  )
}
