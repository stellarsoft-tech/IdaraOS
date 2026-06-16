"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Plus, AlertTriangle } from "lucide-react"
import { z } from "zod"
import { toast } from "sonner"

import { DataTableAdvanced as DataTable } from "@/components/primitives/data-table-advanced"
import { PageShell } from "@/components/primitives/page-shell"
import { FormDrawer } from "@/components/primitives/form-drawer"
import { Protected } from "@/components/primitives/protected"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useUser } from "@/lib/rbac/context"
import {
  useAssignableObjectiveOwners,
  useCreateSecurityIncident,
  useSecurityEvidence,
  useSecurityIncidents,
  type SecurityIncident,
} from "@/lib/api/security"
import {
  buildEvidenceFieldConfig,
  buildOwnerFieldConfig,
  objectiveLinkedEvidenceSchema,
  objectiveOwnerIdSchema,
} from "@/components/security/objective-form-shared"
import {
  incidentClassificationValues,
  incidentSeverityValues,
  incidentStatusValues,
} from "@/lib/db/schema/security"

const severityLabels: Record<string, string> = {
  p1: "P1 — Critical",
  p2: "P2 — High",
  p3: "P3 — Medium",
  p4: "P4 — Low",
}

const statusLabels: Record<string, string> = {
  draft: "Draft",
  reported: "Reported",
  triaging: "Triaging",
  responding: "Responding",
  resolved: "Resolved",
  closed: "Closed",
}

const createSchema = z.object({
  incidentId: z.string().min(1).max(50),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  classification: z.enum(incidentClassificationValues),
  severity: z.enum(incidentSeverityValues),
  status: z.enum(incidentStatusValues),
  ownerId: objectiveOwnerIdSchema,
  linkedEvidenceIds: objectiveLinkedEvidenceSchema,
  impactDescription: z.string().optional(),
  notes: z.string().optional(),
})

const baseFormConfig = {
  incidentId: { component: "input" as const, label: "Incident ID", required: true, type: "text", placeholder: "INC-001" },
  title: { component: "input" as const, label: "Title", required: true, type: "text" },
  description: { component: "textarea" as const, label: "Description" },
  classification: {
    component: "select" as const,
    label: "Classification",
    options: incidentClassificationValues.map((v) => ({ value: v, label: v === "event" ? "Event" : "Incident" })),
    required: true,
  },
  severity: {
    component: "select" as const,
    label: "Severity",
    options: incidentSeverityValues.map((v) => ({ value: v, label: severityLabels[v] })),
    required: true,
  },
  status: {
    component: "select" as const,
    label: "Status",
    options: incidentStatusValues.map((v) => ({ value: v, label: statusLabels[v] })),
    required: true,
  },
  impactDescription: { component: "textarea" as const, label: "Impact Description" },
  notes: { component: "textarea" as const, label: "Notes" },
}

const columns = [
  {
    accessorKey: "incidentId",
    header: "ID",
    cell: ({ row }: { row: { original: SecurityIncident } }) => (
      <Link href={`/security/incidents/${row.original.id}`} className="font-medium text-primary hover:underline">
        {row.original.incidentId}
      </Link>
    ),
  },
  { accessorKey: "title", header: "Title" },
  {
    accessorKey: "severity",
    header: "Severity",
    cell: ({ row }: { row: { original: SecurityIncident } }) => (
      <Badge variant={row.original.severity === "p1" ? "destructive" : "secondary"}>
        {severityLabels[row.original.severity]}
      </Badge>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }: { row: { original: SecurityIncident } }) => statusLabels[row.original.status],
  },
  {
    accessorKey: "publicationStatus",
    header: "Published",
    cell: ({ row }: { row: { original: SecurityIncident } }) =>
      row.original.publicationStatus === "published" ? "Yes" : "No",
  },
  {
    accessorKey: "ownerName",
    header: "Owner",
    cell: ({ row }: { row: { original: SecurityIncident } }) => row.original.ownerName || "Unassigned",
  },
  {
    accessorKey: "linkedEvidenceIds",
    header: "Evidence",
    cell: ({ row }: { row: { original: SecurityIncident } }) => row.original.linkedEvidenceIds?.length ?? 0,
  },
]

export default function IncidentsPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const { hasPermission } = useUser()
  const canEdit = hasPermission("security.incidents", "edit") || hasPermission("security.incidents", "create")

  const { data, isLoading } = useSecurityIncidents({ limit: 500 })
  const createIncident = useCreateSecurityIncident()
  const { data: ownersData } = useAssignableObjectiveOwners()
  const { data: evidenceData } = useSecurityEvidence({ limit: 200 })
  const assignableOwners = ownersData?.data ?? []
  const evidenceList = evidenceData?.data ?? []
  const incidents = data?.data ?? []

  const formConfig = useMemo(
    () => ({
      ...baseFormConfig,
      ownerId: buildOwnerFieldConfig(assignableOwners),
      linkedEvidenceIds: buildEvidenceFieldConfig(evidenceList),
    }),
    [assignableOwners, evidenceList]
  )

  const handleCreate = async (values: z.infer<typeof createSchema>) => {
    try {
      await createIncident.mutateAsync(values)
      toast.success("Incident created")
      setCreateOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create incident")
    }
  }

  return (
    <PageShell
      title="Incident Management"
      description="Record, respond to, and learn from information security incidents (ISO 27001 A.5.24–A.5.28)."
      action={
        <Protected module="security.incidents" anyAction={["create", "edit"]}>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Incident
          </Button>
        </Protected>
      }
    >
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <div className="p-4 rounded-lg border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4" /> Total Incidents
          </div>
          <p className="text-2xl font-bold mt-1">{incidents.length}</p>
        </div>
        <div className="p-4 rounded-lg border">
          <p className="text-sm text-muted-foreground">Open / Active</p>
          <p className="text-2xl font-bold mt-1">
            {incidents.filter((i) => !["resolved", "closed"].includes(i.status)).length}
          </p>
        </div>
        <div className="p-4 rounded-lg border">
          <p className="text-sm text-muted-foreground">Published</p>
          <p className="text-2xl font-bold mt-1">
            {incidents.filter((i) => i.publicationStatus === "published").length}
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={incidents}
        loading={isLoading}
        searchKey="title"
        searchPlaceholder="Search incidents..."
        enableSorting
        enableExport
      />

      <FormDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create Incident"
        description="Log a new information security event or incident"
        schema={createSchema}
        config={formConfig}
        defaultValues={{
          classification: "incident",
          severity: "p3",
          status: "draft",
          ownerId: "__unassigned__",
          linkedEvidenceIds: [],
        }}
        fields={[
          "incidentId",
          "title",
          "description",
          "classification",
          "severity",
          "status",
          "ownerId",
          "impactDescription",
          "linkedEvidenceIds",
          "notes",
        ]}
        mode="create"
        onSubmit={handleCreate}
      />
    </PageShell>
  )
}
