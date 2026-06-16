"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, History, Pencil, Send, Trash2 } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"

import { PageHeader } from "@/components/page-header"
import { Protected } from "@/components/primitives/protected"
import { FormDrawer } from "@/components/primitives/form-drawer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
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
  useAssignableObjectiveOwners,
  useDeleteSecurityIncident,
  useSecurityEvidence,
  useSecurityIncident,
  useUpdateSecurityIncident,
} from "@/lib/api/security"
import {
  buildEvidenceFieldConfig,
  buildOwnerFieldConfig,
  objectiveLinkedEvidenceSchema,
  objectiveOwnerIdSchema,
} from "@/components/security/objective-form-shared"
import { z } from "zod"
import {
  incidentClassificationValues,
  incidentSeverityValues,
  incidentStatusValues,
} from "@/lib/db/schema/security"

const editSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  classification: z.enum(incidentClassificationValues),
  severity: z.enum(incidentSeverityValues),
  status: z.enum(incidentStatusValues),
  ownerId: objectiveOwnerIdSchema,
  linkedEvidenceIds: objectiveLinkedEvidenceSchema,
  impactDescription: z.string().optional(),
  containmentActions: z.string().optional(),
  eradicationActions: z.string().optional(),
  recoveryActions: z.string().optional(),
  rootCauseAnalysis: z.string().optional(),
  lessonsLearned: z.string().optional(),
  notes: z.string().optional(),
  changeDescription: z.string().optional(),
})

export default function IncidentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data, isLoading } = useSecurityIncident(id)
  const updateIncident = useUpdateSecurityIncident()
  const deleteIncident = useDeleteSecurityIncident()
  const { data: ownersData } = useAssignableObjectiveOwners()
  const { data: evidenceData } = useSecurityEvidence({ limit: 200 })
  const incident = data?.data

  const formConfig = useMemo(
    () => ({
      title: { component: "input" as const, label: "Title", required: true, type: "text" },
      description: { component: "textarea" as const, label: "Description" },
      classification: {
        component: "select" as const,
        label: "Classification",
        options: incidentClassificationValues.map((v) => ({ value: v, label: v })),
      },
      severity: {
        component: "select" as const,
        label: "Severity",
        options: incidentSeverityValues.map((v) => ({ value: v, label: v.toUpperCase() })),
      },
      status: {
        component: "select" as const,
        label: "Status",
        options: incidentStatusValues.map((v) => ({ value: v, label: v.replace("_", " ") })),
      },
      ownerId: buildOwnerFieldConfig(
        ownersData?.data ?? [],
        incident?.ownerId
          ? { id: incident.ownerId, name: incident.ownerName ?? "Unknown", email: incident.ownerEmail }
          : null
      ),
      linkedEvidenceIds: buildEvidenceFieldConfig(evidenceData?.data ?? []),
      impactDescription: { component: "textarea" as const, label: "Impact" },
      containmentActions: { component: "textarea" as const, label: "Containment Actions" },
      eradicationActions: { component: "textarea" as const, label: "Eradication Actions" },
      recoveryActions: { component: "textarea" as const, label: "Recovery Actions" },
      rootCauseAnalysis: { component: "textarea" as const, label: "Root Cause Analysis" },
      lessonsLearned: { component: "textarea" as const, label: "Lessons Learned (A.5.27)" },
      notes: { component: "textarea" as const, label: "Notes" },
      changeDescription: {
        component: "input" as const,
        label: "Change Summary",
        helpText: incident?.publicationStatus === "published"
          ? "Required context when editing a published incident — a version snapshot will be saved"
          : undefined,
        type: "text",
      },
    }),
    [ownersData, evidenceData, incident]
  )

  const handlePublish = async () => {
    if (!incident) return
    try {
      await updateIncident.mutateAsync({
        id,
        data: { publicationStatus: "published", changeDescription: "Published incident record" },
      })
      toast.success("Incident published")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to publish")
    }
  }

  const handleEdit = async (values: z.infer<typeof editSchema>) => {
    try {
      await updateIncident.mutateAsync({ id, data: values })
      toast.success("Incident updated")
      setEditOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update")
    }
  }

  const handleDelete = async () => {
    try {
      await deleteIncident.mutateAsync(id)
      toast.success("Incident deleted")
      router.push("/security/incidents")
    } catch {
      toast.error("Failed to delete incident")
    }
  }

  if (isLoading) return <Skeleton className="h-96 w-full" />
  if (!incident) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Incident not found</p>
        <Button asChild className="mt-4"><Link href="/security/incidents">Back</Link></Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title={incident.title} description={incident.incidentId}>
        <Button variant="ghost" size="icon" asChild>
          <Link href="/security/incidents"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <Protected module="security.incidents" action="edit">
          {incident.publicationStatus !== "published" && (
            <Button variant="outline" onClick={handlePublish}>
              <Send className="mr-2 h-4 w-4" /> Publish
            </Button>
          )}
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </Button>
        </Protected>
        <Protected module="security.incidents" action="delete">
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
        </Protected>
      </PageHeader>

      <div className="flex flex-wrap gap-2">
        <Badge>{incident.severity.toUpperCase()}</Badge>
        <Badge variant="outline">{incident.status.replace("_", " ")}</Badge>
        <Badge variant={incident.publicationStatus === "published" ? "default" : "secondary"}>
          {incident.publicationStatus === "published" ? `Published v${incident.currentVersion}` : "Draft"}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p><span className="text-muted-foreground">Owner:</span> {incident.ownerName || "Unassigned"}</p>
            <p><span className="text-muted-foreground">Classification:</span> {incident.classification}</p>
            {incident.description && <p>{incident.description}</p>}
            {incident.impactDescription && (
              <div><p className="font-medium">Impact</p><p className="text-muted-foreground">{incident.impactDescription}</p></div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Response (A.5.26)</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {incident.containmentActions && <p><strong>Containment:</strong> {incident.containmentActions}</p>}
            {incident.eradicationActions && <p><strong>Eradication:</strong> {incident.eradicationActions}</p>}
            {incident.recoveryActions && <p><strong>Recovery:</strong> {incident.recoveryActions}</p>}
            {!incident.containmentActions && !incident.eradicationActions && !incident.recoveryActions && (
              <p className="text-muted-foreground">No response actions recorded yet.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Root Cause & Lessons (A.5.27)</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {incident.rootCauseAnalysis && <p>{incident.rootCauseAnalysis}</p>}
            {incident.lessonsLearned && <p>{incident.lessonsLearned}</p>}
            {!incident.rootCauseAnalysis && !incident.lessonsLearned && (
              <p className="text-muted-foreground">Post-incident review not completed.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Linked Evidence</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm">{incident.linkedEvidenceIds?.length ?? 0} evidence item(s) linked</p>
          </CardContent>
        </Card>
      </div>

      {(incident.versions?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><History className="h-4 w-4" /> Version History</CardTitle>
            <CardDescription>Snapshots created when editing published incidents</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {incident.versions?.map((v) => (
              <div key={v.id} className="flex justify-between border rounded-lg p-3 text-sm">
                <div>
                  <p className="font-medium">v{v.version}</p>
                  <p className="text-muted-foreground">{v.changeDescription || "No description"}</p>
                </div>
                <span className="text-muted-foreground">{format(new Date(v.createdAt), "PPp")}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <FormDrawer
        key={incident.id}
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit Incident"
        description={incident.incidentId}
        schema={editSchema}
        config={formConfig}
        defaultValues={{
          title: incident.title,
          description: incident.description ?? "",
          classification: incident.classification,
          severity: incident.severity,
          status: incident.status,
          ownerId: incident.ownerId ?? "__unassigned__",
          linkedEvidenceIds: incident.linkedEvidenceIds ?? [],
          impactDescription: incident.impactDescription ?? "",
          containmentActions: incident.containmentActions ?? "",
          eradicationActions: incident.eradicationActions ?? "",
          recoveryActions: incident.recoveryActions ?? "",
          rootCauseAnalysis: incident.rootCauseAnalysis ?? "",
          lessonsLearned: incident.lessonsLearned ?? "",
          notes: incident.notes ?? "",
          changeDescription: "",
        }}
        fields={[
          "title", "description", "classification", "severity", "status", "ownerId",
          "impactDescription", "containmentActions", "eradicationActions", "recoveryActions",
          "rootCauseAnalysis", "lessonsLearned", "linkedEvidenceIds", "notes", "changeDescription",
        ]}
        mode="edit"
        onSubmit={handleEdit}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete incident?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
