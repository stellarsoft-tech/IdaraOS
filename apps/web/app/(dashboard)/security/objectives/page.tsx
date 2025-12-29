"use client"

import { useState } from "react"
import { Plus, Target, CheckCircle, Clock, TrendingUp } from "lucide-react"
import { z } from "zod"
import { format } from "date-fns"

import { DataTableAdvanced as DataTable } from "@/components/primitives/data-table-advanced"
import { PageShell } from "@/components/primitives/page-shell"
import { FormDrawer } from "@/components/primitives/form-drawer"
import { Protected } from "@/components/primitives/protected"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  useSecurityObjectives, 
  useCreateSecurityObjective,
  type SecurityObjective 
} from "@/lib/api/security"
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
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
}

// Table columns
const columns = [
  {
    accessorKey: "objectiveId",
    header: "ID",
    cell: ({ row }: { row: { original: SecurityObjective } }) => (
      <span className="font-medium">{row.original.objectiveId}</span>
    ),
  },
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }: { row: { original: SecurityObjective } }) => (
      <div>
        <p className="font-medium">{row.original.title}</p>
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
    accessorKey: "progress",
    header: "Progress",
    cell: ({ row }: { row: { original: SecurityObjective } }) => (
      <div className="flex items-center gap-2 min-w-[120px]">
        <Progress value={row.original.progress} className="h-2 flex-1" />
        <span className="text-xs text-muted-foreground w-8">{row.original.progress}%</span>
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
  category: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  status: z.enum(["not_started", "in_progress", "completed", "cancelled"]).default("not_started"),
  targetDate: z.string().optional(),
  progress: z.coerce.number().min(0).max(100).default(0),
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
    label: "Status",
    placeholder: "Select status",
    options: [
      { value: "not_started", label: "Not Started" },
      { value: "in_progress", label: "In Progress" },
      { value: "completed", label: "Completed" },
      { value: "cancelled", label: "Cancelled" },
    ],
    required: true,
  },
  targetDate: {
    component: "input" as const,
    label: "Target Date",
    type: "date",
  },
  progress: {
    component: "input" as const,
    label: "Progress (%)",
    placeholder: "0-100",
    type: "number",
  },
}

export default function ObjectivesPage() {
  const [createOpen, setCreateOpen] = useState(false)
  
  const { data: objectivesData, isLoading } = useSecurityObjectives()
  const createObjective = useCreateSecurityObjective()
  
  const objectives = objectivesData?.data || []
  
  // Calculate stats
  const completedCount = objectives.filter(o => o.status === "completed").length
  const inProgressCount = objectives.filter(o => o.status === "in_progress").length
  const notStartedCount = objectives.filter(o => o.status === "not_started").length
  const avgProgress = objectives.length > 0 
    ? Math.round(objectives.reduce((sum, o) => sum + o.progress, 0) / objectives.length)
    : 0
  
  const handleCreate = async (values: z.infer<typeof createFormSchema>) => {
    try {
      await createObjective.mutateAsync(values)
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
        <Protected module="security.objectives" action="write">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Objective
          </Button>
        </Protected>
      }
    >
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
        <div className="p-4 rounded-lg border">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Avg Progress</span>
          </div>
          <p className="text-2xl font-bold mt-1">{avgProgress}%</p>
        </div>
      </div>
      
      <DataTable
        columns={columns}
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
        config={formConfig}
        fields={["objectiveId", "title", "description", "category", "priority", "status", "targetDate", "progress"]}
        mode="create"
        onSubmit={handleCreate}
      />
    </PageShell>
  )
}

