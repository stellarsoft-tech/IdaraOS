"use client"

import { useMemo, useState } from "react"
import {
  AlertTriangle,
  Copy,
  CreditCard,
  Folder,
  FolderPlus,
  KeyRound,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Share2,
  Star,
  StickyNote,
  Trash2,
  Upload,
  UserRound,
  Vault,
} from "lucide-react"
import { toast } from "sonner"

import { PageShell } from "@/components/primitives/page-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { usePermission } from "@/lib/rbac/context"
import {
  useCreateVaultFolder,
  useDeleteVaultFolder,
  useRenameVaultFolder,
  useUpdateVaultItem,
  useVault,
  type VaultItemSummary,
  type VaultSharedItem,
} from "@/lib/api/security-my-vault"
import { VaultItemDialog } from "./vault-item-dialog"
import { VaultImportDialog } from "./vault-import-dialog"

const TYPE_ICON = { login: KeyRound, note: StickyNote, card: CreditCard, identity: UserRound } as const

function hostOf(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).host
  } catch {
    return url
  }
}

export function VaultView() {
  const canCreate = usePermission("security.my-vault", "create")
  const canEdit = usePermission("security.my-vault", "edit")
  const canDelete = usePermission("security.my-vault", "delete")

  const { data, isLoading } = useVault()
  const items = useMemo(() => data?.items ?? [], [data])
  const folders = useMemo(() => data?.folders ?? [], [data])
  const shared = useMemo(() => data?.shared ?? [], [data])
  const encryptionConfigured = data?.encryptionKeyConfigured ?? true
  const health = data?.health

  const [search, setSearch] = useState("")
  const [folderFilter, setFolderFilter] = useState<string>("all")
  const [dialog, setDialog] = useState<{ open: boolean; itemId: string | null }>({ open: false, itemId: null })
  const [importOpen, setImportOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const update = useUpdateVaultItem()
  const createFolder = useCreateVaultFolder()
  const renameFolder = useRenameVaultFolder()
  const deleteFolder = useDeleteVaultFolder()

  const counts = useMemo(() => {
    const byFolder = new Map<string, number>()
    let favorites = 0
    for (const it of items) {
      if (it.favorite) favorites++
      if (it.folderId) byFolder.set(it.folderId, (byFolder.get(it.folderId) ?? 0) + 1)
    }
    return { byFolder, favorites }
  }, [items])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((it) => {
      if (folderFilter === "favorites" && !it.favorite) return false
      if (folderFilter !== "all" && folderFilter !== "favorites" && folderFilter !== "shared" && it.folderId !== folderFilter) return false
      if (!q) return true
      return [it.title, it.username, it.url].some((v) => v?.toLowerCase().includes(q))
    })
  }, [items, search, folderFilter])

  const sharedFiltered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return shared.filter((it) => !q || [it.title, it.username, it.url].some((v) => v?.toLowerCase().includes(q)))
  }, [shared, search])

  const isShared = folderFilter === "shared"
  const rows: (VaultItemSummary | VaultSharedItem)[] = isShared ? sharedFiltered : filtered

  const toggleFavorite = async (it: VaultItemSummary) => {
    try {
      await update.mutateAsync({ id: it.id, favorite: !it.favorite })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update the item")
    }
  }

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copied`)
    } catch {
      toast.error("Couldn't copy to the clipboard")
    }
  }

  // Reveal (audited) + copy the password, then clear the clipboard after 20s
  const copyPassword = async (it: VaultItemSummary) => {
    if (!it.hasPassword) {
      toast.error("No password saved on this item")
      return
    }
    setBusyId(it.id)
    try {
      const res = await fetch(`/api/security/my-vault/items/${it.id}`, { cache: "no-store" })
      const body = (await res.json()) as { data?: { password?: string | null }; error?: string }
      if (!res.ok) throw new Error(body?.error || "Failed to reveal")
      const pw = body.data?.password
      if (!pw) {
        toast.error("No password saved on this item")
        return
      }
      await navigator.clipboard.writeText(pw)
      toast.success("Password copied — clears in 20s")
      window.setTimeout(() => {
        navigator.clipboard.writeText("").catch(() => {})
      }, 20000)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't copy the password")
    } finally {
      setBusyId(null)
    }
  }

  const addFolder = async () => {
    const name = window.prompt("New folder name")?.trim()
    if (!name) return
    try {
      await createFolder.mutateAsync({ name })
      toast.success("Folder created")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create the folder")
    }
  }

  const doRenameFolder = async (id: string, current: string) => {
    const name = window.prompt("Rename folder", current)?.trim()
    if (!name || name === current) return
    try {
      await renameFolder.mutateAsync({ id, name })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't rename the folder")
    }
  }

  const doDeleteFolder = async (id: string, name: string) => {
    if (!window.confirm(`Delete the folder "${name}"? Its items are kept and moved to "No folder".`)) return
    try {
      await deleteFolder.mutateAsync(id)
      if (folderFilter === id) setFolderFilter("all")
      toast.success("Folder deleted")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete the folder")
    }
  }

  const railButton = (key: string, label: string, count: number, icon?: React.ReactNode) => (
    <button
      type="button"
      onClick={() => setFolderFilter(key)}
      className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
        folderFilter === key ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      }`}
    >
      <span className="flex min-w-0 items-center gap-2">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">{count}</span>
    </button>
  )

  return (
    <PageShell
      title="Vault"
      icon={Vault}
      description="Your personal password vault — store, generate and organise credentials. Secrets are encrypted at rest."
      action={
        canCreate ? (
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-1.5 h-4 w-4" /> Import
            </Button>
            <Button onClick={() => setDialog({ open: true, itemId: null })}>
              <Plus className="mr-1.5 h-4 w-4" /> Add item
            </Button>
          </>
        ) : undefined
      }
    >
      {!encryptionConfigured && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            ENCRYPTION_KEY isn&apos;t set on the server, so vault secrets are only weakly protected at rest. Set it to
            secure the vault.
          </span>
        </div>
      )}

      {health && health.total > 0 && health.weak + health.reused + health.old > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-3 text-sm">
          <span className="font-medium">Vault health:</span>
          {health.weak > 0 && <Badge variant="outline" className="border-red-400 text-red-600">{health.weak} weak</Badge>}
          {health.reused > 0 && <Badge variant="outline" className="border-red-400 text-red-600">{health.reused} reused</Badge>}
          {health.old > 0 && <Badge variant="outline" className="border-amber-400 text-amber-600">{health.old} old</Badge>}
          <span className="text-muted-foreground">of {health.total} with passwords — update these to stay compliant.</span>
        </div>
      )}

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Folder rail */}
        <nav className="space-y-0.5 lg:w-56 lg:shrink-0">
          {railButton("all", "All items", items.length, <KeyRound className="h-4 w-4" />)}
          {railButton("favorites", "Favorites", counts.favorites, <Star className="h-4 w-4" />)}
          {shared.length > 0 && railButton("shared", "Shared with me", shared.length, <Share2 className="h-4 w-4" />)}
          {folders.length > 0 && <div className="my-1 border-t" />}
          {folders.map((f) => (
            <div key={f.id} className="group flex items-center">
              <button
                type="button"
                onClick={() => setFolderFilter(f.id)}
                className={`flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  folderFilter === f.id
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Folder className="h-4 w-4 shrink-0" />
                  <span className="truncate">{f.name}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{counts.byFolder.get(f.id) ?? 0}</span>
              </button>
              {canEdit && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => doRenameFolder(f.id, f.name)}>
                      <Pencil className="mr-2 h-3.5 w-3.5" /> Rename
                    </DropdownMenuItem>
                    {canDelete && (
                      <DropdownMenuItem onClick={() => doDeleteFolder(f.id, f.name)} className="text-red-600">
                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
          {canCreate && (
            <button
              type="button"
              onClick={addFolder}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <FolderPlus className="h-4 w-4" /> New folder
            </button>
          )}
        </nav>

        {/* Item list */}
        <div className="min-w-0 flex-1 space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, username or URL…"
              className="pl-9"
            />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
              {isShared
                ? "Nothing has been shared with you yet."
                : items.length === 0
                  ? "Your vault is empty. Add your first item to get started."
                  : "No items match your search."}
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map((it) => {
                const Icon = TYPE_ICON[it.type] ?? KeyRound
                const host = hostOf(it.url)
                const ownerName = isShared ? (it as VaultSharedItem).ownerName : null
                return (
                  <div
                    key={it.id}
                    className="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40"
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      onClick={() => setDialog({ open: true, itemId: it.id })}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          <span className="truncate">{it.title}</span>
                          {!isShared && it.favorite && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />}
                          {isShared && (
                            <Badge variant="outline" className="shrink-0 text-[10px]">
                              {(it as VaultSharedItem).access}
                            </Badge>
                          )}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {isShared
                            ? `from ${ownerName ?? "someone"}${it.username ? ` · ${it.username}` : ""}`
                            : [it.username, host].filter(Boolean).join(" · ") || "—"}
                        </span>
                      </span>
                    </button>

                    <div className="flex shrink-0 items-center gap-1">
                      {!isShared && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Toggle favorite"
                          onClick={() => toggleFavorite(it)}
                        >
                          <Star className={`h-4 w-4 ${it.favorite ? "fill-amber-400 text-amber-400" : ""}`} />
                        </Button>
                      )}
                      {it.username && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="hidden sm:inline-flex"
                          onClick={() => copyText(it.username!, "Username")}
                        >
                          Copy user
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === it.id || !it.hasPassword}
                        onClick={() => copyPassword(it)}
                      >
                        {busyId === it.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <VaultItemDialog
        open={dialog.open}
        itemId={dialog.itemId}
        folders={folders}
        canEdit={canEdit}
        canDelete={canDelete}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
      />

      <VaultImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </PageShell>
  )
}
