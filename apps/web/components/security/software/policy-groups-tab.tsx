"use client"

import { useEffect, useState } from "react"
import { Laptop, Loader2, Plus, Trash2, User, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { PolicySettingDef, PolicySettingValue } from "@/lib/security/device-policies"
import {
  usePolicyGroups,
  useCreatePolicyGroup,
  useDeletePolicyGroup,
  useAddGroupMember,
  useRemoveGroupMember,
  useSetGroupPolicy,
  type PolicyGroupView,
  type PolicyGroupsData,
} from "@/lib/api/security-policies"

/** Split a domain list textarea into clean, deduped entries (the server validates again). */
function parseDomains(text: string): string[] {
  return [...new Set(text.split(/[\s,]+/).map((d) => d.trim().toLowerCase()).filter(Boolean))]
}

/** A domain allow/block list: a textarea whose value commits (parsed) when it loses focus. */
function StringListField({
  setting,
  value,
  disabled,
  onChange,
}: {
  setting: Extract<PolicySettingDef, { kind: "string-list" }>
  value: PolicySettingValue | undefined
  disabled: boolean
  onChange: (value: string[]) => void
}) {
  const saved = (Array.isArray(value) ? value : setting.default).join("\n")
  const [text, setText] = useState(saved)
  // Re-sync when the saved value changes (e.g. the server normalized what we sent)
  useEffect(() => setText(saved), [saved])

  const commit = () => {
    const parsed = parseDomains(text)
    if (parsed.join("\n") !== saved) onChange(parsed)
  }

  return (
    <div className="space-y-1 text-xs">
      <span className="text-muted-foreground">{setting.label}</span>
      <Textarea
        value={text}
        rows={3}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        placeholder="one-domain-per-line.com"
        className="font-mono text-xs"
      />
      {setting.hint && <p className="text-muted-foreground">{setting.hint}</p>}
    </div>
  )
}

/** Render one policy setting by its kind: boolean toggle, category checkboxes, or a domain list. */
function PolicySettingField({
  setting,
  value,
  disabled,
  onChange,
}: {
  setting: PolicySettingDef
  value: PolicySettingValue | undefined
  disabled: boolean
  onChange: (value: PolicySettingValue) => void
}) {
  if (setting.kind === "boolean") {
    return (
      <label className="flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{setting.label}</span>
        <Switch
          checked={typeof value === "boolean" ? value : setting.default}
          disabled={disabled}
          onCheckedChange={(checked) => onChange(checked)}
        />
      </label>
    )
  }
  if (setting.kind === "multi-select") {
    const selected = new Set(Array.isArray(value) ? value : setting.default)
    return (
      <div className="space-y-1.5 text-xs">
        <span className="text-muted-foreground">{setting.label}</span>
        <div className="grid grid-cols-2 gap-1.5">
          {setting.options.map((o) => (
            <label key={o.value} className="flex items-center gap-2">
              <Checkbox
                checked={selected.has(o.value)}
                disabled={disabled}
                onCheckedChange={(checked) => {
                  const next = new Set(selected)
                  if (checked === true) next.add(o.value)
                  else next.delete(o.value)
                  onChange([...next])
                }}
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      </div>
    )
  }
  return <StringListField setting={setting} value={value} disabled={disabled} onChange={onChange} />
}

function CreateGroupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const create = useCreatePolicyGroup()

  const submit = async () => {
    try {
      await create.mutateAsync({ name, description: description || null })
      toast.success(`Group "${name}" created`)
      setName("")
      setDescription("")
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create the group")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New device group</DialogTitle>
          <DialogDescription>Add devices and people, then switch on the policies that apply to them.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="group-name">Name</Label>
            <Input id="group-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Finance laptops" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="group-desc">Description (optional)</Label>
            <Textarea id="group-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim() || create.isPending}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function GroupCard({
  group,
  options,
  policyTypes,
  canEdit,
}: {
  group: PolicyGroupView
  options: PolicyGroupsData["options"]
  policyTypes: PolicyGroupsData["policyTypes"]
  canEdit: boolean
}) {
  const addMember = useAddGroupMember()
  const removeMember = useRemoveGroupMember()
  const setPolicy = useSetGroupPolicy()
  const deleteGroup = useDeletePolicyGroup()

  const memberDeviceIds = new Set(group.members.filter((m) => m.kind === "device").map((m) => m.refId))
  const memberUserIds = new Set(group.members.filter((m) => m.kind === "user").map((m) => m.refId))
  const availableDevices = options.devices.filter((d) => !memberDeviceIds.has(d.id))
  const availableUsers = options.users.filter((u) => !memberUserIds.has(u.id))

  const onError = (error: unknown, fallback: string) =>
    toast.error(error instanceof Error ? error.message : fallback)

  const addDevice = async (deviceId: string) => {
    try {
      await addMember.mutateAsync({ groupId: group.id, deviceId })
    } catch (error) {
      onError(error, "Failed to add the device")
    }
  }
  const addUser = async (userId: string) => {
    try {
      await addMember.mutateAsync({ groupId: group.id, userId })
    } catch (error) {
      onError(error, "Failed to add the member")
    }
  }
  const remove = async (memberId: string) => {
    try {
      await removeMember.mutateAsync({ groupId: group.id, memberId })
    } catch (error) {
      onError(error, "Failed to remove the member")
    }
  }
  const togglePolicy = async (type: string, enabled: boolean) => {
    try {
      const current = group.policies.find((p) => p.type === type)
      await setPolicy.mutateAsync({ groupId: group.id, type, enabled, settings: current?.settings })
    } catch (error) {
      onError(error, "Failed to change the policy")
    }
  }
  const setSetting = async (type: string, key: string, value: PolicySettingValue) => {
    try {
      const current = group.policies.find((p) => p.type === type)
      const settings = { ...(current?.settings ?? {}), [key]: value }
      await setPolicy.mutateAsync({ groupId: group.id, type, enabled: current?.enabled ?? true, settings })
    } catch (error) {
      onError(error, "Failed to change the setting")
    }
  }
  const handleDelete = async () => {
    if (!window.confirm(`Delete the group "${group.name}"? Its policies stop applying to these devices.`)) return
    try {
      await deleteGroup.mutateAsync(group.id)
      toast.success(`Group "${group.name}" deleted`)
    } catch (error) {
      onError(error, "Failed to delete the group")
    }
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">{group.name}</h3>
          {group.description && <p className="text-sm text-muted-foreground">{group.description}</p>}
          <p className="mt-1 text-xs text-muted-foreground">
            {group.deviceCount} device{group.deviceCount === 1 ? "" : "s"} · {group.userCount} member
            {group.userCount === 1 ? "" : "s"}
          </p>
        </div>
        {canEdit && (
          <Button variant="ghost" size="sm" onClick={handleDelete} disabled={deleteGroup.isPending}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Separator className="my-3" />

      {/* Policies */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase text-muted-foreground">Policies</h4>
        {policyTypes.map((pt) => {
          const current = group.policies.find((p) => p.type === pt.type)
          const enabled = current?.enabled ?? false
          return (
            <div key={pt.type} className="rounded-md border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{pt.label}</div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{pt.description}</p>
                </div>
                <Switch
                  checked={enabled}
                  disabled={!canEdit || setPolicy.isPending}
                  onCheckedChange={(checked) => togglePolicy(pt.type, checked)}
                />
              </div>
              {enabled && pt.settings.length > 0 && (
                <div className="mt-2 space-y-2.5 border-t pt-2">
                  {pt.settings.map((s) => (
                    <PolicySettingField
                      key={s.key}
                      setting={s}
                      value={current?.settings?.[s.key]}
                      disabled={!canEdit || setPolicy.isPending}
                      onChange={(value) => setSetting(pt.type, s.key, value)}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <Separator className="my-3" />

      {/* Members */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase text-muted-foreground">Members</h4>
        {group.members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No devices or people yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {group.members.map((m) => (
              <Badge key={m.id} variant="secondary" className="gap-1.5 py-1 pl-2 pr-1">
                {m.kind === "device" ? <Laptop className="h-3 w-3" /> : <User className="h-3 w-3" />}
                <span>{m.name}</span>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => remove(m.id)}
                    className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                    aria-label={`Remove ${m.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            ))}
          </div>
        )}

        {canEdit && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Select value="" onValueChange={addDevice} disabled={availableDevices.length === 0 || addMember.isPending}>
              <SelectTrigger className="h-8 w-48 text-xs">
                <SelectValue placeholder={availableDevices.length ? "Add device…" : "No more devices"} />
              </SelectTrigger>
              <SelectContent>
                {availableDevices.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.hostname}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value="" onValueChange={addUser} disabled={availableUsers.length === 0 || addMember.isPending}>
              <SelectTrigger className="h-8 w-48 text-xs">
                <SelectValue placeholder={availableUsers.length ? "Add person…" : "No more people"} />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  )
}

export function PolicyGroupsTab({ canEdit }: { canEdit: boolean }) {
  const { data, isLoading } = usePolicyGroups()
  const [createOpen, setCreateOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const groups = data?.data ?? []
  const options = data?.options ?? { devices: [], users: [] }
  const policyTypes = data?.policyTypes ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Group agent devices and people, then switch on policies the IdaraOS Agent enforces. A person&apos;s policies
          apply to every agent device they&apos;re signed in to.
        </p>
        {canEdit && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            New group
          </Button>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="rounded-lg border py-12 text-center text-muted-foreground">
          No groups yet. Create one to start applying policies.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((group) => (
            <GroupCard key={group.id} group={group} options={options} policyTypes={policyTypes} canEdit={canEdit} />
          ))}
        </div>
      )}

      <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
