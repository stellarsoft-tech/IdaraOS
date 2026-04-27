"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  Calendar,
  Check,
  Clock,
  ExternalLink,
  FileCheck,
  FileText,
  Image as ImageIcon,
  Link2,
  Pencil,
  Plus,
  Shield,
  Trash2,
  User,
  X,
} from "lucide-react"
import { z } from "zod"
import { format } from "date-fns"

import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { FormDrawer } from "@/components/primitives/form-drawer"
import { Protected } from "@/components/primitives/protected"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  useSecurityEvidenceItem,
  useUpdateSecurityEvidence,
  useDeleteSecurityEvidence,
  useSecurityControls,
  useLinkEvidenceControl,
  useUnlinkEvidenceControl,
} from "@/lib/api/security"
import {
  evidenceTypeValues,
  evidenceStatusValues,
} from "@/lib/db/schema/security"
import { toast } from "sonner"

const typeIcons: Record<string, typeof FileText> = {
  document: FileText,
  screenshot: ImageIcon,
  log: FileCheck,
  report: FileText,
  attestation: FileCheck,
  configuration: FileCheck,
  other: FileText,
}

const typeLabels: Record<(typeof evidenceTypeValues)[number], string> = {
  document: "Document",
  screenshot: "Screenshot",
  log: "Log",
  report: "Report",
  attestation: "Attestation",
  configuration: "Configuration",
  other: "Other",
}

const statusVariants: Record<
  (typeof evidenceStatusValues)[number],
  { label: string; variant: "success" | "warning" | "danger" | "info" }
> = {
  current: { label: "Current", variant: "success" },
  pending_review: { label: "Pending Review", variant: "warning" },
  expired: { label: "Expired", variant: "danger" },
}

const editFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional(),
  type: z.enum(evidenceTypeValues),
  status: z.enum(evidenceStatusValues),
  collectedAt: z.string().min(1, "Collection date is required"),
  validUntil: z.string().optional(),
  externalUrl: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.string().url("Must be a valid URL").optional(),
  ),
  externalSystem: z.string().optional(),
})

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10" />
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-80" />
        <Skeleton className="h-80 lg:col-span-2" />
      </div>
    </div>
  )
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—"
  const units = ["B", "KB", "MB", "GB"]
  let size = bytes
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

export default function EvidenceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [controlSearch, setControlSearch] = useState("")

  const { data, isLoading, error } = useSecurityEvidenceItem(id)
  const { data: controlsData } = useSecurityControls({ limit: 100 })
  const updateEvidence = useUpdateSecurityEvidence()
  const deleteEvidence = useDeleteSecurityEvidence()
  const linkControl = useLinkEvidenceControl()
  const unlinkControl = useUnlinkEvidenceControl()

  const evidence = data?.data
  const controls = controlsData?.data || []
  const linkedControls = evidence?.linkedControls ?? []
  const linkedControlIds = useMemo(
    () => new Set(linkedControls.map((lc) => lc.controlId)),
    [linkedControls],
  )

  if (isLoading) {
    return <LoadingSkeleton />
  }

  if (error || !evidence) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <FileCheck className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Evidence Not Found</h2>
        <p className="text-muted-foreground mb-4">
          The evidence you&apos;re looking for doesn&apos;t exist or has been deleted.
        </p>
        <Button asChild>
          <Link href="/security/evidence">Back to Evidence Store</Link>
        </Button>
      </div>
    )
  }

  const TypeIcon = typeIcons[evidence.type] || FileText
  const statusInfo = statusVariants[evidence.status] || statusVariants.current
  const isExpired =
    evidence.validUntil && new Date(evidence.validUntil) < new Date()

  const handleUpdate = async (values: z.infer<typeof editFormSchema>) => {
    try {
      await updateEvidence.mutateAsync({ id, data: values })
      toast.success("Evidence updated successfully")
      setEditOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update evidence")
    }
  }

  const handleDeleteConfirm = async () => {
    try {
      await deleteEvidence.mutateAsync(id)
      toast.success("Evidence deleted successfully")
      setDeleteOpen(false)
      router.push("/security/evidence")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete evidence")
    }
  }

  const handleLinkControl = async (controlId: string) => {
    try {
      await linkControl.mutateAsync({ evidenceId: id, controlId })
      toast.success("Control linked")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to link control")
    }
  }

  const handleUnlinkControl = async (linkId: string) => {
    try {
      await unlinkControl.mutateAsync({ evidenceId: id, linkId })
      toast.success("Control unlinked")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to unlink control")
    }
  }

  const search = controlSearch.trim().toLowerCase()
  const linkableControls = controls.filter((c) => {
    if (linkedControlIds.has(c.id)) return false
    if (!search) return true
    return (
      c.controlId.toLowerCase().includes(search) ||
      c.title.toLowerCase().includes(search)
    )
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/security/evidence">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader title={evidence.title} description={typeLabels[evidence.type]} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <TypeIcon className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">{evidence.title}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {typeLabels[evidence.type]}
              </p>
              <div className="flex gap-2 mt-3">
                <StatusBadge variant={statusInfo.variant}>{statusInfo.label}</StatusBadge>
                {isExpired && evidence.status !== "expired" && (
                  <StatusBadge variant="warning">Past Valid Until</StatusBadge>
                )}
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  Collected: {format(new Date(evidence.collectedAt), "PPP")}
                </span>
              </div>
              {evidence.validUntil && (
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className={isExpired ? "text-red-600" : ""}>
                    Valid until: {format(new Date(evidence.validUntil), "PPP")}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>By: {evidence.collectedByName || "—"}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span>
                  Linked controls: {linkedControls.length}
                </span>
              </div>
              {evidence.externalSystem && (
                <div className="flex items-center gap-3 text-sm">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  <span>System: {evidence.externalSystem}</span>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-2">
              <Protected module="security.evidence" anyAction={["edit", "write"]}>
                <Button
                  className="flex-1 bg-transparent"
                  variant="outline"
                  onClick={() => setEditOpen(true)}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </Protected>
              <Protected module="security.evidence" action="delete">
                <Button
                  variant="outline"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  onClick={() => setDeleteOpen(true)}
                  aria-label="Delete evidence"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Protected>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Tabs defaultValue="details">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="controls">
                Linked Controls
                {linkedControls.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {linkedControls.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">
                    {evidence.description || "No description provided."}
                  </p>
                </CardContent>
              </Card>

              {(evidence.fileUrl ||
                evidence.fileName ||
                evidence.externalUrl) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Source</CardTitle>
                    <CardDescription>
                      Where this evidence is stored or referenced
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {evidence.fileUrl && (
                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">
                              {evidence.fileName || "Attached file"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatBytes(evidence.fileSize)}
                              {evidence.mimeType ? ` • ${evidence.mimeType}` : ""}
                            </p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" asChild>
                          <a
                            href={evidence.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open
                            <ExternalLink className="ml-2 h-3 w-3" />
                          </a>
                        </Button>
                      </div>
                    )}
                    {evidence.externalUrl && (
                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3 min-w-0">
                          <Link2 className="h-5 w-5 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">
                              {evidence.externalSystem || "External link"}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {evidence.externalUrl}
                            </p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" asChild>
                          <a
                            href={evidence.externalUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open
                            <ExternalLink className="ml-2 h-3 w-3" />
                          </a>
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {evidence.tags && evidence.tags.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Tags</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {evidence.tags.map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="controls" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Linked Controls</CardTitle>
                  <CardDescription>
                    Controls that this evidence supports.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {linkedControls.length > 0 ? (
                    linkedControls.map((lc) => (
                      <div
                        key={lc.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <Link
                          href={`/security/controls/${lc.controlId}`}
                          className="flex-1 min-w-0 hover:underline"
                        >
                          <p className="font-medium truncate">{lc.controlIdCode}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {lc.controlTitle}
                          </p>
                        </Link>
                        <Protected
                          module="security.evidence"
                          anyAction={["edit", "write"]}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-red-600"
                            onClick={() => handleUnlinkControl(lc.id)}
                            disabled={unlinkControl.isPending}
                            aria-label="Unlink control"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </Protected>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      This evidence isn&apos;t linked to any control yet.
                    </p>
                  )}
                  <Protected module="security.evidence" anyAction={["edit", "write"]}>
                    <Button
                      variant="outline"
                      className="w-full bg-transparent"
                      onClick={() => {
                        setControlSearch("")
                        setLinkOpen(true)
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Link Controls
                    </Button>
                  </Protected>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Evidence History</CardTitle>
                  <CardDescription>Timeline of changes to this evidence</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="h-2 w-2 rounded-full bg-blue-500 mt-2" />
                      <div>
                        <p className="text-sm">Last updated</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(evidence.updatedAt), "PPP")}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="h-2 w-2 rounded-full bg-green-500 mt-2" />
                      <div>
                        <p className="text-sm">Created</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(evidence.createdAt), "PPP")}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <FormDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit Evidence"
        description="Update evidence details"
        schema={editFormSchema}
        fields={[
          { name: "title", label: "Title", component: "input", type: "text", required: true },
          { name: "description", label: "Description", component: "textarea" },
          {
            name: "type",
            label: "Type",
            component: "select",
            options: evidenceTypeValues.map((v) => ({
              value: v,
              label: typeLabels[v],
            })),
            required: true,
          },
          {
            name: "status",
            label: "Status",
            component: "select",
            options: evidenceStatusValues.map((v) => ({
              value: v,
              label: statusVariants[v].label,
            })),
            required: true,
          },
          {
            name: "collectedAt",
            label: "Collection Date",
            component: "date",
            required: true,
          },
          { name: "validUntil", label: "Valid Until", component: "date" },
          {
            name: "externalUrl",
            label: "External URL",
            component: "input",
            type: "url",
            placeholder: "https://...",
          },
          {
            name: "externalSystem",
            label: "External System",
            component: "input",
            type: "text",
            placeholder: "e.g., Jira, Confluence",
          },
        ]}
        defaultValues={{
          title: evidence.title,
          description: evidence.description || "",
          type: evidence.type,
          status: evidence.status,
          collectedAt: evidence.collectedAt
            ? evidence.collectedAt.split("T")[0]
            : "",
          validUntil: evidence.validUntil
            ? evidence.validUntil.split("T")[0]
            : "",
          externalUrl: evidence.externalUrl || "",
          externalSystem: evidence.externalSystem || "",
        }}
        mode="edit"
        onSubmit={handleUpdate}
        submitLabel="Save Changes"
        isSubmitting={updateEvidence.isPending}
      />

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Link Controls</DialogTitle>
            <DialogDescription>
              Pick a control that this evidence supports. Linked controls show
              this evidence on their detail page.
            </DialogDescription>
          </DialogHeader>

          <Input
            placeholder="Search by control ID or title..."
            value={controlSearch}
            onChange={(e) => setControlSearch(e.target.value)}
          />

          <div className="max-h-80 overflow-y-auto space-y-2 -mx-6 px-6">
            {linkableControls.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                {controls.length === 0
                  ? "No controls have been created yet. Add controls in Security → Controls first."
                  : controls.length === linkedControlIds.size
                    ? "All available controls are already linked to this evidence."
                    : "No controls match your search."}
              </p>
            ) : (
              linkableControls.map((control) => (
                <div
                  key={control.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{control.controlId}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {control.title}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleLinkControl(control.id)}
                    disabled={linkControl.isPending}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Link
                  </Button>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Evidence</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{evidence.title}</strong>?
              This will also remove all links to controls. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteEvidence.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteEvidence.isPending ? "Deleting..." : "Delete Evidence"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
