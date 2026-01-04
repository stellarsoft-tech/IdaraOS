"use client"

import { useState } from "react"
import { Shield } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AuditLogTable } from "@/components/audit"
import { useSecurityAuditLogs } from "@/lib/api/audit"
import type { AuditLogFilters } from "@/lib/audit"

export default function SecurityAuditLogPage() {
  const [filters, setFilters] = useState<AuditLogFilters>({
    limit: 20,
    offset: 0,
  })

  const { data, isLoading, refetch } = useSecurityAuditLogs(filters)

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Security Audit Log" 
        description="View audit trail for all Security module activities."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Security Activity
          </CardTitle>
          <CardDescription>
            Audit trail for risks, controls, evidence, frameworks, audits, and compliance activities
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
