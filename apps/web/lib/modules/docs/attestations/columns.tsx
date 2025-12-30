/**
 * Column definitions for Attestations DataTable
 */

"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Eye, ExternalLink } from "lucide-react"
import Link from "next/link"
import type { AcknowledgmentWithUser } from "@/lib/docs/types"

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "—"
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch {
    return dateString
  }
}

function formatDateTime(dateString: string | null): string {
  if (!dateString) return "—"
  try {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return dateString
  }
}

/**
 * Status badge config for attestations (using className for custom colors)
 */
export const attestationStatusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
  pending: { label: "Pending", variant: "secondary" },
  viewed: { label: "Viewed", variant: "outline", className: "border-yellow-500 text-yellow-600" },
  acknowledged: { label: "Acknowledged", variant: "outline", className: "border-green-500 text-green-600" },
  signed: { label: "Signed", variant: "outline", className: "border-green-500 text-green-600 bg-green-500/10" },
}

/**
 * Extended type with document info for table display
 */
export interface AttestationWithDocument extends AcknowledgmentWithUser {
  documentTitle?: string
  documentSlug?: string
  documentCategory?: string
}

/**
 * Column definitions for attestations table
 */
export const columns: ColumnDef<AttestationWithDocument>[] = [
  {
    id: "userName",
    accessorKey: "userName",
    header: "User",
    cell: ({ row }) => {
      const ack = row.original
      return (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{getInitials(ack.userName || "?")}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-medium">{ack.userName}</span>
            <span className="text-xs text-muted-foreground">{ack.userEmail}</span>
          </div>
        </div>
      )
    },
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    id: "documentTitle",
    accessorKey: "documentTitle",
    header: "Document",
    cell: ({ row }) => {
      const ack = row.original
      return (
        <div className="flex flex-col">
          <span className="font-medium">{ack.documentTitle || "—"}</span>
          {ack.documentCategory && (
            <Badge variant="outline" className="w-fit text-xs mt-0.5">
              {ack.documentCategory}
            </Badge>
          )}
        </div>
      )
    },
    enableSorting: true,
    enableColumnFilter: true,
    filterFn: (row, id, filterValue: string[]) => {
      if (!filterValue?.length) return true
      return filterValue.includes(row.original.documentTitle || "")
    },
  },
  {
    id: "status",
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as keyof typeof attestationStatusConfig
      const config = attestationStatusConfig[status]
      return (
        <Badge 
          variant={config?.variant ?? "secondary"} 
          className={config?.className}
        >
          {config?.label ?? status}
        </Badge>
      )
    },
    filterFn: (row, id, filterValue: string[]) => {
      if (!filterValue?.length) return true
      return filterValue.includes(row.getValue(id))
    },
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    id: "versionAcknowledged",
    accessorKey: "versionAcknowledged",
    header: "Version",
    cell: ({ row }) => {
      const version = row.getValue("versionAcknowledged") as string | null
      return version ? (
        <Badge variant="outline">v{version}</Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    },
    enableSorting: true,
    enableColumnFilter: false,
  },
  {
    id: "viewedAt",
    accessorKey: "viewedAt",
    header: "Viewed At",
    cell: ({ row }) => {
      const viewedAt = row.getValue("viewedAt") as string | null
      return (
        <span className={viewedAt ? "" : "text-muted-foreground"}>
          {formatDateTime(viewedAt)}
        </span>
      )
    },
    enableSorting: true,
    enableColumnFilter: false,
  },
  {
    id: "acknowledgedAt",
    accessorKey: "acknowledgedAt",
    header: "Acknowledged At",
    cell: ({ row }) => {
      const acknowledgedAt = row.getValue("acknowledgedAt") as string | null
      return (
        <span className={acknowledgedAt ? "" : "text-muted-foreground"}>
          {formatDateTime(acknowledgedAt)}
        </span>
      )
    },
    enableSorting: true,
    enableColumnFilter: false,
  },
  {
    id: "signedAt",
    accessorKey: "signedAt",
    header: "Signed At",
    cell: ({ row }) => {
      const signedAt = row.getValue("signedAt") as string | null
      return (
        <span className={signedAt ? "" : "text-muted-foreground"}>
          {formatDateTime(signedAt)}
        </span>
      )
    },
    enableSorting: true,
    enableColumnFilter: false,
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => {
      const ack = row.original
      return (
        <div className="flex items-center justify-end gap-2">
          {ack.documentSlug && (
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/docs/documents/${ack.documentSlug}`}>
                <ExternalLink className="h-4 w-4" />
                <span className="sr-only">View document</span>
              </Link>
            </Button>
          )}
        </div>
      )
    },
    enableSorting: false,
    enableColumnFilter: false,
  },
]

// Export column config for reference
export const columnConfig = {
  userName: { filterable: true, sortable: true, filterType: "search" as const },
  documentTitle: { filterable: true, sortable: true, filterType: "faceted" as const },
  status: { filterable: true, sortable: true, filterType: "faceted" as const },
  versionAcknowledged: { filterable: false, sortable: true },
  viewedAt: { filterable: false, sortable: true },
  acknowledgedAt: { filterable: false, sortable: true },
  signedAt: { filterable: false, sortable: true },
  actions: { filterable: false, sortable: false },
}

