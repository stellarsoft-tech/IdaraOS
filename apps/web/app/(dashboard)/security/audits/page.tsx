"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, ClipboardList, AlertTriangle, Calendar, User } from "lucide-react"
import { z } from "zod"
import { format } from "date-fns"

import { DataTableAdvanced as DataTable } from "@/components/primitives/data-table-advanced"
import { PageShell } from "@/components/primitives/page-shell"
import { FormDrawer } from "@/components/primitives/form-drawer"
import { Protected } from "@/components/primitives/protected"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useSecurityAudits, useCreateSecurityAudit, useSecurityFrameworks, type SecurityAudit } from "@/lib/api/security"
import { toast } from "sonner"

// Type badge variants
const typeVariants: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  internal: { label: "Internal", variant: "secondary" },
  external: { label: "External", variant: "default" },
  surveillance: { label: "Surveillance", variant: "outline" },
  certification: { label: "Certification", variant: "default" },
  recertification: { label: "Recertification", variant: "default" },
}

// Status badge variants
const statusVariants: Record<string, { label: string; className: string }> = {
  planned: { label: "Planned", className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400" },
  in_progress: { label: "In Progress", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  completed: { label: "Completed", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
}

// Table columns
const columns = [
  {
    accessorKey: "auditId",
    header: "Audit ID",
    cell: ({ row }: { row: { original: SecurityAudit } }) => (
      <span className="font-medium">{row.original.auditId}</span>
    ),
  },
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }: { row: { original: SecurityAudit } }) => (
      <div>
        <p className="font-medium">{row.original.title}</p>
        {row.original.frameworkName && (
          <p className="text-xs text-muted-foreground">{row.original.frameworkName}</p>
        )}
      </div>
    ),
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }: { row: { original: SecurityAudit } }) => {
      const variant = typeVariants[row.original.type]
      return (
        <Badge variant={variant?.variant || "default"}>
          {variant?.label || row.original.type}
        </Badge>
      )
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }: { row: { original: SecurityAudit } }) => {
      const variant = statusVariants[row.original.status]
      return (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${variant?.className || ""}`}>
          {variant?.label || row.original.status}
        </span>
      )
    },
  },
  {
    accessorKey: "startDate",
    header: "Start Date",
    cell: ({ row }: { row: { original: SecurityAudit } }) => (
      row.original.startDate ? (
        <div className="flex items-center gap-1 text-sm">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          {format(new Date(row.original.startDate), "MMM d, yyyy")}
        </div>
      ) : (
        <span className="text-muted-foreground">-</span>
      )
    ),
  },
  {
    accessorKey: "leadAuditor",
    header: "Lead Auditor",
    cell: ({ row }: { row: { original: SecurityAudit } }) => (
      row.original.leadAuditor ? (
        <div className="flex items-center gap-1 text-sm">
          <User className="h-3 w-3 text-muted-foreground" />
          {row.original.leadAuditor}
        </div>
      ) : (
        <span className="text-muted-foreground">-</span>
      )
    ),
  },
  {
    accessorKey: "findingsCount",
    header: "Findings",
    cell: ({ row }: { row: { original: SecurityAudit } }) => (
      <div className="flex items-center gap-2">
        {row.original.majorFindingsCount > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
            {row.original.majorFindingsCount} major
          </span>
        )}
        {row.original.minorFindingsCount > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
            {row.original.minorFindingsCount} minor
          </span>
        )}
        {row.original.findingsCount === 0 && (
          <span className="text-muted-foreground">-</span>
        )}
      </div>
    ),
  },
]

// Form schema
const createFormSchema = z.object({
  auditId: z.string().min(1, "Audit ID is required").max(50),
  title: z.string().min(1, "Title is required").max(200),
  type: z.enum(["internal", "external", "surveillance", "certification", "recertification"]).default("internal"),
  status: z.enum(["planned", "in_progress", "completed", "cancelled"]).default("planned"),
  frameworkId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  scope: z.string().optional(),
  objectives: z.string().optional(),
  leadAuditor: z.string().optional(),
  auditBody: z.string().optional(),
})

export default function AuditsPage() {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  
  const { data: auditsData, isLoading } = useSecurityAudits()
  const { data: frameworksData } = useSecurityFrameworks()
  const createAudit = useCreateSecurityAudit()
  
  const audits = auditsData?.data || []
  const frameworks = frameworksData?.data || []
  
  // Calculate stats
  const plannedCount = audits.filter(a => a.status === "planned").length
  const inProgressCount = audits.filter(a => a.status === "in_progress").length
  const completedCount = audits.filter(a => a.status === "completed").length
  const totalFindings = audits.reduce((sum, a) => sum + (a.findingsCount || 0), 0)
  
  // Form config
  const formConfig = {
    auditId: {
      component: "input" as const,
      label: "Audit ID",
      placeholder: "e.g., AUD-2024-001",
      required: true,
      type: "text",
    },
    title: {
      component: "input" as const,
      label: "Title",
      placeholder: "Enter audit title",
      required: true,
      type: "text",
    },
    type: {
      component: "select" as const,
      label: "Type",
      placeholder: "Select type",
      options: [
        { value: "internal", label: "Internal Audit" },
        { value: "external", label: "External Audit" },
        { value: "surveillance", label: "Surveillance Audit" },
        { value: "certification", label: "Certification Audit" },
        { value: "recertification", label: "Recertification Audit" },
      ],
      required: true,
    },
    status: {
      component: "select" as const,
      label: "Status",
      placeholder: "Select status",
      options: [
        { value: "planned", label: "Planned" },
        { value: "in_progress", label: "In Progress" },
        { value: "completed", label: "Completed" },
        { value: "cancelled", label: "Cancelled" },
      ],
      required: true,
    },
    frameworkId: {
      component: "select" as const,
      label: "Framework",
      placeholder: "Select framework (optional)",
      options: frameworks.map(f => ({ value: f.id, label: f.name })),
    },
    startDate: {
      component: "input" as const,
      label: "Start Date",
      type: "date",
    },
    endDate: {
      component: "input" as const,
      label: "End Date",
      type: "date",
    },
    scope: {
      component: "textarea" as const,
      label: "Scope",
      placeholder: "Define the audit scope",
    },
    objectives: {
      component: "textarea" as const,
      label: "Objectives",
      placeholder: "Define the audit objectives",
    },
    leadAuditor: {
      component: "input" as const,
      label: "Lead Auditor",
      placeholder: "Enter lead auditor name",
      type: "text",
    },
    auditBody: {
      component: "input" as const,
      label: "Audit Body/Firm",
      placeholder: "Enter audit body (for external audits)",
      type: "text",
    },
  }
  
  const handleCreate = async (values: z.infer<typeof createFormSchema>) => {
    try {
      await createAudit.mutateAsync({
        ...values,
        frameworkId: values.frameworkId || undefined,
      })
      toast.success("Audit created successfully")
      setCreateOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create audit")
    }
  }
  
  return (
    <PageShell
      title="Audits"
      description="Track internal and external security audits."
      action={
        <Protected module="security.audits" action="write">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Audit
          </Button>
        </Protected>
      }
    >
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <div className="p-4 rounded-lg border">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Planned</span>
          </div>
          <p className="text-2xl font-bold mt-1">{plannedCount}</p>
        </div>
        <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-900/10">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800 dark:text-blue-400">In Progress</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-blue-900 dark:text-blue-300">{inProgressCount}</p>
        </div>
        <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-900/10">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-800 dark:text-green-400">Completed</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-green-900 dark:text-green-300">{completedCount}</p>
        </div>
        <div className="p-4 rounded-lg border bg-yellow-50 dark:bg-yellow-900/10">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-800 dark:text-yellow-400">Total Findings</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-yellow-900 dark:text-yellow-300">{totalFindings}</p>
        </div>
      </div>
      
      <DataTable
        columns={columns}
        data={audits}
        loading={isLoading}
        searchKey="title"
        searchPlaceholder="Search audits..."
        onRowClick={(audit) => router.push(`/security/audits/${audit.id}`)}
        facetedFilters={{
          type: {
            type: "enum",
            options: [
              { label: "Internal", value: "internal" },
              { label: "External", value: "external" },
              { label: "Surveillance", value: "surveillance" },
              { label: "Certification", value: "certification" },
              { label: "Recertification", value: "recertification" },
            ],
          },
          status: {
            type: "enum",
            options: [
              { label: "Planned", value: "planned" },
              { label: "In Progress", value: "in_progress" },
              { label: "Completed", value: "completed" },
              { label: "Cancelled", value: "cancelled" },
            ],
          },
        }}
        enableColumnFilters
        enableSorting
        enableExport
        enableColumnVisibility
      />
      
      <FormDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create Audit"
        description="Schedule a new security audit"
        schema={createFormSchema}
        config={formConfig}
        fields={["auditId", "title", "type", "status", "frameworkId", "startDate", "endDate", "scope", "objectives", "leadAuditor", "auditBody"]}
        mode="create"
        onSubmit={handleCreate}
      />
    </PageShell>
  )
}
