"use client"

import type React from "react"

import { useRouter } from "next/navigation"
import { Box, Laptop, Monitor, Phone, Plus, Tablet } from "lucide-react"

import { DataTable } from "@/components/data-table"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { assets, type Asset } from "@/lib/seed-data"

const assetTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  laptop: Laptop,
  monitor: Monitor,
  phone: Phone,
  tablet: Tablet,
  accessory: Box,
}

const columns = [
  {
    key: "tag" as const,
    label: "Asset Tag",
    render: (asset: Asset) => {
      const Icon = assetTypeIcons[asset.type] || Box
      return (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <span className="font-mono font-medium">{asset.tag}</span>
        </div>
      )
    },
  },
  {
    key: "type" as const,
    label: "Type",
    render: (asset: Asset) => <span className="capitalize">{asset.type}</span>,
  },
  {
    key: "model" as const,
    label: "Model",
  },
  {
    key: "owner" as const,
    label: "Assignee",
    render: (asset: Asset) => (
      <span className={asset.owner ? "" : "text-muted-foreground"}>{asset.owner || "Unassigned"}</span>
    ),
  },
  {
    key: "status" as const,
    label: "Status",
    render: (asset: Asset) => {
      const variants: Record<string, "success" | "warning" | "info" | "danger"> = {
        assigned: "success",
        available: "info",
        maintenance: "warning",
        disposed: "danger",
      }
      return (
        <StatusBadge variant={variants[asset.status]}>
          {asset.status.charAt(0).toUpperCase() + asset.status.slice(1)}
        </StatusBadge>
      )
    },
  },
  {
    key: "warrantyEnd" as const,
    label: "Warranty End",
    render: (asset: Asset) => {
      const date = new Date(asset.warrantyEnd)
      const isExpired = date < new Date()
      return <span className={isExpired ? "text-red-600" : ""}>{date.toLocaleDateString()}</span>
    },
  },
  {
    key: "location" as const,
    label: "Location",
  },
]

export default function InventoryPage() {
  const router = useRouter()

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" description="View and manage all hardware assets in your organization.">
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Asset
        </Button>
      </PageHeader>

      <DataTable
        data={assets}
        columns={columns}
        searchKey="model"
        searchPlaceholder="Search assets..."
        onRowClick={(asset) => router.push(`/assets/inventory/${asset.id}`)}
      />
    </div>
  )
}
