"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Plus } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { DataTableAdvanced as DataTable } from "@/components/primitives/data-table-advanced"
import { PageShell } from "@/components/primitives/page-shell"
import { FormDrawer } from "@/components/primitives/form-drawer"
import { Button } from "@/components/ui/button"
import { Protected } from "@/components/rbac/protected"

// Generated from spec
import { columns } from "@/lib/generated/security/isms/risk/columns"
import { formConfig, createFormSchema, getFormFields } from "@/lib/generated/security/isms/risk/form-config"
import type { Risk, CreateRisk } from "@/lib/generated/security/isms/risk/types"

// Mock data (TODO: Replace with API calls)
import { risks } from "@/lib/seed-data"

export default function RisksPage() {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  
  // TODO: Replace with useListQuery hook
  const data: Risk[] = risks.map((r) => ({
    ...r,
    risk_id: r.id,
    owner_id: "owner-" + r.id,
  })) as any
  const loading = false
  
  const handleCreate = async (values: CreateRisk) => {
    // TODO: Implement API call
    console.log("Creating risk:", values)
    // await api.post("/api/security/isms/risk", values)
  }
  
  // Calculate stats
  const highCritical = data.filter((r) => r.level === "high" || r.level === "critical").length
  const medium = data.filter((r) => r.level === "medium").length
  const low = data.filter((r) => r.level === "low").length
  
  return (
    <PageShell
      title="Risk Register"
      description="Identify, assess, and manage security risks across your organization."
      action={
        <Protected resource="security.risk" action="write">
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
          <p className="text-2xl font-bold mt-1">{data.length}</p>
        </div>
      </div>
      
      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        searchKey="title"
        searchPlaceholder="Search risks..."
        onRowClick={(risk) => router.push(`/security/risks/${risk.risk_id}`)}
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
          likelihood: {
            type: "enum",
            options: [
              { label: "Low", value: "low" },
              { label: "Medium", value: "medium" },
              { label: "High", value: "high" },
            ],
          },
          impact: {
            type: "enum",
            options: [
              { label: "Low", value: "low" },
              { label: "Medium", value: "medium" },
              { label: "High", value: "high" },
            ],
          },
          level: {
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
        title="Create Risk"
        description="Add a new risk to the register"
        schema={createFormSchema}
        config={formConfig}
        fields={getFormFields("create")}
        mode="create"
        onSubmit={handleCreate}
      />
    </PageShell>
  )
}
