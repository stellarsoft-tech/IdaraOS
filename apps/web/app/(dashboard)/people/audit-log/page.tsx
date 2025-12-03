"use client"

import { useState } from "react"
import { ScrollText } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AuditLogTable } from "@/components/audit"
import { usePeopleAuditLogs } from "@/lib/api/audit"
import type { AuditLogFilters } from "@/lib/audit"

export default function PeopleAuditLogPage() {
  const [filters, setFilters] = useState<AuditLogFilters>({
    limit: 20,
    offset: 0,
  })

  const { data, isLoading, refetch } = usePeopleAuditLogs(filters)

  return (
    <div className="space-y-6">
      <PageHeader 
        title="People Audit Log" 
        description="View audit trail for all People & HR module activities."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-4 w-4" />
            People Activity
          </CardTitle>
          <CardDescription>
            Audit trail for employee records, directory changes, and HR actions
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
