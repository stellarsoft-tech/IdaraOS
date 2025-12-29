"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronDown, ChevronRight, CheckCircle, XCircle, AlertCircle, Shield, ArrowLeft, Filter } from "lucide-react"

import { PageShell } from "@/components/primitives/page-shell"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
          <span className="font-medium">{item.standardControl.controlId}</span>
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

function CategorySection({ 
  category, 
  items, 
  onEditItem,
  defaultOpen = true 
}: { 
  category: string
  items: (SoaItem & { orgControl?: { controlId: string; title: string } | null })[]
  onEditItem: (item: SoaItem) => void
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  
  const implementedCount = items.filter(i => 
    i.implementationStatus === "implemented" || i.implementationStatus === "effective"
  ).length
  const applicableCount = items.filter(i => i.applicability === "applicable").length
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <CardTitle className="text-base text-left">{category} Controls</CardTitle>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">
                  {implementedCount}/{applicableCount} implemented
                </span>
                <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-green-500"
                    style={{ width: `${applicableCount > 0 ? (implementedCount / applicableCount) * 100 : 0}%` }}
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

export default function ISO27001SoAPage() {
  const { data: frameworksData, isLoading: frameworksLoading } = useSecurityFrameworks()
  const [frameworkId, setFrameworkId] = useState<string | undefined>()
  const [editItem, setEditItem] = useState<SoaItem | null>(null)
  const [editApplicability, setEditApplicability] = useState<string>("")
  const [editImplementation, setEditImplementation] = useState<string>("")
  const [editJustification, setEditJustification] = useState<string>("")
  const [editNotes, setEditNotes] = useState<string>("")
  const [search, setSearch] = useState("")
  const [filterApplicability, setFilterApplicability] = useState<string>("all")
  const [filterImplementation, setFilterImplementation] = useState<string>("all")
  
  const updateSoaItem = useUpdateSoaItem()
  
  // Find ISO 27001 framework
  const isoFramework = frameworksData?.data?.find(f => f.code === "iso-27001")
  
  useEffect(() => {
    if (isoFramework) {
      setFrameworkId(isoFramework.id)
    }
  }, [isoFramework])
  
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
      toast.success("Control updated successfully")
      setEditItem(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update control")
    }
  }
  
  // Filter and group items
  const allItems = soaData?.data || []
  
  const filteredItems = allItems.filter(item => {
    if (search) {
      const searchLower = search.toLowerCase()
      if (!item.standardControl.controlId.toLowerCase().includes(searchLower) &&
          !item.standardControl.title.toLowerCase().includes(searchLower)) {
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
  
  const groupedItems = filteredItems.reduce((acc, item) => {
    const category = item.standardControl.category
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(item)
    return acc
  }, {} as Record<string, typeof filteredItems>)
  
  const categories = Object.keys(groupedItems).sort()
  
  if (!isoFramework && !frameworksLoading) {
    return (
      <PageShell
        title="Statement of Applicability"
        description="ISO 27001 SoA"
      >
        <Card className="py-12">
          <CardContent className="flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">ISO 27001 not configured</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Add ISO 27001 as a framework first to manage the Statement of Applicability.
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
      description="Review and update control applicability for ISO 27001:2022 Annex A controls."
      action={
        <Button variant="outline" asChild>
          <Link href="/security/frameworks/iso-27001">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      }
    >
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{soaData?.summary?.total || 0}</div>
            <p className="text-sm text-muted-foreground">Total Controls</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{soaData?.summary?.applicable || 0}</div>
            <p className="text-sm text-muted-foreground">Applicable</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{soaData?.summary?.implemented || 0}</div>
            <p className="text-sm text-muted-foreground">Implemented</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-gray-600">{soaData?.summary?.notApplicable || 0}</div>
            <p className="text-sm text-muted-foreground">Not Applicable</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1">
          <Input
            placeholder="Search controls..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
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
      
      {/* Controls by Category */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {categories.map(category => (
            <CategorySection
              key={category}
              category={category}
              items={groupedItems[category]}
              onEditItem={handleEditItem}
              defaultOpen={categories.length <= 2}
            />
          ))}
        </div>
      )}
      
      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem?.standardControl.controlId}</DialogTitle>
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
                  placeholder="Explain why this control is not applicable..."
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

