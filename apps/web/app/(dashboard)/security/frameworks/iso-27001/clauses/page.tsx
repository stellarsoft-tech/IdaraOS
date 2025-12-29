"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { 
  ChevronDown, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Shield, 
  ArrowLeft, 
  Filter,
  FileText,
  Building2,
  Users,
  Target,
  Settings,
  TrendingUp,
  BookOpen,
  ExternalLink,
  User,
  Calendar,
  Search,
} from "lucide-react"

import { PageShell } from "@/components/primitives/page-shell"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { 
  useSecurityFrameworks, 
  useClauseCompliance, 
  useUpdateClauseCompliance,
  type StandardClause,
  type ClauseComplianceWithClause,
} from "@/lib/api/security"
import { toast } from "sonner"

// Clause categories with icons
const clauseCategories = [
  { id: "Context", name: "Context of the Organization", clauseNum: "4", icon: Building2, color: "text-blue-600", bgColor: "bg-blue-500/10" },
  { id: "Leadership", name: "Leadership", clauseNum: "5", icon: Users, color: "text-purple-600", bgColor: "bg-purple-500/10" },
  { id: "Planning", name: "Planning", clauseNum: "6", icon: Target, color: "text-green-600", bgColor: "bg-green-500/10" },
  { id: "Support", name: "Support", clauseNum: "7", icon: FileText, color: "text-orange-600", bgColor: "bg-orange-500/10" },
  { id: "Operation", name: "Operation", clauseNum: "8", icon: Settings, color: "text-indigo-600", bgColor: "bg-indigo-500/10" },
  { id: "Performance Evaluation", name: "Performance Evaluation", clauseNum: "9", icon: TrendingUp, color: "text-pink-600", bgColor: "bg-pink-500/10" },
  { id: "Improvement", name: "Improvement", clauseNum: "10", icon: BookOpen, color: "text-cyan-600", bgColor: "bg-cyan-500/10" },
]

// Compliance status configuration
const complianceStatusConfig: Record<string, { icon: typeof CheckCircle2; color: string; label: string; bgColor: string }> = {
  not_addressed: { icon: XCircle, color: "text-gray-400", label: "Not Addressed", bgColor: "bg-gray-100" },
  partially_addressed: { icon: AlertCircle, color: "text-yellow-500", label: "Partially Addressed", bgColor: "bg-yellow-50" },
  fully_addressed: { icon: CheckCircle2, color: "text-blue-500", label: "Fully Addressed", bgColor: "bg-blue-50" },
  verified: { icon: CheckCircle2, color: "text-green-500", label: "Verified", bgColor: "bg-green-50" },
}

function ClauseRow({ 
  item, 
  onEdit,
  depth = 0,
}: { 
  item: ClauseComplianceWithClause
  onEdit: (item: ClauseComplianceWithClause) => void
  depth?: number
}) {
  const status = item.compliance?.complianceStatus || "not_addressed"
  const { icon: Icon, color, label } = complianceStatusConfig[status] || complianceStatusConfig.not_addressed
  const isMainClause = !item.standardClause.parentClauseId
  
  return (
    <div 
      className={`flex items-start gap-4 px-6 py-4 hover:bg-muted/50 cursor-pointer transition-colors border-b last:border-b-0 ${depth > 0 ? "pl-12" : ""}`}
      onClick={() => onEdit(item)}
    >
      <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${color}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-mono text-sm font-semibold text-primary">
            {item.standardClause.clauseId}
          </span>
          <Badge 
            variant="outline" 
            className={`text-xs ${status === "verified" ? "border-green-500 text-green-700" : status === "fully_addressed" ? "border-blue-500 text-blue-700" : status === "partially_addressed" ? "border-yellow-500 text-yellow-700" : "border-gray-300 text-gray-500"}`}
          >
            {label}
          </Badge>
        </div>
        <p className={`text-sm ${isMainClause ? "font-semibold" : "font-medium"}`}>
          {item.standardClause.title}
        </p>
        {item.standardClause.description && !isMainClause && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
            {item.standardClause.description}
          </p>
        )}
        {item.ownerName && (
          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            <span>{item.ownerName}</span>
          </div>
        )}
        {item.compliance?.targetDate && (
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>Target: {new Date(item.compliance.targetDate).toLocaleDateString()}</span>
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
  defaultOpen = false,
}: { 
  category: typeof clauseCategories[0]
  items: ClauseComplianceWithClause[]
  onEditItem: (item: ClauseComplianceWithClause) => void
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const Icon = category.icon
  
  // Calculate progress
  const addressedCount = items.filter(i => 
    i.compliance?.complianceStatus === "fully_addressed" || 
    i.compliance?.complianceStatus === "verified"
  ).length
  const progress = items.length > 0 ? Math.round((addressedCount / items.length) * 100) : 0
  
  // Group items by parent clause for hierarchy
  const mainClauses = items.filter(i => i.standardClause.clauseId === category.clauseNum)
  const subClauses = items.filter(i => 
    i.standardClause.clauseId !== category.clauseNum &&
    !i.standardClause.parentClauseId?.includes(".")
  )
  const subSubClauses = items.filter(i => 
    i.standardClause.parentClauseId?.includes(".")
  )
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`h-12 w-12 rounded-lg ${category.bgColor} flex items-center justify-center`}>
                  <Icon className={`h-6 w-6 ${category.color}`} />
                </div>
                <div className="flex-1 text-left">
                  <CardTitle className="text-base flex items-center gap-2">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    Clause {category.clauseNum}: {category.name}
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    {items.length} requirements
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-2xl font-bold">{progress}%</span>
                  <p className="text-xs text-muted-foreground">{addressedCount}/{items.length} addressed</p>
                </div>
                <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${progress >= 80 ? "bg-green-500" : progress >= 50 ? "bg-blue-500" : progress >= 25 ? "bg-yellow-500" : "bg-gray-300"}`}
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
              {items
                .sort((a, b) => (a.standardClause.sortOrder || 0) - (b.standardClause.sortOrder || 0))
                .map(item => {
                  const depth = item.standardClause.clauseId.split(".").length - 1
                  return (
                    <ClauseRow 
                      key={item.standardClause.id} 
                      item={item} 
                      onEdit={onEditItem}
                      depth={depth > 1 ? 1 : 0}
                    />
                  )
                })}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

export default function ISMSClausesPage() {
  const { data: frameworksData, isLoading: frameworksLoading } = useSecurityFrameworks()
  const [frameworkId, setFrameworkId] = useState<string | undefined>()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [activeTab, setActiveTab] = useState("all")
  const [editingItem, setEditingItem] = useState<ClauseComplianceWithClause | null>(null)
  const [editForm, setEditForm] = useState<{
    complianceStatus: "not_addressed" | "partially_addressed" | "fully_addressed" | "verified"
    implementationNotes: string
    evidenceDescription: string
    targetDate: string
  }>({
    complianceStatus: "not_addressed",
    implementationNotes: "",
    evidenceDescription: "",
    targetDate: "",
  })
  
  // Find ISO 27001 framework
  const isoFramework = frameworksData?.data?.find(f => f.code === "iso-27001")
  
  useEffect(() => {
    if (isoFramework) {
      setFrameworkId(isoFramework.id)
    }
  }, [isoFramework])
  
  const { data: complianceData, isLoading: complianceLoading } = useClauseCompliance(frameworkId)
  const updateCompliance = useUpdateClauseCompliance()
  
  const isLoading = frameworksLoading || complianceLoading
  
  // Filter items
  const allItems = complianceData?.data || []
  const filteredItems = allItems.filter(item => {
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase()
      const matchesSearch = 
        item.standardClause.clauseId.toLowerCase().includes(searchLower) ||
        item.standardClause.title.toLowerCase().includes(searchLower) ||
        item.standardClause.description?.toLowerCase().includes(searchLower)
      if (!matchesSearch) return false
    }
    // Status filter
    if (statusFilter !== "all") {
      const status = item.compliance?.complianceStatus || "not_addressed"
      if (status !== statusFilter) return false
    }
    return true
  })
  
  // Group by category
  const getItemsByCategory = (categoryId: string) => {
    return filteredItems.filter(item => item.standardClause.category === categoryId)
  }
  
  // Handle edit dialog
  const openEditDialog = (item: ClauseComplianceWithClause) => {
    setEditingItem(item)
    setEditForm({
      complianceStatus: item.compliance?.complianceStatus || "not_addressed",
      implementationNotes: item.compliance?.implementationNotes || "",
      evidenceDescription: item.compliance?.evidenceDescription || "",
      targetDate: item.compliance?.targetDate || "",
    })
  }
  
  const handleSave = async () => {
    if (!editingItem || !frameworkId) return
    
    try {
      await updateCompliance.mutateAsync({
        id: editingItem.compliance?.id,
        frameworkId,
        standardClauseId: editingItem.standardClause.id,
        complianceStatus: editForm.complianceStatus,
        implementationNotes: editForm.implementationNotes || null,
        evidenceDescription: editForm.evidenceDescription || null,
        targetDate: editForm.targetDate || null,
      })
      toast.success("Clause compliance updated")
      setEditingItem(null)
    } catch (error) {
      toast.error("Failed to update clause compliance")
    }
  }
  
  if (!isoFramework && !frameworksLoading) {
    return (
      <PageShell
        title="ISMS Clauses"
        description="ISO 27001:2022 Management System Requirements"
      >
        <Card className="py-12">
          <CardContent className="flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">ISO 27001 not configured</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Add ISO 27001 as a framework first to track ISMS clause compliance.
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
      title="ISMS Clauses (4-10)"
      description="Track compliance with mandatory ISO 27001:2022 management system requirements."
      action={
        <Button variant="outline" asChild>
          <Link href="/security/frameworks/iso-27001">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      }
    >
      {/* Info Banner */}
      <Card className="mb-6 bg-primary/5 border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-start gap-4">
            <Shield className="h-5 w-5 text-primary mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium">ISO/IEC 27001:2022 ISMS Requirements</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Clauses 4-10 define the mandatory requirements for establishing, implementing, maintaining, and 
                continually improving an Information Security Management System (ISMS). Unlike Annex A controls which are 
                selectable based on risk assessment, these clauses are mandatory for certification.
              </p>
              <div className="flex items-center gap-4 mt-2">
                <a
                  href="https://www.iso.org/standard/27001"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  Official ISO 27001
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Summary Stats */}
      {complianceData?.summary && (
        <div className="grid gap-4 md:grid-cols-5 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{complianceData.summary.total}</div>
              <p className="text-xs text-muted-foreground">Total Requirements</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-gray-500">{complianceData.summary.notAddressed}</div>
              <p className="text-xs text-muted-foreground">Not Addressed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-yellow-500">{complianceData.summary.partiallyAddressed}</div>
              <p className="text-xs text-muted-foreground">Partially Addressed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-500">{complianceData.summary.fullyAddressed}</div>
              <p className="text-xs text-muted-foreground">Fully Addressed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-500">{complianceData.summary.verified}</div>
              <p className="text-xs text-muted-foreground">Verified</p>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by clause ID, title, or description..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="not_addressed">Not Addressed</SelectItem>
            <SelectItem value="partially_addressed">Partially Addressed</SelectItem>
            <SelectItem value="fully_addressed">Fully Addressed</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {search && (
        <p className="text-sm text-muted-foreground mb-4">
          Found {filteredItems.length} clause{filteredItems.length !== 1 ? "s" : ""} matching &quot;{search}&quot;
        </p>
      )}
      
      {/* Category Tabs */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start flex-wrap h-auto gap-1 mb-6">
            <TabsTrigger value="all" className="text-xs">All Clauses</TabsTrigger>
            {clauseCategories.map(c => (
              <TabsTrigger key={c.id} value={c.id} className="text-xs">
                {c.clauseNum}. {c.name}
              </TabsTrigger>
            ))}
          </TabsList>
          
          <TabsContent value="all" className="space-y-6">
            {clauseCategories.map(category => (
              <CategorySection
                key={category.id}
                category={category}
                items={getItemsByCategory(category.id)}
                onEditItem={openEditDialog}
                defaultOpen={!!search}
              />
            ))}
          </TabsContent>
          
          {clauseCategories.map(category => (
            <TabsContent key={category.id} value={category.id}>
              <CategorySection
                category={category}
                items={getItemsByCategory(category.id)}
                onEditItem={openEditDialog}
                defaultOpen={true}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}
      
      {/* Edit Dialog */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="font-mono text-primary">{editingItem?.standardClause.clauseId}</span>
              {editingItem?.standardClause.title}
            </DialogTitle>
            <DialogDescription>
              {editingItem?.standardClause.description}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Guidance */}
            {editingItem?.standardClause.guidance && (
              <div className="p-3 bg-muted rounded-lg">
                <h4 className="text-sm font-medium mb-1">Implementation Guidance</h4>
                <p className="text-sm text-muted-foreground">{editingItem.standardClause.guidance}</p>
              </div>
            )}
            
            {/* Evidence Examples */}
            {editingItem?.standardClause.evidenceExamples && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <h4 className="text-sm font-medium mb-1 text-blue-700 dark:text-blue-400">Expected Evidence</h4>
                <p className="text-sm text-blue-600 dark:text-blue-300">{editingItem.standardClause.evidenceExamples}</p>
              </div>
            )}
            
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Compliance Status</Label>
                <Select
                  value={editForm.complianceStatus}
                  onValueChange={(value) => setEditForm({ ...editForm, complianceStatus: value as typeof editForm.complianceStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_addressed">Not Addressed</SelectItem>
                    <SelectItem value="partially_addressed">Partially Addressed</SelectItem>
                    <SelectItem value="fully_addressed">Fully Addressed</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Target Date</Label>
                <Input
                  type="date"
                  value={editForm.targetDate}
                  onChange={(e) => setEditForm({ ...editForm, targetDate: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Implementation Notes</Label>
                <Textarea
                  placeholder="Describe how this requirement has been implemented..."
                  value={editForm.implementationNotes}
                  onChange={(e) => setEditForm({ ...editForm, implementationNotes: e.target.value })}
                  rows={3}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Evidence Description</Label>
                <Textarea
                  placeholder="Describe the evidence that demonstrates compliance..."
                  value={editForm.evidenceDescription}
                  onChange={(e) => setEditForm({ ...editForm, evidenceDescription: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={updateCompliance.isPending}>
              {updateCompliance.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}

