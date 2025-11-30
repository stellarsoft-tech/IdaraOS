"use client"

import { useRouter } from "next/navigation"
import { FileCheck, Plus, Shield } from "lucide-react"

import { DataTable } from "@/components/data-table"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { controls, type Control } from "@/lib/seed-data"

const columns = [
  {
    key: "id" as const,
    label: "Control ID",
    render: (control: Control) => <span className="font-mono font-medium">{control.id}</span>,
  },
  {
    key: "title" as const,
    label: "Title",
    render: (control: Control) => (
      <div>
        <p className="font-medium">{control.title}</p>
        <p className="text-xs text-muted-foreground truncate max-w-[300px]">{control.description}</p>
      </div>
    ),
  },
  {
    key: "framework" as const,
    label: "Framework",
    render: (control: Control) => <span className="text-sm">{control.framework}</span>,
  },
  {
    key: "status" as const,
    label: "Status",
    render: (control: Control) => {
      const variants: Record<string, "success" | "info" | "warning"> = {
        effective: "success",
        implemented: "info",
        designed: "warning",
      }
      return (
        <StatusBadge variant={variants[control.status]}>
          {control.status.charAt(0).toUpperCase() + control.status.slice(1)}
        </StatusBadge>
      )
    },
  },
  {
    key: "evidenceCount" as const,
    label: "Evidence",
    render: (control: Control) => (
      <div className="flex items-center gap-1">
        <FileCheck className="h-4 w-4 text-muted-foreground" />
        <span>{control.evidenceCount}</span>
      </div>
    ),
  },
  {
    key: "owner" as const,
    label: "Owner",
  },
]

export default function ControlsPage() {
  const router = useRouter()

  const effectiveCount = controls.filter((c) => c.status === "effective").length
  const implementedCount = controls.filter((c) => c.status === "implemented").length
  const designedCount = controls.filter((c) => c.status === "designed").length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Controls Library"
        description="Manage security controls and track their implementation status."
      >
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Control
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-900/10">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-800 dark:text-green-400">Effective</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-green-900 dark:text-green-300">{effectiveCount}</p>
        </div>
        <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-900/10">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800 dark:text-blue-400">Implemented</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-blue-900 dark:text-blue-300">{implementedCount}</p>
        </div>
        <div className="p-4 rounded-lg border bg-yellow-50 dark:bg-yellow-900/10">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-800 dark:text-yellow-400">Designed</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-yellow-900 dark:text-yellow-300">{designedCount}</p>
        </div>
        <div className="p-4 rounded-lg border">
          <span className="text-sm font-medium text-muted-foreground">Total Controls</span>
          <p className="text-2xl font-bold mt-1">{controls.length}</p>
        </div>
      </div>

      <DataTable
        data={controls}
        columns={columns}
        searchKey="title"
        searchPlaceholder="Search controls..."
        onRowClick={(control) => router.push(`/security/controls/${control.id}`)}
      />
    </div>
  )
}
