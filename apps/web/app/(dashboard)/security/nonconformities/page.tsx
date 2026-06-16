"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Plus } from "lucide-react"
import { z } from "zod"
import { toast } from "sonner"

import { DataTableAdvanced as DataTable } from "@/components/primitives/data-table-advanced"
import { PageShell } from "@/components/primitives/page-shell"
import { FormDrawer } from "@/components/primitives/form-drawer"
import { Protected } from "@/components/primitives/protected"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  useAssignableObjectiveOwners,
  useCreateSecurityNonconformity,
  useSecurityEvidence,
  useSecurityNonconformities,
  type SecurityNonconformity,
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
import {
  documentCategoryValues,
} from "@/lib/db/schema/docs"
import {
  ncSeverityValues,
  ncSourceValues,
  ncStatusValues,
} from "@/lib/db/schema/security"
import type { FieldConfig } from "@/components/primitives/form-drawer"

const statusLabels: Record<string, string> = {
  open: "Open",
  analysis: "Root Cause Analysis",
  corrective_action: "Corrective Action",
  verification: "Effectiveness Verification",
  closed: "Closed",
}

const sourceLabels: Record<string, string> = {
  internal_audit: "Internal Audit",
  external_audit: "External Audit",
  incident: "Incident",
  monitoring: "Monitoring",
  management_review: "Management Review",
  self_assessment: "Self Assessment",
  other: "Other",
}

const createSchema = z.object({
  ncId: z.string().min(1).max(50),
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
  notes: z.string().optional(),
})

function buildDocumentFieldConfig(
  documents: Array<{ id: string; title: string; category: string }>,
  category?: string | null
): FieldConfig {
  const filtered = category
    ? documents.filter((d) => d.category === category)
    : documents

  return {
    component: "select",
    label: "Linked Document",
    placeholder: category ? "Select document" : "Select document type first",
    helpText: "Document raised against this nonconformity (filtered by type)",
    options: [
      { value: "__none__", label: "— None —" },
      ...filtered.map((d) => ({ value: d.id, label: d.title })),
    ],
  }
}

const baseFormConfig = {
  ncId: { component: "input" as const, label: "NC ID", required: true, type: "text", placeholder: "NC-001" },
  title: { component: "input" as const, label: "Title", required: true, type: "text" },
  description: { component: "textarea" as const, label: "Description" },
  status: {
    component: "select" as const,
    label: "Status",
    options: ncStatusValues.map((v) => ({ value: v, label: statusLabels[v] })),
    required: true,
  },
  severity: {
    component: "select" as const,
    label: "Severity",
    options: ncSeverityValues.map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) })),
    required: true,
  },
  source: {
    component: "select" as const,
    label: "Source",
    options: ncSourceValues.map((v) => ({ value: v, label: sourceLabels[v] })),
    required: true,
  },
  documentCategory: {
    component: "select" as const,
    label: "Document Type",
    helpText: "Type of document this NC is raised against (ISO 27001 Clause 10.2)",
    options: [
      { value: "__none__", label: "— None —" },
      ...documentCategoryValues.map((v) => ({ value: v, label: documentCategoryLabels[v as DocumentCategory] })),
    ],
  },
  rootCauseAnalysis: { component: "textarea" as const, label: "Root Cause Analysis" },
  correctiveAction: { component: "textarea" as const, label: "Corrective Action" },
  notes: { component: "textarea" as const, label: "Notes" },
}

const columns = [
  {
    accessorKey: "ncId",
    header: "ID",
    cell: ({ row }: { row: { original: SecurityNonconformity } }) => (
      <Link href={`/security/nonconformities/${row.original.id}`} className="font-medium text-primary hover:underline">
        {row.original.ncId}
      </Link>
    ),
  },
  { accessorKey: "title", header: "Title" },
  {
    accessorKey: "severity",
    header: "Severity",
    cell: ({ row }: { row: { original: SecurityNonconformity } }) => (
      <Badge variant={row.original.severity === "critical" ? "destructive" : "secondary"}>
        {row.original.severity}
      </Badge>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }: { row: { original: SecurityNonconformity } }) => statusLabels[row.original.status],
  },
  {
    accessorKey: "documentCategory",
    header: "Doc Type",
    cell: ({ row }: { row: { original: SecurityNonconformity } }) =>
      row.original.documentCategory
        ? documentCategoryLabels[row.original.documentCategory as DocumentCategory]
        : "—",
  },
  {
    accessorKey: "linkedDocumentTitle",
    header: "Document",
    cell: ({ row }: { row: { original: SecurityNonconformity } }) => row.original.linkedDocumentTitle || "—",
  },
  {
    accessorKey: "ownerName",
    header: "Owner",
    cell: ({ row }: { row: { original: SecurityNonconformity } }) => row.original.ownerName || "Unassigned",
  },
]

export default function NonconformitiesPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const { data, isLoading } = useSecurityNonconformities({ limit: 500 })
  const createNc = useCreateSecurityNonconformity()
  const { data: ownersData } = useAssignableObjectiveOwners()
  const { data: evidenceData } = useSecurityEvidence({ limit: 200 })
  const { data: docsData } = useDocuments({ limit: 500 })
  const records = data?.data ?? []
  const allDocuments = docsData?.data ?? []

  const formConfig = useMemo(
    () => ({
      ...baseFormConfig,
      ownerId: buildOwnerFieldConfig(ownersData?.data ?? []),
      linkedEvidenceIds: buildEvidenceFieldConfig(evidenceData?.data ?? []),
      linkedDocumentId: buildDocumentFieldConfig(allDocuments, selectedCategory),
    }),
    [ownersData, evidenceData, allDocuments, selectedCategory]
  )

  const handleCreate = async (values: z.infer<typeof createSchema>) => {
    try {
      await createNc.mutateAsync(values)
      toast.success("Nonconformity recorded")
      setCreateOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create record")
    }
  }

  return (
    <PageShell
      title="Nonconformity & Corrective Action"
      description="Track nonconformities and corrective actions per ISO 27001 Clause 10.2."
      action={
        <Protected module="security.nonconformities" anyAction={["create", "edit"]}>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Record NC
          </Button>
        </Protected>
      }
    >
      <DataTable
        columns={columns}
        data={records}
        loading={isLoading}
        searchKey="title"
        searchPlaceholder="Search nonconformities..."
        enableSorting
        enableExport
      />

      <FormDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Record Nonconformity"
        description="ISO 27001 Clause 10.2 — react, analyse root cause, and plan corrective action"
        schema={createSchema}
        config={formConfig}
        defaultValues={{
          status: "open",
          severity: "minor",
          source: "other",
          documentCategory: "__none__",
          linkedDocumentId: "__none__",
          ownerId: "__unassigned__",
          linkedEvidenceIds: [],
        }}
        fields={[
          "ncId",
          "title",
          "description",
          "status",
          "severity",
          "source",
          "documentCategory",
          "linkedDocumentId",
          "ownerId",
          "rootCauseAnalysis",
          "correctiveAction",
          "linkedEvidenceIds",
          "notes",
        ]}
        mode="create"
        onSubmit={handleCreate}
        onFieldChange={(fieldName, value, setValue) => {
          if (fieldName === "documentCategory") {
            const cat = value === "__none__" ? null : String(value)
            setSelectedCategory(cat)
            setValue("linkedDocumentId", "__none__")
          }
        }}
      />
    </PageShell>
  )
}
