"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Plus, Shield, User } from "lucide-react"
import { z } from "zod"

import { DataTableAdvanced as DataTable } from "@/components/primitives/data-table-advanced"
import { PageShell } from "@/components/primitives/page-shell"
import { FormDrawer } from "@/components/primitives/form-drawer"
import { Protected } from "@/components/primitives/protected"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  useSecurityRisks, 
  useCreateSecurityRisk,
  type SecurityRisk 
} from "@/lib/api/security"
import { toast } from "sonner"

// Level badge variants
const levelVariants: Record<string, { label: string; className: string }> = {
  low: { label: "Low", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  medium: { label: "Medium", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  high: { label: "High", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
  critical: { label: "Critical", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
}

// Status badge variants
const statusVariants: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  open: { label: "Open", variant: "destructive" },
  mitigating: { label: "Mitigating", variant: "default" },
  accepted: { label: "Accepted", variant: "secondary" },
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
      const variant = statusVariants[row.original.status]
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

// Form schema
const createFormSchema = z.object({
  riskId: z.string().min(1, "Risk ID is required").max(50),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional(),
  category: z.enum(["operational", "compliance", "strategic", "financial", "reputational", "technical"]).default("operational"),
  inherentLikelihood: z.enum(["low", "medium", "high"]).default("medium"),
  inherentImpact: z.enum(["low", "medium", "high"]).default("medium"),
  status: z.enum(["open", "mitigating", "accepted", "closed"]).default("open"),
  treatment: z.enum(["mitigate", "accept", "transfer", "avoid"]).optional(),
  treatmentPlan: z.string().optional(),
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
    options: [
      { value: "operational", label: "Operational" },
      { value: "compliance", label: "Compliance" },
      { value: "strategic", label: "Strategic" },
      { value: "financial", label: "Financial" },
      { value: "reputational", label: "Reputational" },
      { value: "technical", label: "Technical" },
    ],
    required: true,
  },
  inherentLikelihood: {
    component: "select" as const,
    label: "Inherent Likelihood",
    placeholder: "Select likelihood",
    options: [
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" },
    ],
    required: true,
  },
  inherentImpact: {
    component: "select" as const,
    label: "Inherent Impact",
    placeholder: "Select impact",
    options: [
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" },
    ],
    required: true,
  },
  status: {
    component: "select" as const,
    label: "Status",
    placeholder: "Select status",
    options: [
      { value: "open", label: "Open" },
      { value: "mitigating", label: "Mitigating" },
      { value: "accepted", label: "Accepted" },
      { value: "closed", label: "Closed" },
    ],
    required: true,
  },
  treatment: {
    component: "select" as const,
    label: "Treatment Strategy",
    placeholder: "Select treatment",
    options: [
      { value: "mitigate", label: "Mitigate" },
      { value: "accept", label: "Accept" },
      { value: "transfer", label: "Transfer" },
      { value: "avoid", label: "Avoid" },
    ],
  },
  treatmentPlan: {
    component: "textarea" as const,
    label: "Treatment Plan",
    placeholder: "Describe the treatment plan",
  },
}

export default function RisksPage() {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  
  const { data: risksData, isLoading } = useSecurityRisks()
  const createRisk = useCreateSecurityRisk()
  
  const risks = risksData?.data || []
  
  // Calculate stats
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
  
  return (
    <PageShell
      title="Risk Register"
      description="Identify, assess, and manage security risks across your organization."
      action={
        <Protected module="security.risks" action="write">
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
        columns={columns}
        data={risks}
        loading={isLoading}
        searchKey="title"
        searchPlaceholder="Search risks..."
        onRowClick={(risk) => router.push(`/security/risks/${risk.id}`)}
        facetedFilters={{
          status: {
            type: "enum",
            options: [
              { label: "Open", value: "open" },
              { label: "Mitigating", value: "mitigating" },
              { label: "Accepted", value: "accepted" },
              { label: "Closed", value: "closed" },
            ],
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
            options: [
              { label: "Operational", value: "operational" },
              { label: "Compliance", value: "compliance" },
              { label: "Strategic", value: "strategic" },
              { label: "Financial", value: "financial" },
              { label: "Reputational", value: "reputational" },
              { label: "Technical", value: "technical" },
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
        title="Create Risk"
        description="Add a new risk to the register"
        schema={createFormSchema}
        config={formConfig}
        fields={["riskId", "title", "description", "category", "inherentLikelihood", "inherentImpact", "status", "treatment", "treatmentPlan"]}
        mode="create"
        onSubmit={handleCreate}
      />
    </PageShell>
  )
}
