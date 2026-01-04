"use client"

import { useState } from "react"
import { FileText } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AuditLogTable } from "@/components/audit"
import { useDocsAuditLogs } from "@/lib/api/audit"
import type { AuditLogFilters } from "@/lib/audit"

export default function DocsAuditLogPage() {
  const [filters, setFilters] = useState<AuditLogFilters>({
    limit: 20,
    offset: 0,
  })

  const { data, isLoading, refetch } = useDocsAuditLogs(filters)

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Docs Audit Log" 
        description="View audit trail for all Documentation module activities."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Documentation Activity
          </CardTitle>
          <CardDescription>
            Audit trail for documents, rollouts, acknowledgments, and policy changes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuditLogTable
            logs={data?.logs ?? []}
            total={data?.total ?? 0}
            isLoading={isLoading}
            filters={filters}
            onFiltersChange={setFilters}
            onRefresh={() => refetch()}
          />
        </CardContent>
      </Card>
    </div>
  )
}
