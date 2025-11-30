/**
 * AUTO-GENERATED from specs/modules/people/person/spec.json
 * DO NOT EDIT MANUALLY
 */

"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { Person } from "./types"
import { personStatusVariants } from "./types"

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function formatDate(dateString: string): string {
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

export const columns: ColumnDef<Person>[] = [
  {
    id: "name",
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => {
      const person = row.original
      return (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={person.avatar} alt={person.name} />
            <AvatarFallback className="text-xs">{getInitials(person.name)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-medium">{person.name}</span>
          </div>
        </div>
      )
    },
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    id: "email",
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.getValue("email")}</span>
    ),
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    id: "role",
    accessorKey: "role",
    header: "Role",
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    id: "team",
    accessorKey: "team",
    header: "Team",
    cell: ({ row }) => {
      const team = row.getValue("team") as string | undefined
      return team ? <Badge variant="outline">{team}</Badge> : <span className="text-muted-foreground">—</span>
    },
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    id: "status",
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as keyof typeof personStatusVariants
      const config = personStatusVariants[status]
      return <Badge variant={config?.variant ?? "secondary"}>{config?.label ?? status}</Badge>
    },
    filterFn: (row, id, filterValue: string[]) => {
      if (!filterValue?.length) return true
      return filterValue.includes(row.getValue(id))
    },
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    id: "startDate",
    accessorKey: "startDate",
    header: "Start Date",
    cell: ({ row }) => formatDate(row.getValue("startDate")),
    enableSorting: true,
    enableColumnFilter: false,
  },
  {
    id: "assignedAssets",
    accessorKey: "assignedAssets",
    header: "Assets",
    cell: ({ row }) => {
      const count = row.getValue("assignedAssets") as number
      return <span className="tabular-nums">{count}</span>
    },
    enableSorting: true,
    enableColumnFilter: false,
  },
]

// Export individual column configs for customization
export const columnConfig = {
  name: { filterable: true, sortable: true },
  email: { filterable: true, sortable: true },
  role: { filterable: true, sortable: true },
  team: { filterable: true, sortable: true },
  status: { filterable: true, sortable: true, filterType: "enum" as const },
  startDate: { filterable: false, sortable: true },
  assignedAssets: { filterable: false, sortable: true },
}
