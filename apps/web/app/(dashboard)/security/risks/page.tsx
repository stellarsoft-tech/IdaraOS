"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertTriangle, MoreHorizontal, Pencil, Plus, Shield, Trash2, User } from "lucide-react"
import { z } from "zod"

import { DataTableAdvanced as DataTable } from "@/components/primitives/data-table-advanced"
import { PageShell } from "@/components/primitives/page-shell"
import { FormDrawer } from "@/components/primitives/form-drawer"
import { Protected } from "@/components/primitives/protected"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { useUser } from "@/lib/rbac/context"
import { 
  useSecurityRisks, 
  useCreateSecurityRisk,
  useDeleteSecurityRisk,
  type SecurityRisk 
} from "@/lib/api/security"
import { usePeopleList } from "@/lib/api/people"
import {
  riskCategoryValues,
  riskLikelihoodValues,
  riskImpactValues,
  riskStatusValues,
  riskTreatmentValues,
} from "@/lib/db/schema/security"
import { toast } from "sonner"

// Human-readable labels for canonical enum values
const likelihoodLabels: Record<(typeof riskLikelihoodValues)[number], string> = {
  very_low: "Very Low",
  low: "Low",
  medium: "Medium",
  high: "High",
  very_high: "Very High",
}

const impactLabels: Record<(typeof riskImpactValues)[number], string> = {
  negligible: "Negligible",
  minor: "Minor",
  moderate: "Moderate",
  major: "Major",
  severe: "Severe",
}

const statusLabels: Record<(typeof riskStatusValues)[number], string> = {
  identified: "Identified",
  assessing: "Assessing",
  treating: "Treating",
  monitoring: "Monitoring",
  closed: "Closed",
}

const categoryLabels: Record<(typeof riskCategoryValues)[number], string> = {
  operational: "Operational",
  compliance: "Compliance",
  strategic: "Strategic",
  financial: "Financial",
  reputational: "Reputational",
  technical: "Technical",
}

const treatmentLabels: Record<(typeof riskTreatmentValues)[number], string> = {
  avoid: "Avoid",
  transfer: "Transfer",
  mitigate: "Mitigate",
  accept: "Accept",
}

// Level badge variants
const levelVariants: Record<string, { label: string; className: string }> = {
  low: { label: "Low", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  medium: { label: "Medium", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  high: { label: "High", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
  critical: { label: "Critical", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
}

// Status badge variants (keyed on canonical riskStatusValues)
const statusVariants: Record<(typeof riskStatusValues)[number], { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  identified: { label: "Identified", variant: "destructive" },
  assessing: { label: "Assessing", variant: "default" },
  treating: { label: "Treating", variant: "default" },
  monitoring: { label: "Monitoring", variant: "secondary" },
  closed: { label: "Closed", variant: "outline" },
}

// Table columns
const columns = [
  {
    accessorKey: "riskId",
    header: "Risk ID",
    cell: ({ row }: { row: { original: SecurityRisk } }) => (
      <span className="font-medium">{row.original.riskId}</span>
    ),
  },
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }: { row: { original: SecurityRisk } }) => (
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
    accessorKey: "category",
    header: "Category",
    cell: ({ row }: { row: { original: SecurityRisk } }) => (
      <span className="text-sm capitalize">{row.original.category?.replace(/_/g, " ") || "-"}</span>
    ),
  },
  {
    accessorKey: "ownerName",
    header: "Owner",
    cell: ({ row }: { row: { original: SecurityRisk } }) => (
      <div className="flex items-center gap-2">
        <User className="h-3 w-3 text-muted-foreground" />
        <span className="text-sm">{row.original.ownerName || "Unassigned"}</span>
      </div>
    ),
  },
  {
    accessorKey: "inherentLevel",
    header: "Inherent Level",
    cell: ({ row }: { row: { original: SecurityRisk } }) => {
      const variant = levelVariants[row.original.inherentLevel]
      return (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${variant?.className || ""}`}>
          {variant?.label || row.original.inherentLevel}
        </span>
      )
    },
  },
  {
    accessorKey: "residualLevel",
    header: "Residual Level",
    cell: ({ row }: { row: { original: SecurityRisk } }) => {
      if (!row.original.residualLevel) return <span className="text-muted-foreground">-</span>
      const variant = levelVariants[row.original.residualLevel]
      return (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${variant?.className || ""}`}>
          {variant?.label || row.original.residualLevel}
        </span>
      )
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }: { row: { original: SecurityRisk } }) => {
      const variant = statusVariants[row.original.status as (typeof riskStatusValues)[number]]
      return (
        <Badge variant={variant?.variant || "default"}>
          {variant?.label || row.original.status}
        </Badge>
      )
    },
  },
  {
    accessorKey: "controlsCount",
    header: "Controls",
    cell: ({ row }: { row: { original: SecurityRisk } }) => (
      <div className="flex items-center gap-1">
        <Shield className="h-4 w-4 text-muted-foreground" />
        <span>{row.original.controlsCount || 0}</span>
      </div>
    ),
  },
]

// Form schema - mirrors the API contract in /api/security/risks
const createFormSchema = z.object({
  riskId: z.string().min(1, "Risk ID is required").max(50),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional(),
  category: z.enum(riskCategoryValues).default("operational"),
  inherentLikelihood: z.enum(riskLikelihoodValues).default("medium"),
  inherentImpact: z.enum(riskImpactValues).default("moderate"),
  status: z.enum(riskStatusValues).default("identified"),
  treatment: z.enum(riskTreatmentValues).optional(),
  treatmentPlan: z.string().optional(),
  ownerId: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.string().uuid().nullable().optional(),
  ),
})

// Form config
const formConfig = {
  riskId: {
    component: "input" as const,
    label: "Risk ID",
    placeholder: "e.g., RSK-001",
    required: true,
    type: "text",
  },
  title: {
    component: "input" as const,
    label: "Title",
    placeholder: "Enter risk title",
    required: true,
    type: "text",
  },
  description: {
    component: "textarea" as const,
    label: "Description",
    placeholder: "Describe the risk in detail",
  },
  category: {
    component: "select" as const,
    label: "Category",
    placeholder: "Select category",
    options: riskCategoryValues.map(v => ({ value: v, label: categoryLabels[v] })),
    required: true,
  },
  inherentLikelihood: {
    component: "select" as const,
    label: "Inherent Likelihood",
    placeholder: "Select likelihood",
    options: riskLikelihoodValues.map(v => ({ value: v, label: likelihoodLabels[v] })),
    required: true,
  },
  inherentImpact: {
    component: "select" as const,
    label: "Inherent Impact",
    placeholder: "Select impact",
    options: riskImpactValues.map(v => ({ value: v, label: impactLabels[v] })),
    required: true,
  },
  status: {
    component: "select" as const,
    label: "Status",
    placeholder: "Select status",
    options: riskStatusValues.map(v => ({ value: v, label: statusLabels[v] })),
    required: true,
  },
  treatment: {
    component: "select" as const,
    label: "Treatment Strategy",
    placeholder: "Select treatment",
    options: riskTreatmentValues.map(v => ({ value: v, label: treatmentLabels[v] })),
  },
  treatmentPlan: {
    component: "textarea" as const,
    label: "Treatment Plan",
    placeholder: "Describe the treatment plan",
  },
  ownerId: {
    component: "select" as const,
    label: "Risk Owner",
    placeholder: "Select an owner",
    helpText: "Person accountable for managing this risk",
    options: [] as Array<{ value: string; label: string }>,
  },
}

export default function RisksPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const wantsCreate = searchParams.get("create") === "true"

  const [createOpen, setCreateOpen] = useState(wantsCreate)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [riskToDelete, setRiskToDelete] = useState<SecurityRisk | null>(null)

  const { hasPermission } = useUser()
  const canEdit = hasPermission("security.risks", "edit") || hasPermission("security.risks", "write")
  const canDelete = hasPermission("security.risks", "delete")

  const { data: risksData, isLoading } = useSecurityRisks()
  const createRisk = useCreateSecurityRisk()
  const deleteRisk = useDeleteSecurityRisk()
  const { data: people = [] } = usePeopleList({ status: ["active"] })

  const risks = risksData?.data || []

  // Inject the live list of people as owner options on top of the static config
  const createFormConfig = useMemo(() => ({
    ...formConfig,
    ownerId: {
      ...formConfig.ownerId,
      options: [
        { value: "", label: "— Unassigned —" },
        ...people.map((p) => ({ value: p.id, label: p.name })),
      ],
    },
  }), [people])

  const highCritical = risks.filter(r => r.inherentLevel === "high" || r.inherentLevel === "critical").length
  const medium = risks.filter(r => r.inherentLevel === "medium").length
  const low = risks.filter(r => r.inherentLevel === "low").length

  const handleCreate = async (values: z.infer<typeof createFormSchema>) => {
    try {
      await createRisk.mutateAsync(values)
      toast.success("Risk created successfully")
      setCreateOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create risk")
    }
  }

  const handleDeleteClick = (risk: SecurityRisk) => {
    setRiskToDelete(risk)
    setDeleteOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!riskToDelete) return
    try {
      await deleteRisk.mutateAsync(riskToDelete.id)
      toast.success("Risk deleted successfully")
      setDeleteOpen(false)
      setRiskToDelete(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete risk")
    }
  }

  // Build columns with row actions appended when the user can act on rows
  const tableColumns = useMemo(() => {
    const hasRowActions = canEdit || canDelete
    if (!hasRowActions) return columns

    const actionsColumn = {
      id: "actions",
      header: "",
      cell: ({ row }: { row: { original: SecurityRisk } }) => (
        <div onClick={(e) => e.stopPropagation()} className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit && (
                <DropdownMenuItem
                  onClick={() => router.push(`/security/risks/${row.original.id}`)}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  View / Edit
                </DropdownMenuItem>
              )}
              {canEdit && canDelete && <DropdownMenuSeparator />}
              {canDelete && (
                <DropdownMenuItem
                  onClick={() => handleDeleteClick(row.original)}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    }

    return [...columns, actionsColumn]
     
  }, [canEdit, canDelete, router])

  useEffect(() => {
    if (wantsCreate) {
      setCreateOpen(true)
    }
  }, [wantsCreate])

  useEffect(() => {
    if (!createOpen && wantsCreate) {
      const params = new URLSearchParams(searchParams.toString())
      params.delete("create")
      const query = params.toString()
      router.replace(query ? `/security/risks?${query}` : "/security/risks", { scroll: false })
    }
  }, [createOpen, wantsCreate, searchParams, router])
  
  return (
    <PageShell
      title="Risk Register"
      description="Identify, assess, and manage security risks across your organization."
      action={
        <Protected module="security.risks" anyAction={["create", "write"]}>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Risk
          </Button>
        </Protected>
      }
    >
      {/* Risk Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <div className="p-4 rounded-lg border bg-red-50 dark:bg-red-900/10">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-sm font-medium text-red-800 dark:text-red-400">High/Critical</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-red-900 dark:text-red-300">{highCritical}</p>
        </div>
        <div className="p-4 rounded-lg border bg-yellow-50 dark:bg-yellow-900/10">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-800 dark:text-yellow-400">Medium</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-yellow-900 dark:text-yellow-300">{medium}</p>
        </div>
        <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-900/10">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-800 dark:text-green-400">Low</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-green-900 dark:text-green-300">{low}</p>
        </div>
        <div className="p-4 rounded-lg border">
          <span className="text-sm font-medium text-muted-foreground">Total Risks</span>
          <p className="text-2xl font-bold mt-1">{risks.length}</p>
        </div>
      </div>
      
      <DataTable
        columns={tableColumns}
        data={risks}
        loading={isLoading}
        searchKey="title"
        searchPlaceholder="Search risks..."
        onRowClick={(risk) => router.push(`/security/risks/${risk.id}`)}
        facetedFilters={{
          status: {
            type: "enum",
            options: riskStatusValues.map(v => ({ label: statusLabels[v], value: v })),
          },
          inherentLevel: {
            type: "enum",
            options: [
              { label: "Low", value: "low" },
              { label: "Medium", value: "medium" },
              { label: "High", value: "high" },
              { label: "Critical", value: "critical" },
            ],
          },
          category: {
            type: "enum",
            options: riskCategoryValues.map(v => ({ label: categoryLabels[v], value: v })),
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
        title="Create Risk"
        description="Add a new risk to the register"
        schema={createFormSchema}
        config={createFormConfig}
        fields={["riskId", "title", "description", "category", "ownerId", "inherentLikelihood", "inherentImpact", "status", "treatment", "treatmentPlan"]}
        mode="create"
        onSubmit={handleCreate}
      />

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open)
          if (!open) setRiskToDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Risk</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>
                {riskToDelete?.riskId} - {riskToDelete?.title}
              </strong>
              ? This will also remove all links to controls and audit history for this risk.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteRisk.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteRisk.isPending ? "Deleting..." : "Delete Risk"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  )
}
