// Generated from spec.json - DO NOT EDIT MANUALLY
"use client"

import { ColumnDef } from "@tanstack/react-table"
import { StatusBadge } from "@/components/status-badge"
import type { Risk } from "./types"

export const columns: ColumnDef<Risk>[] = [
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.getValue("title")}</p>
        {row.original.description && (
          <p className="text-xs text-muted-foreground truncate max-w-[300px]">
            {row.original.description}
          </p>
        )}
      </div>
    ),
  },
  {
    accessorKey: "owner_id",
    header: "Owner",
    cell: ({ row }) => {
      const value = row.getValue("owner_id") as string
      // TODO: Fetch and display referenced entity name
      return <span className="text-muted-foreground">{value}</span>
    },
  },
  {
    accessorKey: "likelihood",
    header: "Likelihood",
    cell: ({ row }) => {
      const value = row.getValue("likelihood") as string
      return (
        <StatusBadge variant={riskLikelihoodVariants[value] || "default"}>
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </StatusBadge>
      )
    },
    filterFn: (row, id, value) => {
      if (!value || value.length === 0) return true
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: "impact",
    header: "Impact",
    cell: ({ row }) => {
      const value = row.getValue("impact") as string
      return (
        <StatusBadge variant={riskImpactVariants[value] || "default"}>
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </StatusBadge>
      )
    },
    filterFn: (row, id, value) => {
      if (!value || value.length === 0) return true
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: "level",
    header: "Level",
    cell: ({ row }) => {
      const value = row.getValue("level") as string
      return (
        <StatusBadge variant={riskLevelVariants[value] || "default"}>
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </StatusBadge>
      )
    },
    filterFn: (row, id, value) => {
      if (!value || value.length === 0) return true
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const value = row.getValue("status") as string
      return (
        <StatusBadge variant={riskStatusVariants[value] || "default"}>
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </StatusBadge>
      )
    },
    filterFn: (row, id, value) => {
      if (!value || value.length === 0) return true
      return value.includes(row.getValue(id))
    },
  }
]

const riskLikelihoodVariants: Record<string, "success" | "warning" | "info" | "danger" | "default"> = {
  "low": "success",
  "medium": "warning",
  "high": "danger"
}

const riskImpactVariants: Record<string, "success" | "warning" | "info" | "danger" | "default"> = {
  "low": "success",
  "medium": "warning",
  "high": "danger"
}

const riskLevelVariants: Record<string, "success" | "warning" | "info" | "danger" | "default"> = {
  "low": "success",
  "medium": "warning",
  "high": "danger",
  "critical": "danger"
}

/**
 * Status variants for Risk
 */
export const riskStatusVariants: Record<string, "success" | "warning" | "info" | "danger" | "default"> = {
  "open": "danger",
  "mitigating": "info",
  "accepted": "default",
  "closed": "success"
}

