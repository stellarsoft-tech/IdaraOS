"use client"

import { useRouter } from "next/navigation"
import { AlertTriangle, Plus } from "lucide-react"

import { DataTable } from "@/components/data-table"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { risks, type Risk } from "@/lib/seed-data"

const columns = [
  {
    key: "id" as const,
    label: "Risk ID",
    render: (risk: Risk) => <span className="font-mono font-medium">{risk.id}</span>,
  },
  {
    key: "title" as const,
    label: "Title",
    render: (risk: Risk) => (
      <div>
        <p className="font-medium">{risk.title}</p>
        <p className="text-xs text-muted-foreground truncate max-w-[300px]">{risk.description}</p>
      </div>
    ),
  },
  {
    key: "owner" as const,
    label: "Owner",
  },
  {
    key: "likelihood" as const,
    label: "Likelihood",
    render: (risk: Risk) => (
      <StatusBadge
        variant={risk.likelihood === "high" ? "danger" : risk.likelihood === "medium" ? "warning" : "success"}
      >
        {risk.likelihood}
      </StatusBadge>
    ),
  },
  {
    key: "impact" as const,
    label: "Impact",
    render: (risk: Risk) => (
      <StatusBadge variant={risk.impact === "high" ? "danger" : risk.impact === "medium" ? "warning" : "success"}>
        {risk.impact}
      </StatusBadge>
    ),
  },
  {
    key: "level" as const,
    label: "Level",
    render: (risk: Risk) => (
      <StatusBadge
        variant={
          risk.level === "critical" || risk.level === "high"
            ? "danger"
            : risk.level === "medium"
              ? "warning"
              : "success"
        }
      >
        {risk.level}
      </StatusBadge>
    ),
  },
  {
    key: "status" as const,
    label: "Status",
    render: (risk: Risk) => {
      const variants: Record<string, "success" | "warning" | "info" | "danger" | "default"> = {
        open: "warning",
        mitigated: "info",
        accepted: "default",
        closed: "success",
      }
      return (
        <StatusBadge variant={variants[risk.status]}>
          {risk.status.charAt(0).toUpperCase() + risk.status.slice(1)}
        </StatusBadge>
      )
    },
  },
]

export default function RisksPage() {
  const router = useRouter()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Risk Register"
        description="Identify, assess, and manage security risks across your organization."
      >
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Risk
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="p-4 rounded-lg border bg-red-50 dark:bg-red-900/10">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-sm font-medium text-red-800 dark:text-red-400">High/Critical</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-red-900 dark:text-red-300">
            {risks.filter((r) => r.level === "high" || r.level === "critical").length}
          </p>
        </div>
        <div className="p-4 rounded-lg border bg-yellow-50 dark:bg-yellow-900/10">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-800 dark:text-yellow-400">Medium</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-yellow-900 dark:text-yellow-300">
            {risks.filter((r) => r.level === "medium").length}
          </p>
        </div>
        <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-900/10">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-800 dark:text-green-400">Low</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-green-900 dark:text-green-300">
            {risks.filter((r) => r.level === "low").length}
          </p>
        </div>
        <div className="p-4 rounded-lg border">
          <span className="text-sm font-medium text-muted-foreground">Total Risks</span>
          <p className="text-2xl font-bold mt-1">{risks.length}</p>
        </div>
      </div>

      <DataTable
        data={risks}
        columns={columns}
        searchKey="title"
        searchPlaceholder="Search risks..."
        onRowClick={(risk) => router.push(`/security/risks/${risk.id}`)}
      />
    </div>
  )
}
