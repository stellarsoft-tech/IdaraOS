"use client"

import { useState } from "react"
import { FolderArchive } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AuditLogTable } from "@/components/audit"
import { useFilingAuditLogs } from "@/lib/api/audit"
import type { AuditLogFilters } from "@/lib/audit"

export default function FilingAuditLogPage() {
  const [filters, setFilters] = useState<AuditLogFilters>({
    limit: 20,
    offset: 0,
  })

  const { data, isLoading, refetch } = useFilingAuditLogs(filters)

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Filing Audit Log" 
        description="View audit trail for all Filing module activities."
      />
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderArchive className="h-4 w-4" />
            Filing Activity
          </CardTitle>
          <CardDescription>
            Audit trail for file uploads, downloads, categories, and storage integrations
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
