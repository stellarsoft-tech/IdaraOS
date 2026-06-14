"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Plus, Target, CheckCircle, XCircle, AlertCircle, FileCheck } from "lucide-react"
import { z } from "zod"
import { format } from "date-fns"

import { DataTableAdvanced as DataTable } from "@/components/primitives/data-table-advanced"
import { PageShell } from "@/components/primitives/page-shell"
import { FormDrawer } from "@/components/primitives/form-drawer"
import { Protected } from "@/components/primitives/protected"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { toast } from "sonner"
import {
  ObjectiveEditDrawer,
  ObjectiveEvidenceDialog,
  useObjectiveTableColumns,
} from "@/components/security/objective-list-actions"
import { useUser } from "@/lib/rbac/context"
import {
  getCurrentObjectiveYear,
  getAvailableObjectiveYears,
  getObjectiveYearOptions,
  periodFromYear,
} from "@/lib/security/objectives"

const achievementVariants: Record<
  SecurityObjective["achievementStatus"],
  { label: string; className: string }
> = {
  not_measured: { label: "Not Measured", className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400" },
  not_achieved: { label: "Not Achieved", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  partially_achieved: { label: "Partially Achieved", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  achieved: { label: "Achieved", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
}

const createFormSchema = z.object({
  objectiveId: z.string().min(1, "Objective ID is required").max(50),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional(),
  year: objectiveYearSchema,
  ownerId: objectiveOwnerIdSchema,
  linkedEvidenceIds: objectiveLinkedEvidenceSchema,
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  status: z.enum(["not_started", "in_progress", "completed", "on_hold", "cancelled"]).default("not_started"),
  achievementStatus: z.enum(["not_measured", "not_achieved", "partially_achieved", "achieved"]).default("not_measured"),
  targetDate: z.string().optional(),
  successCriteria: z.string().optional(),
})

const formConfig = {
  objectiveId: {
    component: "input" as const,
    label: "Objective ID",
    placeholder: "e.g., ISO-OBJ-001",
    required: true,
    type: "text",
  },
  title: {
    component: "input" as const,
    label: "Title",
    placeholder: "Measurable security objective",
    required: true,
    type: "text",
  },
  description: {
    component: "textarea" as const,
    label: "Description",
    placeholder: "What will be achieved and how it will be measured",
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
    placeholder: "Measurable criteria for achievement (ISO 27001 Clause 6.2)",
  },
  priority: {
    component: "select" as const,
    label: "Priority",
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
    options: [
      { value: "not_started", label: "Not Started" },
      { value: "in_progress", label: "In Progress" },
      { value: "completed", label: "Completed" },
      { value: "on_hold", label: "On Hold" },
      { value: "cancelled", label: "Cancelled" },
    ],
    required: true,
  },
  targetDate: {
    component: "input" as const,
    label: "Target Date",
    type: "date",
  },
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
    header: "Objective",
    cell: ({ row }: { row: { original: SecurityObjective } }) => (
      <div>
        <Link
          href={`/security/objectives/${row.original.id}`}
          className="font-medium hover:underline"
        >
          {row.original.title}
        </Link>
        {row.original.successCriteria && (
          <p className="text-xs text-muted-foreground truncate max-w-[320px]">
            {row.original.successCriteria}
          </p>
        )}
      </div>
    ),
  },
  {
    accessorKey: "periodLabel",
    header: "Period",
    cell: ({ row }: { row: { original: SecurityObjective } }) => (
      <div className="text-sm">
        <p className="font-medium">{row.original.periodLabel || "—"}</p>
        {row.original.periodStart && row.original.periodEnd && (
          <p className="text-xs text-muted-foreground">
            {format(new Date(row.original.periodStart), "MMM d, yyyy")} –{" "}
            {format(new Date(row.original.periodEnd), "MMM d, yyyy")}
          </p>
        )}
      </div>
    ),
  },
  {
    accessorKey: "achievementStatus",
    header: "Achievement",
    cell: ({ row }: { row: { original: SecurityObjective } }) => {
      const variant = achievementVariants[row.original.achievementStatus]
      return (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${variant.className}`}>
          {variant.label}
        </span>
      )
    },
  },
  {
    accessorKey: "linkedEvidenceIds",
    header: "Evidence",
    cell: ({ row }: { row: { original: SecurityObjective } }) => {
      const count = row.original.linkedEvidenceIds?.length ?? 0
      return (
        <div className="flex items-center gap-1 text-sm">
          <FileCheck className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{count}</span>
        </div>
      )
    },
  },
  {
    accessorKey: "ownerName",
    header: "Owner",
    cell: ({ row }: { row: { original: SecurityObjective } }) => (
      <span className="text-sm">{row.original.ownerName || "Unassigned"}</span>
    ),
  },
]

export default function ISO27001ObjectivesPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const [yearFilter, setYearFilter] = useState<number>(getCurrentObjectiveYear())
  const [editingObjective, setEditingObjective] = useState<SecurityObjective | null>(null)
  const [evidenceObjective, setEvidenceObjective] = useState<SecurityObjective | null>(null)

  const { hasPermission } = useUser()
  const canEdit = hasPermission("security.objectives", "edit") || hasPermission("security.objectives", "create")

  const { data: objectivesData, isLoading } = useSecurityObjectives({
    frameworkCode: "iso-27001",
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

  const achievedCount = objectives.filter((o) => o.achievementStatus === "achieved").length
  const partialCount = objectives.filter((o) => o.achievementStatus === "partially_achieved").length
  const notAchievedCount = objectives.filter((o) => o.achievementStatus === "not_achieved").length
  const withEvidenceCount = objectives.filter((o) => (o.linkedEvidenceIds?.length ?? 0) > 0).length

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
      await createObjective.mutateAsync({
        ...rest,
        ...period,
        ownerId,
        linkedEvidenceIds,
        category: "security",
        frameworkCode: "iso-27001",
      })
      toast.success("ISO 27001 objective created")
      setCreateOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create objective")
    }
  }

  return (
    <PageShell
      title="ISO 27001 Security Objectives"
      description="Clause 6.2 — measurable information security objectives with reporting periods, achievement status, and linked evidence."
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
        <Badge variant="outline">ISO 27001:2022 Clause 6.2</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-900/10">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-800 dark:text-green-400">Achieved</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-green-900 dark:text-green-300">{achievedCount}</p>
        </div>
        <div className="p-4 rounded-lg border bg-yellow-50 dark:bg-yellow-900/10">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-800 dark:text-yellow-400">Partially Achieved</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-yellow-900 dark:text-yellow-300">{partialCount}</p>
        </div>
        <div className="p-4 rounded-lg border bg-red-50 dark:bg-red-900/10">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-600" />
            <span className="text-sm font-medium text-red-800 dark:text-red-400">Not Achieved</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-red-900 dark:text-red-300">{notAchievedCount}</p>
        </div>
        <div className="p-4 rounded-lg border">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">With Evidence</span>
          </div>
          <p className="text-2xl font-bold mt-1">{withEvidenceCount}</p>
        </div>
      </div>

      {!isLoading && objectives.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 rounded-lg border border-dashed mb-6">
          <Target className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-1">No ISO 27001 objectives for {yearFilter} yet.</p>
          <p className="text-sm text-muted-foreground mb-4">
            Define measurable objectives for Clause 6.2.
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
          achievementStatus: {
            type: "enum",
            options: [
              { label: "Not Measured", value: "not_measured" },
              { label: "Not Achieved", value: "not_achieved" },
              { label: "Partially Achieved", value: "partially_achieved" },
              { label: "Achieved", value: "achieved" },
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
        title="Create ISO 27001 Objective"
        description="Define a measurable security objective for the reporting period (Clause 6.2)"
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
          "achievementStatus",
          "successCriteria",
          "priority",
          "status",
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
