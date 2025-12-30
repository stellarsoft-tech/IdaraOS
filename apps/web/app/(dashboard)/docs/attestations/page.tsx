"use client"

import * as React from "react"
import Link from "next/link"
import { CheckCircle, Clock, Eye, FileText, Users } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useDocuments, useAcknowledgments } from "@/lib/api/docs"
import { DataTableAdvanced as DataTable } from "@/components/primitives/data-table-advanced"
import { columns } from "@/lib/modules/docs/attestations/columns"
import type { AcknowledgmentWithUser } from "@/lib/docs/types"

export default function AttestationsPage() {
  const [selectedDocId, setSelectedDocId] = React.useState<string>("all")
  
  const { data: docsData } = useDocuments({ status: "published" })
  const { data: acksData, isLoading } = useAcknowledgments(
    selectedDocId !== "all" ? { documentId: selectedDocId } : undefined
  )
  
  const documents = docsData?.data || []
  const acknowledgments = acksData?.data || []
  
  // Calculate stats
  const stats = {
    total: acknowledgments.length,
    pending: acknowledgments.filter((a) => a.status === "pending").length,
    viewed: acknowledgments.filter((a) => a.status === "viewed").length,
    completed: acknowledgments.filter((a) => ["acknowledged", "signed"].includes(a.status)).length,
  }

  // Get unique document titles for faceted filter
  const documentTitles = React.useMemo(() => {
    const titles = new Set(acknowledgments.map((a) => a.documentTitle).filter(Boolean))
    return Array.from(titles).map((title) => ({
      label: title as string,
      value: title as string,
    }))
  }, [acknowledgments])

  // Get unique statuses for faceted filter
  const statusOptions = [
    { label: "Pending", value: "pending" },
    { label: "Viewed", value: "viewed" },
    { label: "Acknowledged", value: "acknowledged" },
    { label: "Signed", value: "signed" },
  ]
  
  return (
    <div className="space-y-6">
      <PageHeader
        title="Attestations"
        description="Track document acknowledgements and policy sign-offs across the organization."
      />
      
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Total Attestations"
          value={isLoading ? "-" : stats.total}
          icon={Users}
        />
        <StatCard
          title="Pending"
          value={isLoading ? "-" : stats.pending}
          icon={Clock}
        />
        <StatCard
          title="Viewed"
          value={isLoading ? "-" : stats.viewed}
          icon={Eye}
        />
        <StatCard
          title="Completed"
          value={isLoading ? "-" : stats.completed}
          icon={CheckCircle}
        />
      </div>
      
      {/* Main Card with DataTable */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Attestation Records</CardTitle>
              <CardDescription>
                Individual acknowledgement records for documents. Filter by document or status.
              </CardDescription>
            </div>
            <Select value={selectedDocId} onValueChange={setSelectedDocId}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="All Documents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Documents</SelectItem>
                {documents.map((doc) => (
                  <SelectItem key={doc.id} value={doc.id}>
                    {doc.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={acknowledgments}
            loading={isLoading}
            searchKey="userName"
            searchPlaceholder="Search by user name or email..."
            facetedFilters={{
              status: { 
                type: "enum",
                options: statusOptions,
              },
              documentTitle: { 
                type: "enum",
                options: documentTitles,
              },
            }}
            enableColumnFilters
            enableSorting
            enableExport
            enableColumnVisibility
            initialColumnVisibility={{
              signedAt: false, // Hidden by default, available in column selector
            }}
            emptyState={
              <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">No attestations found</h3>
                <p className="text-muted-foreground mt-2 mb-4">
                  {selectedDocId === "all" 
                    ? "No attestation records have been created yet."
                    : "No attestation records found for the selected document."}
                </p>
              </div>
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
