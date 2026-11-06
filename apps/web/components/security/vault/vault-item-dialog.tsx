"use client"

import { useEffect, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { Copy, Eye, EyeOff, History, Loader2, RefreshCw, Trash2, Wand2 } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  useCreateVaultItem,
  useDeleteVaultItem,
  useUpdateVaultItem,
  useVaultItem,
  useVaultItemHistory,
  type VaultFolder,
  type VaultItemType,
} from "@/lib/api/security-my-vault"
import { DEFAULT_PASSWORD_OPTIONS, MAX_LENGTH, MIN_LENGTH, generatePassword, type PasswordOptions } from "@/lib/vault/generator"
import { estimateStrength } from "@/lib/vault/strength"

const NO_FOLDER = "none"

interface FormState {
  type: VaultItemType
  title: string
  username: string
  url: string
  password: string
  notes: string
  folderId: string
  favorite: boolean
}

const EMPTY_FORM: FormState = {
  type: "login",
  title: "",
  username: "",
  url: "",
  password: "",
  notes: "",
  folderId: NO_FOLDER,
  favorite: false,
}

const STRENGTH_COLORS = ["bg-red-500", "bg-orange-500", "bg-amber-500", "bg-lime-500", "bg-green-500"]

interface Props {
  open: boolean
  itemId: string | null
  folders: VaultFolder[]
  canEdit: boolean
  canDelete: boolean
  onOpenChange: (open: boolean) => void
}

export function VaultItemDialog({ open, itemId, folders, canEdit, canDelete, onOpenChange }: Props) {
  const isEdit = !!itemId
  const detail = useVaultItem(open ? itemId : null)
  const create = useCreateVaultItem()
  const update = useUpdateVaultItem()
  const remove = useDeleteVaultItem()

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [showPassword, setShowPassword] = useState(false)
  const [showGenerator, setShowGenerator] = useState(false)
  const [gen, setGen] = useState<PasswordOptions>(DEFAULT_PASSWORD_OPTIONS)
  const [showHistory, setShowHistory] = useState(false)

  const history = useVaultItemHistory(itemId, open && showHistory)

  // Populate the form when the dialog opens (from the loaded detail for edit, or blank for create)
  useEffect(() => {
    if (!open) return
    if (itemId) {
      const d = detail.data?.data
      if (d) {
        setForm({
          type: d.type,
          title: d.title,
          username: d.username ?? "",
          url: d.url ?? "",
          password: d.password ?? "",
          notes: d.notes ?? "",
          folderId: d.folderId ?? NO_FOLDER,
          favorite: d.favorite,
        })
      }
    } else {
      setForm(EMPTY_FORM)
    }
  }, [open, itemId, detail.data])

  useEffect(() => {
    if (!open) {
      setShowPassword(false)
      setShowGenerator(false)
      setShowHistory(false)
    }
  }, [open])

  const loadingDetail = isEdit && detail.isLoading
  const readOnly = isEdit && !canEdit
  const saving = create.isPending || update.isPending
  const strength = estimateStrength(form.password)

  const regenerate = () => setForm((f) => ({ ...f, password: generatePassword(gen) }))

  const copyField = async (value: string, label: string) => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copied`)
    } catch {
      toast.error("Couldn't copy to the clipboard")
    }
  }

  const save = async () => {
    if (!form.title.trim()) {
      toast.error("A title is required")
      return
    }
    const payload = {
      type: form.type,
      title: form.title.trim(),
      username: form.username.trim() || null,
      url: form.url.trim() || null,
      favorite: form.favorite,
      folderId: form.folderId === NO_FOLDER ? null : form.folderId,
      password: form.password || null,
      notes: form.notes || null,
    }
    try {
      if (isEdit && itemId) {
        await update.mutateAsync({ id: itemId, ...payload })
        toast.success("Item updated")
      } else {
        await create.mutateAsync(payload)
        toast.success("Item saved")
      }
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the item")
    }
  }

  const doDelete = async () => {
    if (!itemId) return
    if (!window.confirm(`Delete "${form.title || "this item"}"? This can't be undone.`)) return
    try {
      await remove.mutateAsync(itemId)
      toast.success("Item deleted")
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete the item")
    }
  }

  const genToggle = (key: keyof PasswordOptions) => (v: boolean | "indeterminate") =>
    setGen((g) => ({ ...g, [key]: v === true }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit item" : "Add item"}</DialogTitle>
          <DialogDescription>
            Secrets are encrypted at rest; viewing or copying them is recorded in the audit log.
          </DialogDescription>
        </DialogHeader>

        {loadingDetail ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as VaultItemType }))} disabled={readOnly}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="login">Login</SelectItem>
                    <SelectItem value="note">Secure note</SelectItem>
                    <SelectItem value="card">Payment card</SelectItem>
                    <SelectItem value="identity">Identity</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Folder</Label>
                <Select value={form.folderId} onValueChange={(v) => setForm((f) => ({ ...f, folderId: v }))} disabled={readOnly}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_FOLDER}>No folder</SelectItem>
                    {folders.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vault-title">Title</Label>
              <Input
                id="vault-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Company AWS"
                disabled={readOnly}
              />
            </div>

            {form.type === "login" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="vault-username">Username / email</Label>
                  <div className="flex gap-2">
                    <Input
                      id="vault-username"
                      value={form.username}
                      onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                      disabled={readOnly}
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => copyField(form.username, "Username")} aria-label="Copy username">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="vault-url">Website</Label>
                  <Input
                    id="vault-url"
                    value={form.url}
                    onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                    placeholder="example.com"
                    disabled={readOnly}
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="vault-password">Password</Label>
              <div className="flex gap-2">
                <Input
                  id="vault-password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="font-mono"
                  disabled={readOnly}
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => setShowPassword((v) => !v)} aria-label="Show/hide password">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => copyField(form.password, "Password")} aria-label="Copy password">
                  <Copy className="h-4 w-4" />
                </Button>
                {!readOnly && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => setShowGenerator((v) => !v)} aria-label="Password generator">
                    <Wand2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {form.password && (
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex h-1.5 flex-1 gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-full ${i <= strength.score ? STRENGTH_COLORS[strength.score] : "bg-muted"}`}
                      />
                    ))}
                  </div>
                  <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">{strength.label}</span>
                </div>
              )}

              {showGenerator && !readOnly && (
                <div className="mt-2 space-y-3 rounded-md border bg-muted/30 p-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="gen-length" className="text-xs">
                      Length
                    </Label>
                    <Input
                      id="gen-length"
                      type="number"
                      min={MIN_LENGTH}
                      max={MAX_LENGTH}
                      value={gen.length}
                      onChange={(e) =>
                        setGen((g) => ({ ...g, length: Math.max(MIN_LENGTH, Math.min(MAX_LENGTH, Number(e.target.value) || g.length)) }))
                      }
                      className="h-8 w-20"
                    />
                    <Button type="button" size="sm" variant="secondary" className="ml-auto" onClick={regenerate}>
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Generate
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {(
                      [
                        ["uppercase", "A–Z"],
                        ["lowercase", "a–z"],
                        ["digits", "0–9"],
                        ["symbols", "Symbols"],
                        ["avoidAmbiguous", "Avoid ambiguous"],
                      ] as [keyof PasswordOptions, string][]
                    ).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2">
                        <Checkbox checked={gen[key] as boolean} onCheckedChange={genToggle(key)} />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vault-notes">Notes</Label>
              <Textarea
                id="vault-notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
                disabled={readOnly}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="vault-favorite">Favorite</Label>
              <Switch
                id="vault-favorite"
                checked={form.favorite}
                onCheckedChange={(v) => setForm((f) => ({ ...f, favorite: v }))}
                disabled={readOnly}
              />
            </div>

            {isEdit && (
              <div className="rounded-md border">
                <button
                  type="button"
                  onClick={() => setShowHistory((v) => !v)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  <History className="h-4 w-4" /> Password history
                </button>
                {showHistory && (
                  <div className="space-y-2 border-t p-3">
                    {history.isLoading ? (
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Loading…
                      </div>
                    ) : (history.data?.data.length ?? 0) === 0 ? (
                      <p className="text-xs text-muted-foreground">No previous passwords recorded.</p>
                    ) : (
                      history.data?.data.map((h) => (
                        <div key={h.id} className="flex items-center gap-2">
                          <code className="flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-xs">{h.password}</code>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(h.changedAt), { addSuffix: true })}
                          </span>
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyField(h.password, "Password")}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {isEdit && canDelete ? (
            <Button type="button" variant="ghost" className="text-red-600 hover:text-red-700" onClick={doDelete} disabled={remove.isPending}>
              <Trash2 className="mr-1.5 h-4 w-4" /> Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {readOnly ? "Close" : "Cancel"}
            </Button>
            {!readOnly && (
              <Button type="button" onClick={save} disabled={saving || loadingDetail}>
                {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                {isEdit ? "Save" : "Add item"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
