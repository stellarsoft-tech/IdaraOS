"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { 
  ArrowLeft, 
  Shield, 
  FileText,
  Link as LinkIcon,
  CheckCircle,
  AlertCircle,
  Search,
  Filter,
  Upload,
  ExternalLink
} from "lucide-react"

import { PageShell } from "@/components/primitives/page-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useSecurityFrameworks, useSoaItems, useSecurityEvidence, type SoaItem } from "@/lib/api/security"

// Trust Service Principles
const principles = [
  { id: "Security", name: "Security", prefix: "CC" },
  { id: "Availability", name: "Availability", prefix: "A" },
  { id: "Processing Integrity", name: "Processing Integrity", prefix: "PI" },
  { id: "Confidentiality", name: "Confidentiality", prefix: "C" },
  { id: "Privacy", name: "Privacy", prefix: "P" },
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

function EvidenceStatusBadge({ hasEvidence, isImplemented }: { hasEvidence: boolean; isImplemented: boolean }) {
  if (!isImplemented) {
    return <Badge variant="secondary" className="text-xs">Not Required</Badge>
  }
  if (hasEvidence) {
    return <Badge className="bg-green-100 text-green-700 border-0 text-xs">Evidence Linked</Badge>
  }
  return <Badge variant="outline" className="text-yellow-600 border-yellow-300 text-xs">Needs Evidence</Badge>
}

export default function SOC2EvidencePage() {
  const { data: frameworksData, isLoading: frameworksLoading } = useSecurityFrameworks()
  const [frameworkId, setFrameworkId] = useState<string | undefined>()
  const [search, setSearch] = useState("")
  const [filterPrinciple, setFilterPrinciple] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  
  // Find SOC 2 framework
  const soc2Framework = frameworksData?.data?.find(f => f.code === "soc-2")
  
  useEffect(() => {
    if (soc2Framework) {
      setFrameworkId(soc2Framework.id)
    }
  }, [soc2Framework])
  
  const { data: soaData, isLoading: soaLoading } = useSoaItems(frameworkId)
  const { data: evidenceData, isLoading: evidenceLoading } = useSecurityEvidence()
  
  const isLoading = frameworksLoading || soaLoading || evidenceLoading
  
  // Get all items
  const allItems = soaData?.data || []
  const allEvidence = evidenceData?.data || []
  
  // Filter items
  const filteredItems = allItems.filter(item => {
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase()
      if (!item.standardControl.controlId.toLowerCase().includes(searchLower) &&
          !item.standardControl.title.toLowerCase().includes(searchLower)) {
        return false
      }
    }
    
    // Principle filter
    if (filterPrinciple !== "all") {
      const prefix = item.standardControl.controlId.split(".")[0]
      if (prefixToPrinciple[prefix] !== filterPrinciple) {
        return false
      }
    }
    
    // Status filter
    const isImplemented = item.implementationStatus === "implemented" || item.implementationStatus === "effective"
    const hasEvidence = allEvidence.some(e => e.linkedControlIds?.includes(item.id))
    
    if (filterStatus === "needs-evidence" && (!isImplemented || hasEvidence)) {
      return false
    }
    if (filterStatus === "has-evidence" && !hasEvidence) {
      return false
    }
    
    return true
  })
  
  // Calculate stats
  const implementedItems = allItems.filter(i => 
    i.implementationStatus === "implemented" || i.implementationStatus === "effective"
  )
  const itemsWithEvidence = implementedItems.filter(item =>
    allEvidence.some(e => e.linkedControlIds?.includes(item.id))
  )
  
  const evidenceCoverage = implementedItems.length > 0 
    ? Math.round((itemsWithEvidence.length / implementedItems.length) * 100) 
    : 0
  
  const needsEvidence = implementedItems.length - itemsWithEvidence.length
  
  if (!soc2Framework && !frameworksLoading) {
    return (
      <PageShell
        title="Evidence Matrix"
        description="SOC 2 Evidence Mapping"
      >
        <Card className="py-12">
          <CardContent className="flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">SOC 2 not configured</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Add SOC 2 as a framework first to manage evidence mapping.
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
      title="SOC 2 Evidence Matrix"
      description="Map evidence artifacts to Trust Service Criteria for audit readiness."
      action={
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/security/evidence">
              <Upload className="mr-2 h-4 w-4" />
              Manage Evidence
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/security/frameworks/soc-2">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>
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
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-2xl font-bold">{evidenceCoverage}%</span>
                </div>
                <p className="text-sm text-muted-foreground">Evidence Coverage</p>
                <Progress value={evidenceCoverage} className="h-2 mt-2" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-5 w-5 text-blue-500" />
                  <span className="text-2xl font-bold">{allEvidence.length}</span>
                </div>
                <p className="text-sm text-muted-foreground">Total Evidence Items</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <LinkIcon className="h-5 w-5 text-green-500" />
                  <span className="text-2xl font-bold">{itemsWithEvidence.length}</span>
                </div>
                <p className="text-sm text-muted-foreground">Criteria with Evidence</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                  <span className="text-2xl font-bold">{needsEvidence}</span>
                </div>
                <p className="text-sm text-muted-foreground">Need Evidence</p>
              </CardContent>
            </Card>
          </div>
          
          {/* Info Banner */}
          <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
            <CardContent className="py-4">
              <div className="flex items-start gap-4">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100">Evidence Collection Tips</h4>
                  <ul className="text-sm text-blue-700 dark:text-blue-300 mt-2 space-y-1">
                    <li>• Each implemented criterion should have at least one piece of supporting evidence</li>
                    <li>• Evidence can include policies, procedures, screenshots, logs, or third-party attestations</li>
                    <li>• Keep evidence current - auditors will look for recent artifacts</li>
                    <li>• One evidence item can support multiple criteria</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search criteria..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <Select value={filterPrinciple} onValueChange={setFilterPrinciple}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Principle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Principles</SelectItem>
                {principles.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="needs-evidence">Needs Evidence</SelectItem>
                <SelectItem value="has-evidence">Has Evidence</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Evidence Matrix Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evidence Mapping</CardTitle>
              <CardDescription>
                {filteredItems.length} criteria • Click a criterion to link evidence
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Criterion</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[120px]">Principle</TableHead>
                    <TableHead className="w-[140px]">Status</TableHead>
                    <TableHead className="w-[140px]">Evidence</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.slice(0, 50).map(item => {
                    const prefix = item.standardControl.controlId.split(".")[0]
                    const principle = prefixToPrinciple[prefix] || "Unknown"
                    const isImplemented = item.implementationStatus === "implemented" || item.implementationStatus === "effective"
                    const linkedEvidence = allEvidence.filter(e => e.linkedControlIds?.includes(item.id))
                    const hasEvidence = linkedEvidence.length > 0
                    
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-sm font-medium">
                          {item.standardControl.controlId}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-sm">{item.standardControl.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {item.standardControl.description}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {principle}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={isImplemented ? "default" : "secondary"} 
                            className="text-xs"
                          >
                            {isImplemented ? "Implemented" : "Not Implemented"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <EvidenceStatusBadge hasEvidence={hasEvidence} isImplemented={isImplemented} />
                          {hasEvidence && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {linkedEvidence.length} item{linkedEvidence.length !== 1 ? "s" : ""}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href="/security/evidence">
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              {filteredItems.length > 50 && (
                <p className="text-sm text-muted-foreground text-center mt-4">
                  Showing 50 of {filteredItems.length} criteria. Use filters to narrow results.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </PageShell>
  )
}

