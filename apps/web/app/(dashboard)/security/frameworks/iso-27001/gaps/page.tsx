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
  Filter
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

// Priority levels for gaps
const priorityLevels = [
  { value: "critical", label: "Critical", color: "text-red-600", bgColor: "bg-red-100" },
  { value: "high", label: "High", color: "text-orange-600", bgColor: "bg-orange-100" },
  { value: "medium", label: "Medium", color: "text-yellow-600", bgColor: "bg-yellow-100" },
  { value: "low", label: "Low", color: "text-blue-600", bgColor: "bg-blue-100" },
]

// Map categories to suggested priority (based on typical risk)
const categoryPriority: Record<string, string> = {
  Organizational: "high",
  People: "medium",
  Physical: "medium",
  Technological: "critical",
}

function GapCard({ item }: { item: SoaItem }) {
  const priority = categoryPriority[item.standardControl.category] || "medium"
  const priorityInfo = priorityLevels.find(p => p.value === priority) || priorityLevels[2]
  
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
          <Badge variant="secondary" className="text-xs">
            {item.standardControl.category}
          </Badge>
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
            href="/security/frameworks/iso-27001/soa" 
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            Update status
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

export default function ISO27001GapsPage() {
  const { data: frameworksData, isLoading: frameworksLoading } = useSecurityFrameworks()
  const [frameworkId, setFrameworkId] = useState<string | undefined>()
  const [filterCategory, setFilterCategory] = useState<string>("all")
  const [filterPriority, setFilterPriority] = useState<string>("all")
  
  // Find ISO 27001 framework
  const isoFramework = frameworksData?.data?.find(f => f.code === "iso-27001")
  
  useEffect(() => {
    if (isoFramework) {
      setFrameworkId(isoFramework.id)
    }
  }, [isoFramework])
  
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
    if (filterCategory !== "all" && item.standardControl.category !== filterCategory) {
      return false
    }
    if (filterPriority !== "all") {
      const itemPriority = categoryPriority[item.standardControl.category] || "medium"
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
  
  // Group by category for chart
  const categories = ["Organizational", "People", "Physical", "Technological"]
  const categoryGapCounts = categories.map(cat => ({
    category: cat,
    gaps: gaps.filter(g => g.standardControl.category === cat).length,
  }))
  
  const compliancePercent = summary.applicable > 0 
    ? Math.round((summary.implemented / summary.applicable) * 100) 
    : 0
  
  if (!isoFramework && !frameworksLoading) {
    return (
      <PageShell
        title="Gap Analysis"
        description="ISO 27001 Gap Analysis"
      >
        <Card className="py-12">
          <CardContent className="flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">ISO 27001 not configured</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Add ISO 27001 as a framework first to view gap analysis.
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
      title="ISO 27001 Gap Analysis"
      description="Identify and prioritize control gaps to achieve compliance."
      action={
        <Button variant="outline" asChild>
          <Link href="/security/frameworks/iso-27001">
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
              title="Compliance Score"
              value={`${compliancePercent}%`}
              description={`${summary.implemented} of ${summary.applicable} controls`}
              icon={CheckCircle}
              iconColor={compliancePercent >= 80 ? "bg-green-500/10 text-green-600" : "bg-yellow-500/10 text-yellow-600"}
            />
            <StatCard
              title="Critical Gaps"
              value={gaps.filter(g => categoryPriority[g.standardControl.category] === "critical").length}
              description="Technological controls"
              icon={AlertTriangle}
              iconColor="bg-red-500/10 text-red-600"
            />
            <StatCard
              title="High Priority"
              value={gaps.filter(g => categoryPriority[g.standardControl.category] === "high").length}
              description="Organizational controls"
              icon={Clock}
              iconColor="bg-orange-500/10 text-orange-600"
            />
          </div>
          
          {/* Gap Distribution by Category */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Gap Distribution by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {categoryGapCounts.map(({ category, gaps: gapCount }) => {
                  const total = allItems.filter(i => 
                    i.standardControl.category === category && i.applicability === "applicable"
                  ).length
                  const implemented = total - gapCount
                  const percent = total > 0 ? Math.round((implemented / total) * 100) : 0
                  
                  return (
                    <div key={category} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{category}</span>
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
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
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
                    ? "All applicable controls have been implemented. Great work!"
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

