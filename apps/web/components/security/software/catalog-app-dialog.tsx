"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Search } from "lucide-react"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useIntuneApps, useSaveCatalogApp, type CatalogApp, type CatalogAppInput } from "@/lib/api/security-software"
import { softwareAccessValues, softwareUpdateMethodValues } from "@/lib/db/schema/security-software"
import { isValidWingetId, softwareAccessLabels, softwareUpdateMethodLabels } from "@/lib/security/software"

interface CatalogAppDialogProps {
  /** null = closed, "new" = add, otherwise the app to edit */
  app: CatalogApp | "new" | null
  onOpenChange: (open: boolean) => void
}

const EMPTY: CatalogAppInput = {
  name: "",
  publisher: null,
  description: null,
  notes: null,
  access: "approval",
  enabled: true,
  wingetId: null,
  updateMethod: "winget",
  autoUpdate: true,
  intuneAppId: null,
  intuneAppName: null,
  installGroupId: null,
  installGroupName: null,
  removeFromGroupAfterInstall: false,
  installDeadlineHours: 24,
}

function toInput(app: CatalogApp): CatalogAppInput {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = app
  return rest
}

export function CatalogAppDialog({ app, onOpenChange }: CatalogAppDialogProps) {
  const save = useSaveCatalogApp()
  const [form, setForm] = useState<CatalogAppInput>(EMPTY)
  const [search, setSearch] = useState("")
  const [submittedSearch, setSubmittedSearch] = useState<string | null>(null)
  const intuneApps = useIntuneApps(submittedSearch ?? "", submittedSearch !== null)

  useEffect(() => {
    if (app) {
      setForm(app === "new" ? EMPTY : toInput(app))
      setSearch("")
      setSubmittedSearch(null)
    }
  }, [app])

  const set = <K extends keyof CatalogAppInput>(key: K, value: CatalogAppInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const selectedIntuneApp = useMemo(
    () => intuneApps.data?.data.find((a) => a.id === form.intuneAppId) ?? null,
    [intuneApps.data, form.intuneAppId]
  )

  const wingetIdInvalid = !!form.wingetId && !isValidWingetId(form.wingetId)
  const needsWingetId = form.updateMethod === "winget" && form.autoUpdate && !form.wingetId
  const canSubmit = form.name.trim().length > 0 && !wingetIdInvalid && !needsWingetId && form.installDeadlineHours >= 1

  const chooseIntuneApp = (id: string) => {
    const picked = intuneApps.data?.data.find((a) => a.id === id)
    if (!picked) return
    // Default to the app's first Required group - that's what installs on group membership
    const required = picked.groups.find((g) => g.intent === "required")
    setForm((f) => ({
      ...f,
      intuneAppId: picked.id,
      intuneAppName: picked.name,
      installGroupId: required?.groupId ?? null,
      installGroupName: required ? (required.groupName ?? required.groupId) : null,
      publisher: f.publisher || picked.publisher,
    }))
  }

  const chooseGroup = (groupId: string) => {
    const group = selectedIntuneApp?.groups.find((g) => g.groupId === groupId)
    setForm((f) => ({ ...f, installGroupId: groupId, installGroupName: group?.groupName ?? groupId }))
  }

  const handleSubmit = async () => {
    if (!app) return
    try {
      const result = await save.mutateAsync({
        ...(app !== "new" && { id: app.id }),
        ...form,
        name: form.name.trim(),
        wingetId: form.wingetId?.trim() || null,
      })
      toast.success(app === "new" ? `${result.data.name} added` : `${result.data.name} saved`)
      if (result.warning) toast.warning(result.warning, { duration: 10_000 })
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save the app")
    }
  }

  return (
    <Dialog open={!!app} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{app === "new" ? "Add approved app" : "Edit approved app"}</DialogTitle>
          <DialogDescription>
            Intune installs approved apps as SYSTEM, so users never need admin rights or a password.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="app-name">Name</Label>
              <Input id="app-name" value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="app-publisher">Publisher</Label>
              <Input
                id="app-publisher"
                value={form.publisher ?? ""}
                onChange={(e) => set("publisher", e.target.value || null)}
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="app-access">How users get it</Label>
              <Select value={form.access} onValueChange={(v) => set("access", v as CatalogAppInput["access"])}>
                <SelectTrigger id="app-access">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {softwareAccessValues.map((v) => (
                    <SelectItem key={v} value={v}>
                      {softwareAccessLabels[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="app-description">Description (shown to users)</Label>
              <Input
                id="app-description"
                value={form.description ?? ""}
                onChange={(e) => set("description", e.target.value || null)}
                maxLength={500}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3 sm:col-span-2">
              <div>
                <Label htmlFor="app-enabled">Enabled</Label>
                <p className="text-xs text-muted-foreground">Disabled apps can&apos;t be requested and aren&apos;t updated.</p>
              </div>
              <Switch id="app-enabled" checked={form.enabled} onCheckedChange={(v) => set("enabled", v)} />
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold">Updates</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="app-update-method">Update method</Label>
                <Select
                  value={form.updateMethod}
                  onValueChange={(v) => set("updateMethod", v as CatalogAppInput["updateMethod"])}
                >
                  <SelectTrigger id="app-update-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {softwareUpdateMethodValues.map((v) => (
                      <SelectItem key={v} value={v}>
                        {softwareUpdateMethodLabels[v]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="app-winget">Winget ID</Label>
                <Input
                  id="app-winget"
                  value={form.wingetId ?? ""}
                  onChange={(e) => set("wingetId", e.target.value || null)}
                  placeholder="e.g. Git.Git"
                  className="font-mono"
                />
                {wingetIdInvalid && (
                  <p className="text-xs text-red-600">Only letters, numbers and . + _ - are allowed.</p>
                )}
              </div>
            </div>
            {form.updateMethod === "winget" && (
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label htmlFor="app-auto-update">Update automatically</Label>
                  <p className="text-xs text-muted-foreground">
                    The IdaraOS Updater runs <code>winget upgrade</code> for this app on every scheduled or manual run.
                  </p>
                  {needsWingetId && <p className="text-xs text-red-600">Add the winget ID first.</p>}
                </div>
                <Switch id="app-auto-update" checked={form.autoUpdate} onCheckedChange={(v) => set("autoUpdate", v)} />
              </div>
            )}
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold">Intune install</h3>
            <p className="text-xs text-muted-foreground">
              Approved installs add the device to the install group. The group must be an assigned device group with a
              Required assignment of this Intune app.
            </p>
            <div className="flex gap-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setSubmittedSearch(search.trim())}
                placeholder="Search Intune apps"
              />
              <Button type="button" variant="outline" onClick={() => setSubmittedSearch(search.trim())}>
                {intuneApps.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {intuneApps.error && <p className="text-xs text-red-600">{(intuneApps.error as Error).message}</p>}
            {intuneApps.data && (
              <Select value={selectedIntuneApp ? form.intuneAppId ?? "" : ""} onValueChange={chooseIntuneApp}>
                <SelectTrigger>
                  <SelectValue placeholder={`Choose from ${intuneApps.data.data.length} Intune apps`} />
                </SelectTrigger>
                <SelectContent>
                  {intuneApps.data.data.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} · {a.type}
                      {a.version ? ` · ${a.version}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Intune app: <span className="font-medium">{form.intuneAppName ?? "Not linked"}</span>
                </span>
                {form.intuneAppId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setForm((f) => ({ ...f, intuneAppId: null, intuneAppName: null, installGroupId: null, installGroupName: null }))
                    }
                  >
                    Unlink
                  </Button>
                )}
              </div>
              {selectedIntuneApp ? (
                <div className="mt-3 space-y-2">
                  <Label>Install group</Label>
                  {selectedIntuneApp.groups.length === 0 ? (
                    <p className="text-xs text-amber-600">This app has no group assignments in Intune yet.</p>
                  ) : (
                    <Select value={form.installGroupId ?? ""} onValueChange={chooseGroup}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose the install group" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedIntuneApp.groups.map((g) => (
                          <SelectItem key={`${g.groupId}-${g.intent}`} value={g.groupId}>
                            {g.groupName ?? g.groupId} ({g.intent})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ) : (
                <p className="mt-1 text-muted-foreground">
                  Install group: <span className="font-medium text-foreground">{form.installGroupName ?? "Not set"}</span>
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="app-deadline">Install deadline (hours)</Label>
                <Input
                  id="app-deadline"
                  type="number"
                  min={1}
                  max={168}
                  value={form.installDeadlineHours}
                  onChange={(e) => set("installDeadlineHours", Number(e.target.value))}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label htmlFor="app-remove">Remove from group after install</Label>
                  <p className="text-xs text-muted-foreground">The app stays installed.</p>
                </div>
                <Switch
                  id="app-remove"
                  checked={form.removeFromGroupAfterInstall}
                  onCheckedChange={(v) => set("removeFromGroupAfterInstall", v)}
                />
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <Label htmlFor="app-notes">Notes for IT</Label>
            <Textarea
              id="app-notes"
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value || null)}
              maxLength={2000}
              rows={3}
            />
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
