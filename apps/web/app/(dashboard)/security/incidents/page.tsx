"use client"

import Link from "next/link"
import { AlertTriangle, FileText, Plus } from "lucide-react"

import { DataTableAdvanced as DataTable } from "@/components/primitives/data-table-advanced"
import { PageShell } from "@/components/primitives/page-shell"
import { Protected } from "@/components/primitives/protected"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  useSecurityIncidents,
  type SecurityIncident,
} from "@/lib/api/security"

const severityLabels: Record<string, string> = {
  p1: "P1 — Critical",
  p2: "P2 — High",
  p3: "P3 — Medium",
  p4: "P4 — Low",
}

const statusLabels: Record<string, string> = {
  draft: "Draft",
  reported: "Reported",
  triaging: "Triaging",
  responding: "Responding",
  resolved: "Resolved",
  closed: "Closed",
}

const columns = [
  {
    accessorKey: "incidentId",
    header: "ID",
    cell: ({ row }: { row: { original: SecurityIncident } }) => (
      <Link href={buildIncidentHref(row.original)} className="font-medium text-primary hover:underline">
        {row.original.incidentId}
      </Link>
    ),
  },
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }: { row: { original: SecurityIncident } }) => (
      <div className="flex items-center gap-2">
        {row.original.documentSlug && <FileText className="h-4 w-4 text-muted-foreground" />}
        <span>{row.original.title}</span>
      </div>
    ),
  },
  {
    accessorKey: "severity",
    header: "Severity",
    cell: ({ row }: { row: { original: SecurityIncident } }) => (
      <Badge variant={row.original.severity === "p1" ? "destructive" : "secondary"}>
        {severityLabels[row.original.severity]}
      </Badge>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }: { row: { original: SecurityIncident } }) => statusLabels[row.original.status],
  },
  {
    accessorKey: "publicationStatus",
    header: "Document",
    cell: ({ row }: { row: { original: SecurityIncident } }) =>
      row.original.documentSlug ? (
        <Link href={`/docs/view/${row.original.documentSlug}`} className="text-primary hover:underline">
          v{row.original.currentVersion}
        </Link>
      ) : (
        "Register only"
      ),
  },
  {
    accessorKey: "ownerName",
    header: "Owner",
    cell: ({ row }: { row: { original: SecurityIncident } }) => row.original.ownerName || "Unassigned",
  },
  {
    accessorKey: "linkedEvidenceIds",
    header: "Evidence",
    cell: ({ row }: { row: { original: SecurityIncident } }) => row.original.linkedEvidenceIds?.length ?? 0,
  },
]

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replaceAll(/[^\w\s-]/g, "")
    .replaceAll(/[\s_-]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
}

function buildIncidentUrlSegment(incident: SecurityIncident): string {
  const titleSlug = slugify(incident.title) || "incident"
  return `${titleSlug}--${encodeURIComponent(incident.incidentId)}`
}

function buildIncidentHref(incident: SecurityIncident): string {
  return incident.documentSlug
    ? `/docs/view/${incident.documentSlug}`
    : `/security/incidents/${buildIncidentUrlSegment(incident)}`
}

export default function IncidentsPage() {
  const { data, isLoading } = useSecurityIncidents({ limit: 500 })
  const incidents = data?.data ?? []

  return (
    <PageShell
      title="Incident Management"
      description="Record, respond to, and learn from information security incidents (ISO 27001 A.5.24–A.5.28)."
      action={
        <Protected module="docs.incident-documentation" action="create">
          <Button asChild>
            <Link href="/docs/documents/new?category=incident">
              <Plus className="mr-2 h-4 w-4" />
              New Incident Document
            </Link>
          </Button>
        </Protected>
      }
    >
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <div className="p-4 rounded-lg border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4" /> Total Incidents
          </div>
          <p className="text-2xl font-bold mt-1">{incidents.length}</p>
        </div>
        <div className="p-4 rounded-lg border">
          <p className="text-sm text-muted-foreground">Open / Active</p>
          <p className="text-2xl font-bold mt-1">
            {incidents.filter((i) => !["resolved", "closed"].includes(i.status)).length}
          </p>
        </div>
        <div className="p-4 rounded-lg border">
          <p className="text-sm text-muted-foreground">Published</p>
          <p className="text-2xl font-bold mt-1">
            {incidents.filter((i) => i.publicationStatus === "published").length}
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={incidents}
        loading={isLoading}
        searchKey="title"
        searchPlaceholder="Search incidents..."
        enableSorting
        enableExport
      />
    </PageShell>
  )
}
