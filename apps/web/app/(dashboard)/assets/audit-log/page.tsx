"use client"

import { useState } from "react"
import { HardDrive } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AuditLogTable } from "@/components/audit"
import { useAssetsAuditLogs } from "@/lib/api/audit"
import type { AuditLogFilters } from "@/lib/audit"

export default function AssetsAuditLogPage() {
  const [filters, setFilters] = useState<AuditLogFilters>({
    limit: 20,
    offset: 0,
  })

  const { data, isLoading, refetch } = useAssetsAuditLogs(filters)

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Assets Audit Log" 
        description="View audit trail for all Assets module activities."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-4 w-4" />
            Assets Activity
          </CardTitle>
          <CardDescription>
            Audit trail for asset inventory, assignments, categories, maintenance, and lifecycle events
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
