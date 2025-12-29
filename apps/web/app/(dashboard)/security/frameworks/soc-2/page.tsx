"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, CheckCircle, Clock, AlertTriangle, Shield, FileText, Target, Briefcase, Lock, Cpu, Users } from "lucide-react"
import { format } from "date-fns"

import { PageShell } from "@/components/primitives/page-shell"
import { StatusBadge } from "@/components/status-badge"
import { StatCard } from "@/components/stat-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useSecurityFrameworks, useSoaItems, type SecurityFramework } from "@/lib/api/security"

// SOC 2 Trust Service Criteria
const trustServiceCategories = [
  { id: "Security - Control Environment", name: "Control Environment", principle: "Security", prefix: "CC1", icon: Shield },
  { id: "Security - Communication and Information", name: "Communication & Information", principle: "Security", prefix: "CC2", icon: Briefcase },
  { id: "Security - Risk Assessment", name: "Risk Assessment", principle: "Security", prefix: "CC3", icon: AlertTriangle },
  { id: "Security - Monitoring Activities", name: "Monitoring Activities", principle: "Security", prefix: "CC4", icon: Target },
  { id: "Security - Control Activities", name: "Control Activities", principle: "Security", prefix: "CC5", icon: CheckCircle },
  { id: "Security - Logical and Physical Access", name: "Logical & Physical Access", principle: "Security", prefix: "CC6", icon: Lock },
  { id: "Security - System Operations", name: "System Operations", principle: "Security", prefix: "CC7", icon: Cpu },
  { id: "Security - Change Management", name: "Change Management", principle: "Security", prefix: "CC8", icon: FileText },
  { id: "Security - Risk Mitigation", name: "Risk Mitigation", principle: "Security", prefix: "CC9", icon: Shield },
  { id: "Availability", name: "Availability", principle: "Availability", prefix: "A1", icon: Clock },
  { id: "Processing Integrity", name: "Processing Integrity", principle: "Processing Integrity", prefix: "PI1", icon: CheckCircle },
  { id: "Confidentiality", name: "Confidentiality", principle: "Confidentiality", prefix: "C1", icon: Lock },
  { id: "Privacy", name: "Privacy", principle: "Privacy", prefix: "P", icon: Users },
]

// Principle summaries
const principleInfo: Record<string, { color: string; bgColor: string }> = {
  Security: { color: "text-blue-600", bgColor: "bg-blue-500/10" },
  Availability: { color: "text-green-600", bgColor: "bg-green-500/10" },
  "Processing Integrity": { color: "text-purple-600", bgColor: "bg-purple-500/10" },
  Confidentiality: { color: "text-yellow-600", bgColor: "bg-yellow-500/10" },
  Privacy: { color: "text-pink-600", bgColor: "bg-pink-500/10" },
}

function PrincipleCard({
  principle,
  items,
}: {
  principle: string
  items: Array<{ implementationStatus: string; applicability: string }>
}) {
  const info = principleInfo[principle] || principleInfo.Security
  const applicable = items.filter(i => i.applicability === "applicable").length
  const implemented = items.filter(i => 
    i.implementationStatus === "implemented" || i.implementationStatus === "effective"
  ).length
  const progress = applicable > 0 ? Math.round((implemented / applicable) * 100) : 0
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className={`h-8 w-8 rounded-lg ${info.bgColor} flex items-center justify-center`}>
            <Shield className={`h-4 w-4 ${info.color}`} />
          </div>
          <span className="text-sm font-medium">{progress}%</span>
        </div>
        <CardTitle className="text-base">{principle}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                progress >= 80 ? "bg-green-500" : progress >= 50 ? "bg-yellow-500" : "bg-orange-500"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {implemented}/{applicable} criteria met
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export default function SOC2DashboardPage() {
  const { data: frameworksData, isLoading: frameworksLoading } = useSecurityFrameworks()
  const [frameworkId, setFrameworkId] = useState<string | undefined>()
  
  // Find SOC 2 framework
  const soc2Framework = frameworksData?.data?.find(f => f.code === "soc-2")
  
  useEffect(() => {
    if (soc2Framework) {
      setFrameworkId(soc2Framework.id)
    }
  }, [soc2Framework])
  
  const { data: soaData, isLoading: soaLoading } = useSoaItems(frameworkId)
  
  const isLoading = frameworksLoading || soaLoading
  
  // Calculate stats from SoA data
  const soaItems = soaData?.data || []
  const summary = soaData?.summary || {
    total: 0,
    applicable: 0,
    notApplicable: 0,
    implemented: 0,
    partial: 0,
    notImplemented: 0,
  }
  
  // Group items by principle
  const getPrincipleItems = (principle: string) => {
    return soaItems.filter(item => {
      const category = trustServiceCategories.find(c => c.id === item.standardControl.category)
      return category?.principle === principle
    })
  }
  
  const uniquePrinciples = [...new Set(trustServiceCategories.map(c => c.principle))]
  
  const compliancePercent = summary.applicable > 0 
    ? Math.round((summary.implemented / summary.applicable) * 100) 
    : 0
  
  if (!soc2Framework && !frameworksLoading) {
    return (
      <PageShell
        title="SOC 2"
        description="Service Organization Control 2"
      >
        <Card className="py-12">
          <CardContent className="flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">SOC 2 not configured</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Add SOC 2 as a framework to start tracking your Trust Service Criteria compliance.
            </p>
            <Button asChild>
              <Link href="/security/frameworks">Go to Frameworks</Link>
            </Button>
          </CardContent>
        </Card>
      </PageShell>
    )
  }
  
  return (
    <PageShell
      title="SOC 2 Dashboard"
      description="Service Organization Control 2 - Trust Service Criteria"
      action={
        <div className="flex items-center gap-2">
          {soc2Framework && (
            <StatusBadge 
              variant={soc2Framework.status === "certified" ? "success" : 
                       soc2Framework.status === "implementing" ? "info" : "default"}
            >
              {soc2Framework.status === "implementing" ? "In Progress" : 
               soc2Framework.status.charAt(0).toUpperCase() + soc2Framework.status.slice(1)}
            </StatusBadge>
          )}
        </div>
      }
    >
      {isLoading ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overview Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Audit Readiness"
              value={`${compliancePercent}%`}
              description={`${summary.implemented} of ${summary.applicable} criteria`}
              icon={Target}
              iconColor={`${
                compliancePercent >= 80 ? "bg-green-500/10 text-green-600 dark:text-green-400" :
                compliancePercent >= 50 ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" :
                "bg-orange-500/10 text-orange-600 dark:text-orange-400"
              }`}
            />
            <StatCard
              title="Criteria Met"
              value={summary.implemented}
              description="Trust service criteria satisfied"
              icon={CheckCircle}
              iconColor="bg-green-500/10 text-green-600 dark:text-green-400"
            />
            <StatCard
              title="In Progress"
              value={summary.partial}
              description="Criteria partially met"
              icon={Clock}
              iconColor="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
            />
            <StatCard
              title="Gaps"
              value={summary.notImplemented}
              description="Criteria not yet met"
              icon={AlertTriangle}
              iconColor="bg-red-500/10 text-red-600 dark:text-red-400"
            />
          </div>

          {/* Quick Links */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="hover:border-primary/50 transition-colors">
              <Link href="/security/frameworks/soc-2/criteria">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Shield className="h-4 w-4" />
                    Trust Service Criteria
                  </CardTitle>
                  <CardDescription>
                    Review all TSC categories and their implementation status
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      5 principles • {summary.total} criteria
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Link>
            </Card>

            <Card className="hover:border-primary/50 transition-colors">
              <Link href="/security/frameworks/soc-2/evidence">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4" />
                    Evidence Matrix
                  </CardTitle>
                  <CardDescription>
                    Map evidence to trust service criteria
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Audit-ready evidence collection
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Link>
            </Card>

            <Card className="hover:border-primary/50 transition-colors">
              <Link href="/security/frameworks/soc-2/gaps">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="h-4 w-4" />
                    Gap Analysis
                  </CardTitle>
                  <CardDescription>
                    Identify and prioritize missing criteria
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <span className="font-medium text-red-600">{summary.notImplemented}</span>
                      <span className="text-muted-foreground"> gaps to address</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Link>
            </Card>
          </div>

          {/* Trust Service Principles */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Trust Service Principles</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              {uniquePrinciples.map(principle => (
                <PrincipleCard
                  key={principle}
                  principle={principle}
                  items={getPrincipleItems(principle)}
                />
              ))}
            </div>
          </div>

          {/* Audit Info */}
          {soc2Framework && (soc2Framework.certifiedAt || soc2Framework.expiresAt) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Audit Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  {soc2Framework.certifiedAt && (
                    <div>
                      <p className="text-sm text-muted-foreground">Last Audit</p>
                      <p className="font-medium">{format(new Date(soc2Framework.certifiedAt), "MMMM d, yyyy")}</p>
                    </div>
                  )}
                  {soc2Framework.expiresAt && (
                    <div>
                      <p className="text-sm text-muted-foreground">Report Expiry</p>
                      <p className={`font-medium ${new Date(soc2Framework.expiresAt) < new Date() ? "text-red-500" : ""}`}>
                        {format(new Date(soc2Framework.expiresAt), "MMMM d, yyyy")}
                      </p>
                    </div>
                  )}
                  {soc2Framework.certificationBody && (
                    <div>
                      <p className="text-sm text-muted-foreground">Audit Firm</p>
                      <p className="font-medium">{soc2Framework.certificationBody}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </PageShell>
  )
}

