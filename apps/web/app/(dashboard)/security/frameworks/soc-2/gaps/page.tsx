"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { 
  ArrowLeft, 
  AlertTriangle, 
  Shield, 
  Clock,
  CheckCircle,
  XCircle,
  ChevronRight,
  Filter,
  Server,
  FileCheck,
  Lock,
  Eye
} from "lucide-react"

import { PageShell } from "@/components/primitives/page-shell"
import { StatCard } from "@/components/stat-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useSecurityFrameworks, useSoaItems, type SoaItem } from "@/lib/api/security"

// Trust Service Principles with icons
const trustPrinciples = [
  { id: "Security", name: "Security", icon: Shield, color: "text-blue-600", bgColor: "bg-blue-100" },
  { id: "Availability", name: "Availability", icon: Server, color: "text-green-600", bgColor: "bg-green-100" },
  { id: "Processing Integrity", name: "Processing Integrity", icon: FileCheck, color: "text-purple-600", bgColor: "bg-purple-100" },
  { id: "Confidentiality", name: "Confidentiality", icon: Lock, color: "text-yellow-600", bgColor: "bg-yellow-100" },
  { id: "Privacy", name: "Privacy", icon: Eye, color: "text-pink-600", bgColor: "bg-pink-100" },
]

// Map prefixes to principles
const prefixToPrinciple: Record<string, string> = {
  "CC1": "Security", "CC2": "Security", "CC3": "Security", "CC4": "Security", "CC5": "Security",
  "CC6": "Security", "CC7": "Security", "CC8": "Security", "CC9": "Security",
  "A1": "Availability",
  "PI1": "Processing Integrity",
  "C1": "Confidentiality",
  "P1": "Privacy", "P2": "Privacy", "P3": "Privacy", "P4": "Privacy",
  "P5": "Privacy", "P6": "Privacy", "P7": "Privacy", "P8": "Privacy",
}

// Priority levels for gaps
const priorityLevels = [
  { value: "critical", label: "Critical", color: "text-red-600", bgColor: "bg-red-100" },
  { value: "high", label: "High", color: "text-orange-600", bgColor: "bg-orange-100" },
  { value: "medium", label: "Medium", color: "text-yellow-600", bgColor: "bg-yellow-100" },
  { value: "low", label: "Low", color: "text-blue-600", bgColor: "bg-blue-100" },
]

// Security is critical, others vary
const principlePriority: Record<string, string> = {
  "Security": "critical",
  "Availability": "high",
  "Processing Integrity": "high",
  "Confidentiality": "medium",
  "Privacy": "medium",
}

function GapCard({ item }: { item: SoaItem }) {
  const prefix = item.standardControl.controlId.split(".")[0]
  const principle = prefixToPrinciple[prefix] || "Security"
  const principleInfo = trustPrinciples.find(p => p.id === principle) || trustPrinciples[0]
  const priority = principlePriority[principle] || "medium"
  const priorityInfo = priorityLevels.find(p => p.value === priority) || priorityLevels[2]
  const Icon = principleInfo.icon
  
  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              {item.standardControl.controlId}
            </Badge>
            <Badge className={`${priorityInfo.bgColor} ${priorityInfo.color} border-0 text-xs`}>
              {priorityInfo.label}
            </Badge>
          </div>
          <div className={`h-6 w-6 rounded ${principleInfo.bgColor} flex items-center justify-center`}>
            <Icon className={`h-3.5 w-3.5 ${principleInfo.color}`} />
          </div>
        </div>
        <CardTitle className="text-base mt-2">{item.standardControl.title}</CardTitle>
        <CardDescription className="line-clamp-2">
          {item.standardControl.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {item.implementationStatus === "not_implemented" ? (
              <>
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm text-muted-foreground">Not implemented</span>
              </>
            ) : (
              <>
                <Clock className="h-4 w-4 text-yellow-500" />
                <span className="text-sm text-muted-foreground">Partially implemented</span>
              </>
            )}
          </div>
          <Link 
            href="/security/frameworks/soc-2/criteria" 
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            View details
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

export default function SOC2GapsPage() {
  const { data: frameworksData, isLoading: frameworksLoading } = useSecurityFrameworks()
  const [frameworkId, setFrameworkId] = useState<string | undefined>()
  const [filterPrinciple, setFilterPrinciple] = useState<string>("all")
  const [filterPriority, setFilterPriority] = useState<string>("all")
  
  // Find SOC 2 framework
  const soc2Framework = frameworksData?.data?.find(f => f.code === "soc-2")
  
  useEffect(() => {
    if (soc2Framework) {
      setFrameworkId(soc2Framework.id)
    }
  }, [soc2Framework])
  
  const { data: soaData, isLoading: soaLoading } = useSoaItems(frameworkId)
  
  const isLoading = frameworksLoading || soaLoading
  
  // Get gaps (not implemented or partially implemented AND applicable)
  const allItems = soaData?.data || []
  const gaps = allItems.filter(item => 
    item.applicability === "applicable" && 
    (item.implementationStatus === "not_implemented" || item.implementationStatus === "partially_implemented")
  )
  
  // Filter gaps
  const filteredGaps = gaps.filter(item => {
    const prefix = item.standardControl.controlId.split(".")[0]
    const principle = prefixToPrinciple[prefix]
    
    if (filterPrinciple !== "all" && principle !== filterPrinciple) {
      return false
    }
    if (filterPriority !== "all") {
      const itemPriority = principlePriority[principle] || "medium"
      if (itemPriority !== filterPriority) {
        return false
      }
    }
    return true
  })
  
  // Calculate stats
  const summary = soaData?.summary || {
    total: 0,
    applicable: 0,
    notApplicable: 0,
    implemented: 0,
    partial: 0,
    notImplemented: 0,
  }
  
  const notImplementedGaps = gaps.filter(g => g.implementationStatus === "not_implemented")
  const partialGaps = gaps.filter(g => g.implementationStatus === "partially_implemented")
  
  // Group by principle for chart
  const principleGapCounts = trustPrinciples.map(principle => ({
    principle,
    gaps: gaps.filter(g => {
      const prefix = g.standardControl.controlId.split(".")[0]
      return prefixToPrinciple[prefix] === principle.id
    }).length,
    total: allItems.filter(i => {
      const prefix = i.standardControl.controlId.split(".")[0]
      return prefixToPrinciple[prefix] === principle.id && i.applicability === "applicable"
    }).length,
  }))
  
  const auditReadiness = summary.applicable > 0 
    ? Math.round((summary.implemented / summary.applicable) * 100) 
    : 0
  
  // Critical gaps (Security principle)
  const criticalGaps = gaps.filter(g => {
    const prefix = g.standardControl.controlId.split(".")[0]
    return prefixToPrinciple[prefix] === "Security"
  })
  
  if (!soc2Framework && !frameworksLoading) {
    return (
      <PageShell
        title="Gap Analysis"
        description="SOC 2 Gap Analysis"
      >
        <Card className="py-12">
          <CardContent className="flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">SOC 2 not configured</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Add SOC 2 as a framework first to view gap analysis.
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
      title="SOC 2 Gap Analysis"
      description="Identify and prioritize Trust Service Criteria gaps to achieve audit readiness."
      action={
        <Button variant="outline" asChild>
          <Link href="/security/frameworks/soc-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      }
    >
      {isLoading ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard
              title="Total Gaps"
              value={gaps.length}
              description={`${notImplementedGaps.length} not implemented, ${partialGaps.length} partial`}
              icon={AlertTriangle}
              iconColor="bg-red-500/10 text-red-600"
            />
            <StatCard
              title="Audit Readiness"
              value={`${auditReadiness}%`}
              description={`${summary.implemented} of ${summary.applicable} criteria`}
              icon={CheckCircle}
              iconColor={auditReadiness >= 80 ? "bg-green-500/10 text-green-600" : "bg-yellow-500/10 text-yellow-600"}
            />
            <StatCard
              title="Security Gaps"
              value={criticalGaps.length}
              description="Common Criteria (required)"
              icon={Shield}
              iconColor="bg-red-500/10 text-red-600"
            />
            <StatCard
              title="Other Gaps"
              value={gaps.length - criticalGaps.length}
              description="Optional principles"
              icon={Clock}
              iconColor="bg-orange-500/10 text-orange-600"
            />
          </div>
          
          {/* Gap Distribution by Principle */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Gap Distribution by Principle</CardTitle>
              <CardDescription>
                Security (Common Criteria) is required for all SOC 2 reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {principleGapCounts.map(({ principle, gaps: gapCount, total }) => {
                  const implemented = total - gapCount
                  const percent = total > 0 ? Math.round((implemented / total) * 100) : 0
                  const Icon = principle.icon
                  
                  return (
                    <div key={principle.id} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className={`h-6 w-6 rounded ${principle.bgColor} flex items-center justify-center`}>
                            <Icon className={`h-3.5 w-3.5 ${principle.color}`} />
                          </div>
                          <span className="font-medium">{principle.name}</span>
                          {principle.id === "Security" && (
                            <Badge variant="outline" className="text-xs">Required</Badge>
                          )}
                        </div>
                        <span className="text-muted-foreground">
                          {gapCount} gap{gapCount !== 1 ? "s" : ""} • {percent}% complete
                        </span>
                      </div>
                      <Progress value={percent} className="h-2" />
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
          
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <Select value={filterPrinciple} onValueChange={setFilterPrinciple}>
              <SelectTrigger className="w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by principle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Principles</SelectItem>
                {trustPrinciples.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                {priorityLevels.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Gap Cards */}
          {filteredGaps.length === 0 ? (
            <Card className="py-12">
              <CardContent className="flex flex-col items-center text-center">
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  {gaps.length === 0 ? "No gaps found!" : "No matching gaps"}
                </h3>
                <p className="text-muted-foreground max-w-md">
                  {gaps.length === 0 
                    ? "All applicable Trust Service Criteria have been implemented. Your organization is audit-ready!"
                    : "Try adjusting your filters to see more gaps."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredGaps.map(gap => (
                <GapCard key={gap.id} item={gap} />
              ))}
            </div>
          )}
        </div>
      )}
    </PageShell>
  )
}

