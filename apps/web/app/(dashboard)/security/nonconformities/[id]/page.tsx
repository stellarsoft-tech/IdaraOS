"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, ExternalLink, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"

import { PageHeader } from "@/components/page-header"
import { Protected } from "@/components/primitives/protected"
import { FormDrawer } from "@/components/primitives/form-drawer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  useDeleteSecurityNonconformity,
  useSecurityEvidence,
  useSecurityNonconformity,
  useUpdateSecurityNonconformity,
} from "@/lib/api/security"
import { useDocuments } from "@/lib/api/docs"
import {
  buildEvidenceFieldConfig,
  buildOwnerFieldConfig,
  objectiveLinkedEvidenceSchema,
  objectiveOwnerIdSchema,
} from "@/components/security/objective-form-shared"
import {
  documentCategoryLabels,
  type DocumentCategory,
} from "@/lib/docs/types"
import { documentCategoryValues } from "@/lib/db/schema/docs"
import { ncSeverityValues, ncSourceValues, ncStatusValues } from "@/lib/db/schema/security"
import type { FieldConfig } from "@/components/primitives/form-drawer"

const editSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  status: z.enum(ncStatusValues),
  severity: z.enum(ncSeverityValues),
  source: z.enum(ncSourceValues),
  documentCategory: z
    .union([z.enum(documentCategoryValues), z.literal("__none__")])
    .optional()
    .nullable()
    .transform((val) => (val === "__none__" || !val ? null : val)),
  linkedDocumentId: z
    .union([z.string().uuid(), z.literal("__none__")])
    .optional()
    .nullable()
    .transform((val) => (!val || val === "__none__" ? null : val)),
  ownerId: objectiveOwnerIdSchema,
  linkedEvidenceIds: objectiveLinkedEvidenceSchema,
  rootCauseAnalysis: z.string().optional(),
  correctiveAction: z.string().optional(),
  correctiveActionDueDate: z.string().optional(),
  effectivenessReview: z.string().optional(),
  notes: z.string().optional(),
})

function buildDocumentFieldConfig(
  documents: Array<{ id: string; title: string; category: string }>,
  category?: string | null
): FieldConfig {
  const filtered = category ? documents.filter((d) => d.category === category) : documents
  return {
    component: "select",
    label: "Linked Document",
    options: [
      { value: "__none__", label: "— None —" },
      ...filtered.map((d) => ({ value: d.id, label: d.title })),
    ],
  }
}

export default function NonconformityDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const { data, isLoading } = useSecurityNonconformity(id)
  const updateNc = useUpdateSecurityNonconformity()
  const deleteNc = useDeleteSecurityNonconformity()
  const { data: ownersData } = useAssignableObjectiveOwners()
  const { data: evidenceData } = useSecurityEvidence({ limit: 200 })
  const { data: docsData } = useDocuments({ limit: 500 })
  const record = data?.data

  const formConfig = useMemo(() => {
    const category = selectedCategory ?? record?.documentCategory ?? null
    return {
      title: { component: "input" as const, label: "Title", required: true, type: "text" },
      description: { component: "textarea" as const, label: "Description" },
      status: {
        component: "select" as const,
        label: "Status",
        options: ncStatusValues.map((v) => ({ value: v, label: v.replace("_", " ") })),
      },
      severity: {
        component: "select" as const,
        label: "Severity",
        options: ncSeverityValues.map((v) => ({ value: v, label: v })),
      },
      source: {
        component: "select" as const,
        label: "Source",
        options: ncSourceValues.map((v) => ({ value: v, label: v.replace("_", " ") })),
      },
      documentCategory: {
        component: "select" as const,
        label: "Document Type",
        options: [
          { value: "__none__", label: "— None —" },
          ...documentCategoryValues.map((v) => ({
            value: v,
            label: documentCategoryLabels[v as DocumentCategory],
          })),
        ],
      },
      linkedDocumentId: buildDocumentFieldConfig(docsData?.data ?? [], category),
      ownerId: buildOwnerFieldConfig(
        ownersData?.data ?? [],
        record?.ownerId
          ? { id: record.ownerId, name: record.ownerName ?? "Unknown", email: record.ownerEmail }
          : null
      ),
      linkedEvidenceIds: buildEvidenceFieldConfig(evidenceData?.data ?? []),
      rootCauseAnalysis: { component: "textarea" as const, label: "Root Cause Analysis" },
      correctiveAction: { component: "textarea" as const, label: "Corrective Action" },
      correctiveActionDueDate: { component: "input" as const, label: "Corrective Action Due Date", type: "date" },
      effectivenessReview: { component: "textarea" as const, label: "Effectiveness Review" },
      notes: { component: "textarea" as const, label: "Notes" },
    }
  }, [ownersData, evidenceData, docsData, record, selectedCategory])

  const handleEdit = async (values: z.infer<typeof editSchema>) => {
    try {
      await updateNc.mutateAsync({ id, data: values })
      toast.success("Nonconformity updated")
      setEditOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update")
    }
  }

  const handleDelete = async () => {
    try {
      await deleteNc.mutateAsync(id)
      toast.success("Record deleted")
      router.push("/security/nonconformities")
    } catch {
      toast.error("Failed to delete")
    }
  }

  if (isLoading) return <Skeleton className="h-96 w-full" />
  if (!record) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Record not found</p>
        <Button asChild className="mt-4"><Link href="/security/nonconformities">Back</Link></Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title={record.title} description={record.ncId}>
        <Button variant="ghost" size="icon" asChild>
          <Link href="/security/nonconformities"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <Protected module="security.nonconformities" action="edit">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </Button>
        </Protected>
        <Protected module="security.nonconformities" action="delete">
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
        </Protected>
      </PageHeader>

      <div className="flex flex-wrap gap-2">
        <Badge variant={record.severity === "critical" ? "destructive" : "secondary"}>{record.severity}</Badge>
        <Badge variant="outline">{record.status.replace("_", " ")}</Badge>
        <Badge variant="outline">{record.source.replace("_", " ")}</Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Nonconformity Details</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Owner:</span> {record.ownerName || "Unassigned"}</p>
            {record.description && <p>{record.description}</p>}
            {record.documentCategory && (
              <p>
                <span className="text-muted-foreground">Document type:</span>{" "}
                {documentCategoryLabels[record.documentCategory as DocumentCategory]}
              </p>
            )}
            {record.linkedDocumentTitle && record.linkedDocumentSlug && (
              <Button variant="link" className="h-auto p-0" asChild>
                <Link href={`/docs/documents/${record.linkedDocumentSlug}`}>
                  {record.linkedDocumentTitle}
                  <ExternalLink className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Corrective Action (Clause 10.2)</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {record.rootCauseAnalysis && (
              <div><p className="font-medium">Root Cause</p><p className="text-muted-foreground">{record.rootCauseAnalysis}</p></div>
            )}
            {record.correctiveAction && (
              <div><p className="font-medium">Corrective Action</p><p className="text-muted-foreground">{record.correctiveAction}</p></div>
            )}
            {record.effectivenessReview && (
              <div><p className="font-medium">Effectiveness Review</p><p className="text-muted-foreground">{record.effectivenessReview}</p></div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Linked Evidence</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm">{record.linkedEvidenceIds?.length ?? 0} evidence item(s)</p>
          </CardContent>
        </Card>
      </div>

      <FormDrawer
        key={record.id}
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit Nonconformity"
        description={record.ncId}
        schema={editSchema}
        config={formConfig}
        defaultValues={{
          title: record.title,
          description: record.description ?? "",
          status: record.status,
          severity: record.severity,
          source: record.source,
          documentCategory: record.documentCategory ?? "__none__",
          linkedDocumentId: record.linkedDocumentId ?? "__none__",
          ownerId: record.ownerId ?? "__unassigned__",
          linkedEvidenceIds: record.linkedEvidenceIds ?? [],
          rootCauseAnalysis: record.rootCauseAnalysis ?? "",
          correctiveAction: record.correctiveAction ?? "",
          correctiveActionDueDate: record.correctiveActionDueDate ?? "",
          effectivenessReview: record.effectivenessReview ?? "",
          notes: record.notes ?? "",
        }}
        fields={[
          "title", "description", "status", "severity", "source",
          "documentCategory", "linkedDocumentId", "ownerId",
          "rootCauseAnalysis", "correctiveAction", "correctiveActionDueDate",
          "effectivenessReview", "linkedEvidenceIds", "notes",
        ]}
        mode="edit"
        onSubmit={handleEdit}
        onFieldChange={(fieldName, value, setValue) => {
          if (fieldName === "documentCategory") {
            const cat = value === "__none__" ? null : String(value)
            setSelectedCategory(cat)
            setValue("linkedDocumentId", "__none__")
          }
        }}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete record?</AlertDialogTitle>
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
