"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, CheckCircle, Clock, AlertTriangle, Shield, FileText, Target, XCircle, BookOpen } from "lucide-react"
import { format } from "date-fns"

import { PageShell } from "@/components/primitives/page-shell"
import { StatusBadge } from "@/components/status-badge"
import { StatCard } from "@/components/stat-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useSecurityFrameworks, useSoaItems, useClauseCompliance, type SecurityFramework } from "@/lib/api/security"

// SoA category data for ISO 27001
const annexACategories = [
  { id: "Organizational", name: "Organizational Controls", prefix: "A.5", totalControls: 37 },
  { id: "People", name: "People Controls", prefix: "A.6", totalControls: 8 },
  { id: "Physical", name: "Physical Controls", prefix: "A.7", totalControls: 14 },
  { id: "Technological", name: "Technological Controls", prefix: "A.8", totalControls: 34 },
]

function CategoryCard({ 
  category, 
  implemented, 
  total, 
  notApplicable 
}: { 
  category: { id: string; name: string; prefix: string; totalControls: number }
  implemented: number
  total: number
  notApplicable: number 
}) {
  const applicable = total - notApplicable
  const progress = applicable > 0 ? Math.round((implemented / applicable) * 100) : 0
  
  return (
    <Card className="hover:bg-muted/30 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{category.name}</CardTitle>
          <span className="text-sm text-muted-foreground">{category.prefix}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{implemented}/{applicable} implemented</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                progress >= 80 ? "bg-green-500" : progress >= 50 ? "bg-yellow-500" : "bg-orange-500"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          {notApplicable > 0 && (
            <p className="text-xs text-muted-foreground">
              {notApplicable} not applicable
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function ISO27001DashboardPage() {
  const { data: frameworksData, isLoading: frameworksLoading } = useSecurityFrameworks()
  const [frameworkId, setFrameworkId] = useState<string | undefined>()
  
  // Find ISO 27001 framework
  const isoFramework = frameworksData?.data?.find(f => f.code === "iso-27001")
  
  useEffect(() => {
    if (isoFramework) {
      setFrameworkId(isoFramework.id)
    }
  }, [isoFramework])
  
  const { data: soaData, isLoading: soaLoading } = useSoaItems(frameworkId)
  const { data: clauseData, isLoading: clauseLoading } = useClauseCompliance(frameworkId)
  
  const isLoading = frameworksLoading || soaLoading || clauseLoading
  
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
  
  // Calculate category stats
  const getCategoryStats = (categoryId: string) => {
    const categoryItems = soaItems.filter(item => item.standardControl.category === categoryId)
    return {
      total: categoryItems.length,
      implemented: categoryItems.filter(i => 
        i.implementationStatus === "implemented" || i.implementationStatus === "effective"
      ).length,
      notApplicable: categoryItems.filter(i => i.applicability === "not_applicable").length,
    }
  }
  
  const compliancePercent = summary.applicable > 0 
    ? Math.round((summary.implemented / summary.applicable) * 100) 
    : 0
  
  if (!isoFramework && !frameworksLoading) {
    return (
      <PageShell
        title="ISO 27001"
        description="ISO/IEC 27001:2022 Information Security Management System"
      >
        <Card className="py-12">
          <CardContent className="flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">ISO 27001 not configured</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Add ISO 27001 as a framework to start tracking your ISMS compliance.
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
      title="ISO 27001 Dashboard"
      description="ISO/IEC 27001:2022 Information Security Management System"
      action={
        <div className="flex items-center gap-2">
          {isoFramework && (
            <StatusBadge 
              variant={isoFramework.status === "certified" ? "success" : 
                       isoFramework.status === "implementing" ? "info" : "default"}
            >
              {isoFramework.status === "implementing" ? "In Progress" : 
               isoFramework.status.charAt(0).toUpperCase() + isoFramework.status.slice(1)}
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
              title="Compliance"
              value={`${compliancePercent}%`}
              description={`${summary.implemented} of ${summary.applicable} controls`}
              icon={Target}
              iconColor={`${
                compliancePercent >= 80 ? "bg-green-500/10 text-green-600 dark:text-green-400" :
                compliancePercent >= 50 ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" :
                "bg-orange-500/10 text-orange-600 dark:text-orange-400"
              }`}
            />
            <StatCard
              title="Implemented"
              value={summary.implemented}
              description="Controls effective or implemented"
              icon={CheckCircle}
              iconColor="bg-green-500/10 text-green-600 dark:text-green-400"
            />
            <StatCard
              title="Partial / In Progress"
              value={summary.partial}
              description="Controls partially implemented"
              icon={Clock}
              iconColor="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
            />
            <StatCard
              title="Gaps"
              value={summary.notImplemented}
              description="Controls not yet implemented"
              icon={AlertTriangle}
              iconColor="bg-red-500/10 text-red-600 dark:text-red-400"
            />
          </div>

          {/* Quick Links */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="hover:border-primary/50 transition-colors">
              <Link href="/security/frameworks/iso-27001/soa">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4" />
                    Statement of Applicability
                  </CardTitle>
                  <CardDescription>
                    Review and update control applicability for all 93 Annex A controls
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <span className="font-medium">{summary.applicable}</span>
                      <span className="text-muted-foreground"> applicable / </span>
                      <span className="font-medium">{summary.notApplicable}</span>
                      <span className="text-muted-foreground"> excluded</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Link>
            </Card>

            <Card className="hover:border-primary/50 transition-colors">
              <Link href="/security/frameworks/iso-27001/controls">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Shield className="h-4 w-4" />
                    Annex A Controls
                  </CardTitle>
                  <CardDescription>
                    Browse all 93 ISO 27001:2022 Annex A controls
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      4 categories • 93 controls
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Link>
            </Card>

            <Card className="hover:border-primary/50 transition-colors">
              <Link href="/security/frameworks/iso-27001/gaps">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="h-4 w-4" />
                    Gap Analysis
                  </CardTitle>
                  <CardDescription>
                    Identify and prioritize missing controls
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

            <Card className="hover:border-primary/50 transition-colors">
              <Link href="/security/frameworks/iso-27001/clauses">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BookOpen className="h-4 w-4" />
                    ISMS Clauses (4-10)
                  </CardTitle>
                  <CardDescription>
                    Track mandatory management system requirements
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      {clauseData?.summary ? (
                        <>
                          <span className="font-medium">{clauseData.summary.compliancePercent}%</span>
                          <span className="text-muted-foreground"> addressed • </span>
                          <span className="font-medium">{clauseData.summary.total}</span>
                          <span className="text-muted-foreground"> requirements</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">33 requirements</span>
                      )}
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Link>
            </Card>
          </div>

          {/* ISMS Clause Progress */}
          {clauseData?.summary && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">ISMS Requirements (Clauses 4-10)</CardTitle>
                    <CardDescription>
                      Mandatory management system requirements
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/security/frameworks/iso-27001/clauses">
                      View All
                      <ArrowRight className="ml-2 h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Overall Progress</span>
                      <span className="font-medium">{clauseData.summary.compliancePercent}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          clauseData.summary.compliancePercent >= 80 ? "bg-green-500" : 
                          clauseData.summary.compliancePercent >= 50 ? "bg-blue-500" : "bg-yellow-500"
                        }`}
                        style={{ width: `${clauseData.summary.compliancePercent}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="text-sm font-medium">{clauseData.summary.fullyAddressed + clauseData.summary.verified}</p>
                      <p className="text-xs text-muted-foreground">Fully Addressed</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-yellow-500" />
                    <div>
                      <p className="text-sm font-medium">{clauseData.summary.partiallyAddressed}</p>
                      <p className="text-xs text-muted-foreground">In Progress</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium">{clauseData.summary.notAddressed}</p>
                      <p className="text-xs text-muted-foreground">Not Addressed</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Category Breakdown */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Annex A Categories</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {annexACategories.map(category => {
                const stats = getCategoryStats(category.id)
                return (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    implemented={stats.implemented}
                    total={stats.total}
                    notApplicable={stats.notApplicable}
                  />
                )
              })}
            </div>
          </div>

          {/* Certification Info */}
          {isoFramework && (isoFramework.certifiedAt || isoFramework.expiresAt) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Certification Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  {isoFramework.certifiedAt && (
                    <div>
                      <p className="text-sm text-muted-foreground">Certified Date</p>
                      <p className="font-medium">{format(new Date(isoFramework.certifiedAt), "MMMM d, yyyy")}</p>
                    </div>
                  )}
                  {isoFramework.expiresAt && (
                    <div>
                      <p className="text-sm text-muted-foreground">Expiry Date</p>
                      <p className={`font-medium ${new Date(isoFramework.expiresAt) < new Date() ? "text-red-500" : ""}`}>
                        {format(new Date(isoFramework.expiresAt), "MMMM d, yyyy")}
                      </p>
                    </div>
                  )}
                  {isoFramework.certificationBody && (
                    <div>
                      <p className="text-sm text-muted-foreground">Certification Body</p>
                      <p className="font-medium">{isoFramework.certificationBody}</p>
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

