"use client"

import Link from "next/link"
import { AlertTriangle, ArrowRight, ClipboardList, FileCheck, Lock, Shield, Target } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  useSecurityRisks, 
  useSecurityControls, 
  useSecurityEvidence, 
  useSecurityAudits,
  useSecurityFrameworks 
} from "@/lib/api/security"

function StatSkeleton() {
  return <Skeleton className="h-28" />
}

function CardSkeleton() {
  return <Skeleton className="h-40" />
}

export default function SecurityOverviewPage() {
  const { data: risksData, isLoading: risksLoading } = useSecurityRisks({ limit: 100 })
  const { data: controlsData, isLoading: controlsLoading } = useSecurityControls({ limit: 100 })
  const { data: evidenceData, isLoading: evidenceLoading } = useSecurityEvidence({ limit: 100 })
  const { data: auditsData, isLoading: auditsLoading } = useSecurityAudits({ limit: 100 })
  const { data: frameworksData, isLoading: frameworksLoading } = useSecurityFrameworks()
  
  const risks = risksData?.data || []
  const controls = controlsData?.data || []
  const evidence = evidenceData?.data || []
  const audits = auditsData?.data || []
  const frameworks = frameworksData?.data || []
  
  const openRisks = risks.filter((r) => r.status === "open").length
  const highRisks = risks.filter((r) => r.inherentLevel === "high" || r.inherentLevel === "critical").length
  const effectiveControls = controls.filter((c) => c.implementationStatus === "effective").length
  const implementedControls = controls.filter((c) => c.implementationStatus === "implemented" || c.implementationStatus === "effective").length
  const activeAudits = audits.filter((a) => a.status === "in_progress").length
  
  const isLoading = risksLoading || controlsLoading || evidenceLoading || auditsLoading || frameworksLoading

  return (
    <div className="space-y-6">
      <PageHeader title="Security" description="Manage your organization's security posture and compliance.">
        <Button asChild>
          <Link href="/security/risks">
            <AlertTriangle className="mr-2 h-4 w-4" />
            View Risks
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : (
          <>
            <StatCard
              title="Open Risks"
              value={openRisks}
              description={`${highRisks} high priority`}
              icon={AlertTriangle}
              iconColor="bg-red-500/10 text-red-600 dark:text-red-400"
            />
            <StatCard
              title="Controls"
              value={controls.length}
              description={`${effectiveControls} effective`}
              icon={Shield}
              iconColor="bg-blue-500/10 text-blue-600 dark:text-blue-400"
            />
            <StatCard 
              title="Active Audits" 
              value={activeAudits} 
              icon={ClipboardList}
              iconColor="bg-purple-500/10 text-purple-600 dark:text-purple-400"
            />
            <StatCard 
              title="Evidence Items" 
              value={evidence.length} 
              icon={FileCheck}
              iconColor="bg-green-500/10 text-green-600 dark:text-green-400"
            />
          </>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/security/frameworks">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Frameworks (IMS)
              </CardTitle>
              <CardDescription>ISO 27001, SOC 2, and more</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {frameworksLoading ? (
                    <Skeleton className="h-5 w-32" />
                  ) : frameworks.length > 0 ? (
                    frameworks.slice(0, 2).map((fw) => (
                      <StatusBadge 
                        key={fw.id} 
                        variant={fw.status === "certified" ? "success" : fw.status === "implementing" ? "info" : "default"}
                      >
                        {fw.name}
                      </StatusBadge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">No frameworks added</span>
                  )}
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/security/risks">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Risk Register
              </CardTitle>
              <CardDescription>Identify and manage security risks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                {risksLoading ? (
                  <Skeleton className="h-5 w-24" />
                ) : (
                  <StatusBadge variant={openRisks > 0 ? "warning" : "success"}>
                    {openRisks} open
                  </StatusBadge>
                )}
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/security/controls">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Controls Library
              </CardTitle>
              <CardDescription>Security controls and their status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                {controlsLoading ? (
                  <Skeleton className="h-5 w-32" />
                ) : (
                  <StatusBadge variant="success">
                    {effectiveControls}/{controls.length} effective
                  </StatusBadge>
                )}
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Compliance Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {frameworksLoading ? (
              <>
                <Skeleton className="h-8" />
                <Skeleton className="h-8" />
                <Skeleton className="h-8" />
              </>
            ) : frameworks.length > 0 ? (
              <>
                {frameworks.map((fw) => {
                  // Calculate compliance percentage based on implemented controls
                  const compliancePercent = fw.implementedCount && fw.controlsCount 
                    ? Math.round((fw.implementedCount / fw.controlsCount) * 100)
                    : 0
                  return (
                    <div key={fw.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">{fw.name}</span>
                        <span className="text-sm font-medium">{compliancePercent}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            compliancePercent >= 80 ? "bg-green-500" : 
                            compliancePercent >= 50 ? "bg-yellow-500" : "bg-gray-400"
                          }`}
                          style={{ width: `${compliancePercent}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Control Coverage</span>
                    <span className="text-sm font-medium">
                      {implementedControls}/{controls.length}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${controls.length > 0 ? (implementedControls / controls.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-2">No frameworks configured</p>
                <Button asChild variant="outline" size="sm">
                  <Link href="/security/frameworks">Add Framework</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Recent Risk Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {risksLoading ? (
              <>
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </>
            ) : risks.length > 0 ? (
              risks.slice(0, 4).map((risk) => (
                <Link 
                  key={risk.id} 
                  href={`/security/risks/${risk.id}`}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">{risk.riskId}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">{risk.title}</p>
                  </div>
                  <StatusBadge
                    variant={
                      risk.inherentLevel === "critical" || risk.inherentLevel === "high"
                        ? "danger"
                        : risk.inherentLevel === "medium"
                          ? "warning"
                          : "success"
                    }
                  >
                    {risk.inherentLevel}
                  </StatusBadge>
                </Link>
              ))
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-2">No risks recorded</p>
                <Button asChild variant="outline" size="sm">
                  <Link href="/security/risks">Add Risk</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
