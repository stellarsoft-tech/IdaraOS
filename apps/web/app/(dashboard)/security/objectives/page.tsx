"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Plus, Target, CheckCircle, Clock, TrendingUp, FileCheck } from "lucide-react"
import { z } from "zod"
import { format } from "date-fns"

import { DataTableAdvanced as DataTable } from "@/components/primitives/data-table-advanced"
import { PageShell } from "@/components/primitives/page-shell"
import { FormDrawer } from "@/components/primitives/form-drawer"
import { Protected } from "@/components/primitives/protected"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ObjectiveEditDrawer,
  ObjectiveEvidenceDialog,
  useObjectiveTableColumns,
} from "@/components/security/objective-list-actions"
import { useUser } from "@/lib/rbac/context"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  useAssignableObjectiveOwners,
  useSecurityObjectives,
  useSecurityEvidence,
  useCreateSecurityObjective,
  type SecurityObjective,
} from "@/lib/api/security"
import {
  buildEvidenceFieldConfig,
  buildOwnerFieldConfig,
  objectiveLinkedEvidenceSchema,
  objectiveOwnerIdSchema,
  objectiveYearSchema,
} from "@/components/security/objective-form-shared"
import {
  getCurrentObjectiveYear,
  getAvailableObjectiveYears,
  getObjectiveYearOptions,
  periodFromYear,
} from "@/lib/security/objectives"
import { toast } from "sonner"

// Priority badge variants
const priorityVariants: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  low: { label: "Low", variant: "outline" },
  medium: { label: "Medium", variant: "secondary" },
  high: { label: "High", variant: "default" },
  critical: { label: "Critical", variant: "destructive" },
}

// Status badge variants
const statusVariants: Record<string, { label: string; className: string }> = {
  not_started: { label: "Not Started", className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400" },
  in_progress: { label: "In Progress", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  completed: { label: "Completed", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  on_hold: { label: "On Hold", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
}

const achievementVariants: Record<string, { label: string; className: string }> = {
  not_measured: { label: "Not Measured", className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400" },
  not_achieved: { label: "Not Achieved", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  partially_achieved: { label: "Partially Achieved", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  achieved: { label: "Achieved", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
}

const baseColumns = [
  {
    accessorKey: "objectiveId",
    header: "ID",
    cell: ({ row }: { row: { original: SecurityObjective } }) => (
      <Link
        href={`/security/objectives/${row.original.id}`}
        className="font-medium text-primary hover:underline"
      >
        {row.original.objectiveId}
      </Link>
    ),
  },
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }: { row: { original: SecurityObjective } }) => (
      <div>
        <Link
          href={`/security/objectives/${row.original.id}`}
          className="font-medium hover:underline"
        >
          {row.original.title}
        </Link>
        {row.original.description && (
          <p className="text-xs text-muted-foreground truncate max-w-[300px]">
            {row.original.description}
          </p>
        )}
      </div>
    ),
  },
  {
    accessorKey: "priority",
    header: "Priority",
    cell: ({ row }: { row: { original: SecurityObjective } }) => {
      const variant = priorityVariants[row.original.priority]
      return (
        <Badge variant={variant?.variant || "default"}>
          {variant?.label || row.original.priority}
        </Badge>
      )
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }: { row: { original: SecurityObjective } }) => {
      const variant = statusVariants[row.original.status]
      return (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${variant?.className || ""}`}>
          {variant?.label || row.original.status}
        </span>
      )
    },
  },
  {
    accessorKey: "periodLabel",
    header: "Period",
    cell: ({ row }: { row: { original: SecurityObjective } }) => (
      <span className="text-sm">{row.original.periodLabel || "—"}</span>
    ),
  },
  {
    accessorKey: "achievementStatus",
    header: "Achievement",
    cell: ({ row }: { row: { original: SecurityObjective } }) => {
      const variant = achievementVariants[row.original.achievementStatus]
      return (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${variant?.className || ""}`}>
          {variant?.label || row.original.achievementStatus}
        </span>
      )
    },
  },
  {
    accessorKey: "linkedEvidenceIds",
    header: "Evidence",
    cell: ({ row }: { row: { original: SecurityObjective } }) => (
      <div className="flex items-center gap-1 text-sm">
        <FileCheck className="h-3.5 w-3.5 text-muted-foreground" />
        <span>{row.original.linkedEvidenceIds?.length ?? 0}</span>
      </div>
    ),
  },
  {
    accessorKey: "targetDate",
    header: "Target Date",
    cell: ({ row }: { row: { original: SecurityObjective } }) => (
      row.original.targetDate ? (
        <div className="flex items-center gap-1 text-sm">
          <Clock className="h-3 w-3 text-muted-foreground" />
          {format(new Date(row.original.targetDate), "MMM d, yyyy")}
        </div>
      ) : (
        <span className="text-muted-foreground">-</span>
      )
    ),
  },
  {
    accessorKey: "ownerName",
    header: "Owner",
    cell: ({ row }: { row: { original: SecurityObjective } }) => (
      <span className="text-sm">{row.original.ownerName || "Unassigned"}</span>
    ),
  },
]

// Form schema
const createFormSchema = z.object({
  objectiveId: z.string().min(1, "Objective ID is required").max(50),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional(),
  year: objectiveYearSchema,
  ownerId: objectiveOwnerIdSchema,
  linkedEvidenceIds: objectiveLinkedEvidenceSchema,
  category: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  status: z.enum(["not_started", "in_progress", "completed", "on_hold", "cancelled"]).default("not_started"),
  achievementStatus: z.enum(["not_measured", "not_achieved", "partially_achieved", "achieved"]).default("not_measured"),
  targetDate: z.string().optional(),
  successCriteria: z.string().optional(),
})

// Form config
const formConfig = {
  objectiveId: {
    component: "input" as const,
    label: "Objective ID",
    placeholder: "e.g., OBJ-001",
    required: true,
    type: "text",
  },
  title: {
    component: "input" as const,
    label: "Title",
    placeholder: "Enter objective title",
    required: true,
    type: "text",
  },
  description: {
    component: "textarea" as const,
    label: "Description",
    placeholder: "Describe the objective",
  },
  year: {
    component: "select" as const,
    label: "Objective Year",
    placeholder: "Select year",
    options: getObjectiveYearOptions().map((y) => ({
      value: String(y),
      label: String(y),
    })),
    required: true,
  },
  category: {
    component: "select" as const,
    label: "Category",
    placeholder: "Select category",
    options: [
      { value: "security", label: "Security" },
      { value: "compliance", label: "Compliance" },
      { value: "operational", label: "Operational" },
      { value: "strategic", label: "Strategic" },
    ],
  },
  priority: {
    component: "select" as const,
    label: "Priority",
    placeholder: "Select priority",
    options: [
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" },
      { value: "critical", label: "Critical" },
    ],
    required: true,
  },
  status: {
    component: "select" as const,
    label: "Workflow Status",
    placeholder: "Select status",
    options: [
      { value: "not_started", label: "Not Started" },
      { value: "in_progress", label: "In Progress" },
      { value: "completed", label: "Completed" },
      { value: "on_hold", label: "On Hold" },
      { value: "cancelled", label: "Cancelled" },
    ],
    required: true,
  },
  achievementStatus: {
    component: "select" as const,
    label: "Achievement Status",
    options: [
      { value: "not_measured", label: "Not Measured" },
      { value: "not_achieved", label: "Not Achieved" },
      { value: "partially_achieved", label: "Partially Achieved" },
      { value: "achieved", label: "Achieved" },
    ],
    required: true,
  },
  successCriteria: {
    component: "textarea" as const,
    label: "Success Criteria",
    placeholder: "Measurable criteria for achievement",
  },
  targetDate: {
    component: "input" as const,
    label: "Target Date",
    type: "date",
  },
}

export default function ObjectivesPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const [yearFilter, setYearFilter] = useState<number>(getCurrentObjectiveYear())
  const [editingObjective, setEditingObjective] = useState<SecurityObjective | null>(null)
  const [evidenceObjective, setEvidenceObjective] = useState<SecurityObjective | null>(null)

  const { hasPermission } = useUser()
  const canEdit = hasPermission("security.objectives", "edit") || hasPermission("security.objectives", "create")
  
  const { data: objectivesData, isLoading } = useSecurityObjectives({
    periodLabel: periodFromYear(yearFilter).periodLabel,
    limit: 200,
  })
  const createObjective = useCreateSecurityObjective()
  const { data: assignableOwnersData } = useAssignableObjectiveOwners()
  const assignableOwners = assignableOwnersData?.data ?? []
  const { data: evidenceData } = useSecurityEvidence({ limit: 200 })
  const evidenceList = evidenceData?.data ?? []

  const createFormConfigWithPeople = useMemo(
    () => ({
      ...formConfig,
      ownerId: buildOwnerFieldConfig(assignableOwners),
      linkedEvidenceIds: buildEvidenceFieldConfig(evidenceList),
    }),
    [assignableOwners, evidenceList]
  )
  
  const objectives = objectivesData?.data || []

  const yearOptions = useMemo(
    () => getAvailableObjectiveYears(objectives),
    [objectives]
  )
  
  // Calculate stats
  const completedCount = objectives.filter(o => o.status === "completed").length
  const inProgressCount = objectives.filter(o => o.status === "in_progress").length
  const notStartedCount = objectives.filter(o => o.status === "not_started").length
  const achievedCount = objectives.filter((o) => o.achievementStatus === "achieved").length

  const tableColumns = useObjectiveTableColumns({
    baseColumns,
    canEdit,
    onEdit: setEditingObjective,
    onLinkEvidence: setEvidenceObjective,
  })
  
  const handleCreate = async (values: z.infer<typeof createFormSchema>) => {
    const { year, ownerId, linkedEvidenceIds, ...rest } = values
    const period = periodFromYear(year)
    try {
      await createObjective.mutateAsync({ ...rest, ...period, ownerId, linkedEvidenceIds })
      toast.success("Objective created successfully")
      setCreateOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create objective")
    }
  }
  
  return (
    <PageShell
      title="Security Objectives"
      description="Track and manage your organization's security objectives and KPIs."
      action={
        <Protected module="security.objectives" anyAction={["create", "edit"]}>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Objective
          </Button>
        </Protected>
      }
    >
      <div className="flex items-center gap-3 mb-6">
        <span className="text-sm text-muted-foreground">Year:</span>
        <Select
          value={String(yearFilter)}
          onValueChange={(value) => setYearFilter(Number(value))}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Select year" />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-900/10">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-800 dark:text-green-400">Completed</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-green-900 dark:text-green-300">{completedCount}</p>
        </div>
        <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-900/10">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800 dark:text-blue-400">In Progress</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-blue-900 dark:text-blue-300">{inProgressCount}</p>
        </div>
        <div className="p-4 rounded-lg border">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Not Started</span>
          </div>
          <p className="text-2xl font-bold mt-1">{notStartedCount}</p>
        </div>
        <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-900/10">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-800 dark:text-green-400">Achieved</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-green-900 dark:text-green-300">{achievedCount}</p>
        </div>
      </div>
      
      {!isLoading && objectives.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 rounded-lg border border-dashed mb-6">
          <Target className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-1">No objectives for {yearFilter} yet.</p>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first security objective for this year.
          </p>
          <Protected module="security.objectives" anyAction={["create", "edit"]}>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Objective
            </Button>
          </Protected>
        </div>
      )}

      <DataTable
        columns={tableColumns}
        data={objectives}
        loading={isLoading}
        searchKey="title"
        searchPlaceholder="Search objectives..."
        facetedFilters={{
          status: {
            type: "enum",
            options: [
              { label: "Not Started", value: "not_started" },
              { label: "In Progress", value: "in_progress" },
              { label: "Completed", value: "completed" },
              { label: "Cancelled", value: "cancelled" },
            ],
          },
          priority: {
            type: "enum",
            options: [
              { label: "Low", value: "low" },
              { label: "Medium", value: "medium" },
              { label: "High", value: "high" },
              { label: "Critical", value: "critical" },
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
        title="Create Objective"
        description="Add a new security objective"
        schema={createFormSchema}
        config={createFormConfigWithPeople}
        defaultValues={{
          year: String(yearFilter),
          ownerId: "__unassigned__",
          linkedEvidenceIds: [],
          achievementStatus: "not_measured",
        }}
        fields={[
          "objectiveId",
          "title",
          "description",
          "year",
          "ownerId",
          "category",
          "priority",
          "status",
          "achievementStatus",
          "successCriteria",
          "targetDate",
          "linkedEvidenceIds",
        ]}
        mode="create"
        onSubmit={handleCreate}
      />

      <ObjectiveEditDrawer
        objective={editingObjective}
        open={!!editingObjective}
        onOpenChange={(open) => !open && setEditingObjective(null)}
      />
      <ObjectiveEvidenceDialog
        objective={evidenceObjective}
        open={!!evidenceObjective}
        onOpenChange={(open) => !open && setEvidenceObjective(null)}
      />
    </PageShell>
  )
}

