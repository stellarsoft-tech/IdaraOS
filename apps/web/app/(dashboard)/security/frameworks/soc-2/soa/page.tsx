"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronDown, ChevronRight, CheckCircle, XCircle, AlertCircle, Shield, ArrowLeft, Filter, Server, FileCheck, Lock, Eye } from "lucide-react"

import { PageShell } from "@/components/primitives/page-shell"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useSecurityFrameworks, useSoaItems, useUpdateSoaItem, type SoaItem } from "@/lib/api/security"
import { toast } from "sonner"

// Trust Service Principles with their categories
const trustPrinciples = [
  { 
    id: "Security",
    name: "Security (Common Criteria)", 
    description: "Information and systems are protected against unauthorized access",
    icon: Shield,
    color: "text-blue-600",
    bgColor: "bg-blue-500/10",
    prefixes: ["CC1", "CC2", "CC3", "CC4", "CC5", "CC6", "CC7", "CC8", "CC9"]
  },
  { 
    id: "Availability",
    name: "Availability", 
    description: "The system is available for operation and use as committed",
    icon: Server,
    color: "text-green-600",
    bgColor: "bg-green-500/10",
    prefixes: ["A1"]
  },
  { 
    id: "Processing Integrity",
    name: "Processing Integrity", 
    description: "System processing is complete, valid, accurate, timely, and authorized",
    icon: FileCheck,
    color: "text-purple-600",
    bgColor: "bg-purple-500/10",
    prefixes: ["PI1"]
  },
  { 
    id: "Confidentiality",
    name: "Confidentiality", 
    description: "Information designated as confidential is protected as committed",
    icon: Lock,
    color: "text-yellow-600",
    bgColor: "bg-yellow-500/10",
    prefixes: ["C1"]
  },
  { 
    id: "Privacy",
    name: "Privacy", 
    description: "Personal information is handled in conformity with commitments",
    icon: Eye,
    color: "text-pink-600",
    bgColor: "bg-pink-500/10",
    prefixes: ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"]
  },
]

// Map prefixes to principles
const prefixToPrinciple: Record<string, string> = {
  "CC1": "Security", "CC2": "Security", "CC3": "Security", "CC4": "Security",
  "CC5": "Security", "CC6": "Security", "CC7": "Security", "CC8": "Security", "CC9": "Security",
  "A1": "Availability",
  "PI1": "Processing Integrity",
  "C1": "Confidentiality",
  "P1": "Privacy", "P2": "Privacy", "P3": "Privacy", "P4": "Privacy",
  "P5": "Privacy", "P6": "Privacy", "P7": "Privacy", "P8": "Privacy",
}

// Implementation status icons and colors
const implementationIcons: Record<string, { icon: typeof CheckCircle; color: string }> = {
  not_implemented: { icon: XCircle, color: "text-gray-400" },
  partially_implemented: { icon: AlertCircle, color: "text-yellow-500" },
  implemented: { icon: CheckCircle, color: "text-blue-500" },
  effective: { icon: CheckCircle, color: "text-green-500" },
}

// Applicability badges
const applicabilityBadges: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  applicable: { label: "Applicable", variant: "default" },
  not_applicable: { label: "N/A", variant: "secondary" },
  partially_applicable: { label: "Partial", variant: "outline" },
}

function SoaItemRow({ 
  item, 
  onEdit 
}: { 
  item: SoaItem & { orgControl?: { controlId: string; title: string } | null }
  onEdit: (item: SoaItem) => void
}) {
  const { icon: Icon, color } = implementationIcons[item.implementationStatus] || implementationIcons.not_implemented
  const badge = applicabilityBadges[item.applicability] || applicabilityBadges.applicable
  
  return (
    <div 
      className="flex items-start gap-4 px-6 py-4 hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={() => onEdit(item)}
    >
      <Icon className={`h-5 w-5 mt-0.5 ${color}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium font-mono">{item.standardControl.controlId}</span>
          <Badge variant={badge.variant} className="text-xs">
            {badge.label}
          </Badge>
        </div>
        <p className="text-sm font-medium">{item.standardControl.title}</p>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
          {item.standardControl.description}
        </p>
        {item.orgControl && (
          <div className="mt-2 text-xs">
            <span className="text-muted-foreground">Mapped to: </span>
            <span className="font-medium">{item.orgControl.controlId}</span>
          </div>
        )}
        {item.justification && item.applicability === "not_applicable" && (
          <div className="mt-2 text-xs">
            <span className="text-muted-foreground">Justification: </span>
            <span>{item.justification}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function PrincipleSection({ 
  principle, 
  items, 
  onEditItem,
  defaultOpen = false 
}: { 
  principle: typeof trustPrinciples[0]
  items: (SoaItem & { orgControl?: { controlId: string; title: string } | null })[]
  onEditItem: (item: SoaItem) => void
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const Icon = principle.icon
  
  const implementedCount = items.filter(i => 
    i.implementationStatus === "implemented" || i.implementationStatus === "effective"
  ).length
  const applicableCount = items.filter(i => i.applicability === "applicable").length
  const progress = applicableCount > 0 ? Math.round((implementedCount / applicableCount) * 100) : 0
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`h-10 w-10 rounded-lg ${principle.bgColor} flex items-center justify-center`}>
                  <Icon className={`h-5 w-5 ${principle.color}`} />
                </div>
                <div className="text-left">
                  <CardTitle className="text-base flex items-center gap-2">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    {principle.name}
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">{items.length} criteria</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-sm font-medium">{progress}%</span>
                  <p className="text-xs text-muted-foreground">{implementedCount}/{applicableCount}</p>
                </div>
                <div className="h-2 w-20 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${progress >= 80 ? "bg-green-500" : progress >= 50 ? "bg-yellow-500" : "bg-orange-500"}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-0">
            <div className="divide-y">
              {items.map(item => (
                <SoaItemRow key={item.id} item={item} onEdit={onEditItem} />
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

export default function SOC2SoAPage() {
  const { data: frameworksData, isLoading: frameworksLoading } = useSecurityFrameworks()
  const [frameworkId, setFrameworkId] = useState<string | undefined>()
  const [editItem, setEditItem] = useState<SoaItem | null>(null)
  const [editApplicability, setEditApplicability] = useState<string>("")
  const [editImplementation, setEditImplementation] = useState<string>("")
  const [editJustification, setEditJustification] = useState<string>("")
  const [editNotes, setEditNotes] = useState<string>("")
  const [search, setSearch] = useState("")
  const [filterPrinciple, setFilterPrinciple] = useState<string>("all")
  const [filterApplicability, setFilterApplicability] = useState<string>("all")
  const [filterImplementation, setFilterImplementation] = useState<string>("all")
  
  const updateSoaItem = useUpdateSoaItem()
  
  // Find SOC 2 framework
  const socFramework = frameworksData?.data?.find(f => f.code === "soc-2")
  
  useEffect(() => {
    if (socFramework) {
      setFrameworkId(socFramework.id)
    }
  }, [socFramework])
  
  const { data: soaData, isLoading: soaLoading } = useSoaItems(frameworkId)
  
  const isLoading = frameworksLoading || soaLoading
  
  // Open edit dialog
  const handleEditItem = (item: SoaItem) => {
    setEditItem(item)
    setEditApplicability(item.applicability)
    setEditImplementation(item.implementationStatus)
    setEditJustification(item.justification || "")
    setEditNotes(item.notes || "")
  }
  
  // Save changes
  const handleSave = async () => {
    if (!editItem || !frameworkId) return
    
    try {
      await updateSoaItem.mutateAsync({
        frameworkId,
        itemId: editItem.id,
        data: {
          applicability: editApplicability as "applicable" | "not_applicable" | "partially_applicable",
          implementationStatus: editImplementation as "not_implemented" | "partially_implemented" | "implemented" | "effective",
          justification: editJustification || null,
          notes: editNotes || null,
        },
      })
      toast.success("Criterion updated successfully")
      setEditItem(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update criterion")
    }
  }
  
  // Filter and group items by principle
  const allItems = soaData?.data || []
  
  const filteredItems = allItems.filter(item => {
    if (search) {
      const searchLower = search.toLowerCase()
      if (!item.standardControl.controlId.toLowerCase().includes(searchLower) &&
          !item.standardControl.title.toLowerCase().includes(searchLower)) {
        return false
      }
    }
    if (filterPrinciple !== "all") {
      const prefix = item.standardControl.controlId.split(".")[0]
      const principle = prefixToPrinciple[prefix]
      if (principle !== filterPrinciple) {
        return false
      }
    }
    if (filterApplicability !== "all" && item.applicability !== filterApplicability) {
      return false
    }
    if (filterImplementation !== "all" && item.implementationStatus !== filterImplementation) {
      return false
    }
    return true
  })
  
  // Group items by principle
  const groupedByPrinciple = trustPrinciples.map(principle => {
    const principleItems = filteredItems.filter(item => {
      const prefix = item.standardControl.controlId.split(".")[0]
      return principle.prefixes.includes(prefix)
    })
    return { principle, items: principleItems }
  }).filter(g => g.items.length > 0)
  
  if (!socFramework && !frameworksLoading) {
    return (
      <PageShell
        title="Statement of Applicability"
        description="SOC 2 SoA"
      >
        <Card className="py-12">
          <CardContent className="flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">SOC 2 not configured</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Add SOC 2 as a framework first to manage the Statement of Applicability.
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
      title="Statement of Applicability"
      description="Review and update criterion applicability for SOC 2 Trust Service Criteria."
      action={
        <Button variant="outline" asChild>
          <Link href="/security/frameworks/soc-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      }
    >
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-5 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{soaData?.summary?.total || allItems.length}</div>
            <p className="text-sm text-muted-foreground">Total Criteria</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{soaData?.summary?.applicable || allItems.filter(i => i.applicability === "applicable").length}</div>
            <p className="text-sm text-muted-foreground">Applicable</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{soaData?.summary?.implemented || allItems.filter(i => i.implementationStatus === "implemented" || i.implementationStatus === "effective").length}</div>
            <p className="text-sm text-muted-foreground">Implemented</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{allItems.filter(i => i.implementationStatus === "partially_implemented").length}</div>
            <p className="text-sm text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-gray-600">{soaData?.summary?.notApplicable || allItems.filter(i => i.applicability === "not_applicable").length}</div>
            <p className="text-sm text-muted-foreground">Not Applicable</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1">
          <Input
            placeholder="Search criteria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterPrinciple} onValueChange={setFilterPrinciple}>
          <SelectTrigger className="w-[200px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Principle" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Principles</SelectItem>
            {trustPrinciples.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterApplicability} onValueChange={setFilterApplicability}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Applicability" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Applicability</SelectItem>
            <SelectItem value="applicable">Applicable</SelectItem>
            <SelectItem value="not_applicable">Not Applicable</SelectItem>
            <SelectItem value="partially_applicable">Partial</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterImplementation} onValueChange={setFilterImplementation}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Implementation" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="effective">Effective</SelectItem>
            <SelectItem value="implemented">Implemented</SelectItem>
            <SelectItem value="partially_implemented">Partial</SelectItem>
            <SelectItem value="not_implemented">Not Implemented</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Criteria by Principle */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByPrinciple.map(({ principle, items }) => (
            <PrincipleSection
              key={principle.id}
              principle={principle}
              items={items}
              onEditItem={handleEditItem}
              defaultOpen={groupedByPrinciple.length <= 2}
            />
          ))}
          {groupedByPrinciple.length === 0 && (
            <Card className="py-12">
              <CardContent className="flex flex-col items-center text-center">
                <p className="text-muted-foreground">No criteria match the current filters.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
      
      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-mono">{editItem?.standardControl.controlId}</DialogTitle>
            <DialogDescription>{editItem?.standardControl.title}</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="text-sm text-muted-foreground">
              {editItem?.standardControl.description}
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Applicability</label>
              <Select value={editApplicability} onValueChange={setEditApplicability}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="applicable">Applicable</SelectItem>
                  <SelectItem value="not_applicable">Not Applicable</SelectItem>
                  <SelectItem value="partially_applicable">Partially Applicable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {editApplicability === "not_applicable" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Justification (Required)</label>
                <Textarea
                  placeholder="Explain why this criterion is not applicable..."
                  value={editJustification}
                  onChange={(e) => setEditJustification(e.target.value)}
                />
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Implementation Status</label>
              <Select value={editImplementation} onValueChange={setEditImplementation}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_implemented">Not Implemented</SelectItem>
                  <SelectItem value="partially_implemented">Partially Implemented</SelectItem>
                  <SelectItem value="implemented">Implemented</SelectItem>
                  <SelectItem value="effective">Effective</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                placeholder="Additional notes..."
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={updateSoaItem.isPending || (editApplicability === "not_applicable" && !editJustification)}
            >
              {updateSoaItem.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}

