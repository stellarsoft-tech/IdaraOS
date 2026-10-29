"use client"

import { useState } from "react"
import Link from "next/link"
import { AlertTriangle, CheckCircle2, PackageCheck, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { PageShell } from "@/components/primitives/page-shell"
import { Protected } from "@/components/primitives/protected"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { CatalogAppDialog } from "@/components/security/software/catalog-app-dialog"
import { useDeleteCatalogApp, useSoftwareCatalog, type CatalogApp } from "@/lib/api/security-software"
import { usePermission } from "@/lib/rbac/context"
import { softwareAccessLabels, softwareUpdateMethodLabels } from "@/lib/security/software"

function IntuneSetup({ app }: { app: CatalogApp }) {
  if (app.access === "managed") {
    return <span className="text-xs text-muted-foreground">Deployed to all devices</span>
  }
  if (app.access === "self_service") {
    return app.intuneAppId ? (
      <span className="text-xs">{app.intuneAppName}</span>
    ) : (
      <span className="text-xs text-amber-600">Link the Intune app for the Company Portal link</span>
    )
  }
  return app.installGroupId ? (
    <div className="flex items-start gap-1.5 text-xs">
      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
      <div>
        <div>{app.intuneAppName}</div>
        <div className="text-muted-foreground">Group: {app.installGroupName ?? app.installGroupId}</div>
      </div>
    </div>
  ) : (
    <div className="flex items-center gap-1.5 text-xs text-amber-600">
      <AlertTriangle className="h-3.5 w-3.5" />
      Not set up - users can&apos;t request it yet
    </div>
  )
}

export default function ApprovedSoftwarePage() {
  const { data, isLoading } = useSoftwareCatalog()
  const remove = useDeleteCatalogApp()
  const canEdit = usePermission("security.software", "edit")
  const canDelete = usePermission("security.software", "delete")

  const [editing, setEditing] = useState<CatalogApp | "new" | null>(null)
  const [deleting, setDeleting] = useState<CatalogApp | null>(null)

  const apps = data?.data ?? []

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await remove.mutateAsync(deleting.id)
      toast.success(`${deleting.name} removed`)
      setDeleting(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete the app")
    }
  }

  return (
    <PageShell
      title="Approved Software"
      description="Apps users can get without admin rights. Intune installs them; the IdaraOS Updater keeps them current."
      icon={PackageCheck}
      action={
        <div className="flex gap-2">
          <Protected module="security.software-updates" action="view">
            <Button variant="outline" asChild>
              <Link href="/security/software-updates">
                <RefreshCw className="mr-2 h-4 w-4" />
                Software updates
              </Link>
            </Button>
          </Protected>
          <Protected module="security.software" action="create">
            <Button onClick={() => setEditing("new")}>
              <Plus className="mr-2 h-4 w-4" />
              Add app
            </Button>
          </Protected>
        </div>
      }
    >
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>App</TableHead>
                <TableHead>Access</TableHead>
                <TableHead>Updates</TableHead>
                <TableHead>Intune</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {apps.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    No approved apps yet.
                  </TableCell>
                </TableRow>
              )}
              {apps.map((app) => (
                <TableRow key={app.id} className={app.enabled ? undefined : "opacity-60"}>
                  <TableCell>
                    <div className="font-medium">{app.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {[app.publisher, app.description].filter(Boolean).join(" · ")}
                    </div>
                    {!app.enabled && <Badge variant="outline" className="mt-1">Disabled</Badge>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={app.access === "approval" ? "default" : "secondary"}>
                      {softwareAccessLabels[app.access]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs">{softwareUpdateMethodLabels[app.updateMethod]}</div>
                    {app.wingetId && <code className="text-xs text-muted-foreground">{app.wingetId}</code>}
                    {app.updateMethod === "winget" && !app.autoUpdate && (
                      <div className="text-xs text-amber-600">Automatic updates off</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <IntuneSetup app={app} />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {canEdit && (
                        <Button variant="ghost" size="icon" onClick={() => setEditing(app)} aria-label={`Edit ${app.name}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button variant="ghost" size="icon" onClick={() => setDeleting(app)} aria-label={`Delete ${app.name}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CatalogAppDialog app={editing} onOpenChange={(open) => !open && setEditing(null)} />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Users can no longer request it and the updater stops updating it. Nothing is uninstalled, and past
              requests keep their history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  )
}
