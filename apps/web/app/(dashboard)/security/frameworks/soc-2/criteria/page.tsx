"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { 
  ArrowLeft, 
  ChevronDown, 
  ChevronRight, 
  Shield, 
  Lock,
  CheckCircle,
  Server,
  FileCheck,
  Eye,
  Search,
  ExternalLink,
  AlertCircle,
  XCircle,
  Plus,
  Link2,
  Loader2,
} from "lucide-react"

import { PageShell } from "@/components/primitives/page-shell"
import { Protected } from "@/components/primitives/protected"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { 
  useSecurityFrameworks, 
  useSoaItems, 
  useSecurityControls,
  useCreateControlsFromStandard,
  type SoaItem 
} from "@/lib/api/security"
import { toast } from "sonner"

// SOC 2 Trust Service Criteria (AICPA TSC 2017)
const trustServicePrinciples = [
  { 
    id: "Security",
    name: "Security (Common Criteria)", 
    description: "The system is protected against unauthorized access, use, or modification",
    icon: Shield,
    color: "text-blue-600",
    bgColor: "bg-blue-500/10",
    categories: [
      { id: "CC1", name: "Control Environment", fullName: "CC1 - Control Environment" },
      { id: "CC2", name: "Communication & Information", fullName: "CC2 - Communication and Information" },
      { id: "CC3", name: "Risk Assessment", fullName: "CC3 - Risk Assessment" },
      { id: "CC4", name: "Monitoring Activities", fullName: "CC4 - Monitoring Activities" },
      { id: "CC5", name: "Control Activities", fullName: "CC5 - Control Activities" },
      { id: "CC6", name: "Logical & Physical Access", fullName: "CC6 - Logical and Physical Access Controls" },
      { id: "CC7", name: "System Operations", fullName: "CC7 - System Operations" },
      { id: "CC8", name: "Change Management", fullName: "CC8 - Change Management" },
      { id: "CC9", name: "Risk Mitigation", fullName: "CC9 - Risk Mitigation" },
    ]
  },
  { 
    id: "Availability",
    name: "Availability", 
    description: "The system is available for operation and use as committed or agreed",
    icon: Server,
    color: "text-green-600",
    bgColor: "bg-green-500/10",
    categories: [
      { id: "A1", name: "Availability", fullName: "A1 - Availability" },
    ]
  },
  { 
    id: "Processing Integrity",
    name: "Processing Integrity", 
    description: "System processing is complete, valid, accurate, timely, and authorized",
    icon: FileCheck,
    color: "text-purple-600",
    bgColor: "bg-purple-500/10",
    categories: [
      { id: "PI1", name: "Processing Integrity", fullName: "PI1 - Processing Integrity" },
    ]
  },
  { 
    id: "Confidentiality",
    name: "Confidentiality", 
    description: "Information designated as confidential is protected as committed or agreed",
    icon: Lock,
    color: "text-yellow-600",
    bgColor: "bg-yellow-500/10",
    categories: [
      { id: "C1", name: "Confidentiality", fullName: "C1 - Confidentiality" },
    ]
  },
  { 
    id: "Privacy",
    name: "Privacy", 
    description: "Personal information is collected, used, retained, disclosed, and disposed of in conformity with commitments",
    icon: Eye,
    color: "text-pink-600",
    bgColor: "bg-pink-500/10",
    categories: [
      { id: "P1", name: "Notice", fullName: "P1 - Notice" },
      { id: "P2", name: "Choice & Consent", fullName: "P2 - Choice and Consent" },
      { id: "P3", name: "Collection", fullName: "P3 - Collection" },
      { id: "P4", name: "Use, Retention & Disposal", fullName: "P4 - Use, Retention, and Disposal" },
      { id: "P5", name: "Access", fullName: "P5 - Access" },
      { id: "P6", name: "Disclosure & Notification", fullName: "P6 - Disclosure and Notification" },
      { id: "P7", name: "Quality", fullName: "P7 - Quality" },
      { id: "P8", name: "Monitoring & Enforcement", fullName: "P8 - Monitoring and Enforcement" },
    ]
  },
]

// Map category prefixes to principles
const categoryToPrinciple: Record<string, string> = {
  "CC1": "Security",
  "CC2": "Security",
  "CC3": "Security",
  "CC4": "Security",
  "CC5": "Security",
  "CC6": "Security",
  "CC7": "Security",
  "CC8": "Security",
  "CC9": "Security",
  "A1": "Availability",
  "PI1": "Processing Integrity",
  "C1": "Confidentiality",
  "P1": "Privacy",
  "P2": "Privacy",
  "P3": "Privacy",
  "P4": "Privacy",
  "P5": "Privacy",
  "P6": "Privacy",
  "P7": "Privacy",
  "P8": "Privacy",
}

// Implementation status icons
const statusConfig = {
  not_implemented: { icon: XCircle, label: "Not Implemented", color: "text-gray-400" },
  partially_implemented: { icon: AlertCircle, label: "Partial", color: "text-yellow-500" },
  implemented: { icon: CheckCircle, label: "Implemented", color: "text-blue-500" },
  effective: { icon: CheckCircle, label: "Effective", color: "text-green-500" },
}

interface CriterionRowProps {
  item: SoaItem
  onCreateControl: (standardControlId: string) => void
  isCreating: boolean
  hasMapping: boolean
}

function CriterionRow({ item, onCreateControl, isCreating, hasMapping }: CriterionRowProps) {
  const status = statusConfig[item.implementationStatus as keyof typeof statusConfig] || statusConfig.not_implemented
  const StatusIcon = status.icon
  
  return (
    <div className="flex items-start gap-4 px-6 py-4 hover:bg-muted/50 transition-colors">
      <StatusIcon className={`h-5 w-5 mt-0.5 ${status.color}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-sm font-semibold text-primary">
            {item.standardControl.controlId}
          </span>
          <Badge variant="outline" className="text-xs">
            {status.label}
          </Badge>
          {hasMapping && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="secondary" className="text-xs">
                    <Link2 className="h-3 w-3 mr-1" />
                    Mapped
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>An org control is mapped to this criterion</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <p className="font-medium">{item.standardControl.title}</p>
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
          {item.standardControl.description}
        </p>
      </div>
      {!hasMapping && (
        <Protected module="security.controls" action="create">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation()
                    onCreateControl(item.standardControlId)
                  }}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Create org control from this criterion</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </Protected>
      )}
    </div>
  )
}

interface CategorySectionProps {
  category: { id: string; name: string; fullName: string }
  items: SoaItem[]
  defaultOpen?: boolean
  onCreateControl: (standardControlId: string) => void
  isCreating: boolean
  mappedStandardIds: Set<string>
}

function CategorySection({ 
  category, 
  items, 
  defaultOpen = false,
  onCreateControl,
  isCreating,
  mappedStandardIds,
}: CategorySectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  
  const implementedCount = items.filter(i => 
    i.implementationStatus === "implemented" || i.implementationStatus === "effective"
  ).length
  const applicableCount = items.filter(i => i.applicability === "applicable").length
  const progress = applicableCount > 0 ? Math.round((implementedCount / applicableCount) * 100) : 0
  const mappedCount = items.filter(i => mappedStandardIds.has(i.standardControlId)).length
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <div className="text-left">
                  <CardTitle className="text-base">{category.fullName}</CardTitle>
                  <CardDescription className="text-xs">
                    {items.length} criteria • {mappedCount} mapped
                  </CardDescription>
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
                <CriterionRow 
                  key={item.id} 
                  item={item}
                  onCreateControl={onCreateControl}
                  isCreating={isCreating}
                  hasMapping={mappedStandardIds.has(item.standardControlId)}
                />
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

interface PrincipleViewProps {
  principle: typeof trustServicePrinciples[0]
  items: SoaItem[]
  search: string
  onCreateControl: (standardControlId: string) => void
  onCreateAllControls: (standardControlIds: string[]) => void
  isCreating: boolean
  mappedStandardIds: Set<string>
}

function PrincipleView({ 
  principle, 
  items, 
  search,
  onCreateControl,
  onCreateAllControls,
  isCreating,
  mappedStandardIds,
}: PrincipleViewProps) {
  const Icon = principle.icon
  
  // Filter items that belong to this principle
  const principleItems = items.filter(item => {
    const prefix = item.standardControl.controlId.split(".")[0]
    return categoryToPrinciple[prefix] === principle.id
  })
  
  // Group by category
  const getItemsByCategory = (categoryId: string) => {
    return principleItems.filter(item => {
      const prefix = item.standardControl.controlId.split(".")[0]
      return prefix === categoryId
    })
  }
  
  const implementedCount = principleItems.filter(i => 
    i.implementationStatus === "implemented" || i.implementationStatus === "effective"
  ).length
  const applicableCount = principleItems.filter(i => i.applicability === "applicable").length
  const progress = applicableCount > 0 ? Math.round((implementedCount / applicableCount) * 100) : 0
  
  // Get unmapped criteria
  const unmappedIds = principleItems
    .filter(i => !mappedStandardIds.has(i.standardControlId))
    .map(i => i.standardControlId)
  
  return (
    <div className="space-y-4">
      {/* Principle Header */}
      <Card className={`${principle.bgColor} border-0`}>
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <div className={`h-12 w-12 rounded-lg bg-white/80 dark:bg-white/10 flex items-center justify-center`}>
              <Icon className={`h-6 w-6 ${principle.color}`} />
            </div>
            <div className="flex-1">
              <h3 className={`font-semibold ${principle.color}`}>{principle.name}</h3>
              <p className="text-sm text-muted-foreground">{principle.description}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-2xl font-bold">{progress}%</p>
                <p className="text-sm text-muted-foreground">{implementedCount}/{applicableCount} met</p>
              </div>
              {unmappedIds.length > 0 && (
                <Protected module="security.controls" action="create">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onCreateAllControls(unmappedIds)}
                    disabled={isCreating}
                  >
                    {isCreating ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Create All ({unmappedIds.length})
                  </Button>
                </Protected>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Categories */}
      <div className="space-y-3">
        {principle.categories.map((category, index) => {
          const categoryItems = getItemsByCategory(category.id)
          if (search && categoryItems.length === 0) return null
          return (
            <CategorySection
              key={category.id}
              category={category}
              items={categoryItems}
              defaultOpen={index === 0 || !!search}
              onCreateControl={onCreateControl}
              isCreating={isCreating}
              mappedStandardIds={mappedStandardIds}
            />
          )
        })}
      </div>
    </div>
  )
}

export default function SOC2CriteriaPage() {
  const { data: frameworksData, isLoading: frameworksLoading } = useSecurityFrameworks()
  const { data: controlsData } = useSecurityControls({})
  const createFromStandard = useCreateControlsFromStandard()
  
  const [frameworkId, setFrameworkId] = useState<string | undefined>()
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState("all")
  
  // Find SOC 2 framework
  const soc2Framework = frameworksData?.data?.find(f => f.code === "soc-2")
  
  useEffect(() => {
    if (soc2Framework) {
      setFrameworkId(soc2Framework.id)
    }
  }, [soc2Framework])
  
  const { data: soaData, isLoading: soaLoading } = useSoaItems(frameworkId)
  
  const isLoading = frameworksLoading || soaLoading
  
  // Get all items and filter by search
  const allItems = soaData?.data || []
  
  // Get mapped standard control IDs from org controls
  const mappedStandardIds = new Set<string>()
  controlsData?.data?.forEach(control => {
    if (control.mappings) {
      control.mappings.forEach(mapping => {
        mappedStandardIds.add(mapping.standardControlId)
      })
    }
  })
  
  // Also check SoA items that have controlId set
  allItems.forEach(item => {
    if (item.controlId) {
      mappedStandardIds.add(item.standardControlId)
    }
  })
  
  const filteredItems = search
    ? allItems.filter(item => {
        const searchLower = search.toLowerCase()
        return (
          item.standardControl.controlId.toLowerCase().includes(searchLower) ||
          item.standardControl.title.toLowerCase().includes(searchLower) ||
          item.standardControl.description?.toLowerCase().includes(searchLower)
        )
      })
    : allItems
  
  const handleCreateControl = async (standardControlId: string) => {
    try {
      const result = await createFromStandard.mutateAsync({
        standardControlIds: [standardControlId],
        frameworkId: frameworkId,
      })
      if (result.created.length > 0) {
        toast.success(`Created control ${result.created[0].controlId}`)
      } else if (result.skipped.length > 0) {
        toast.info("Control already exists for this criterion")
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to create control"
      toast.error(message)
    }
  }
  
  const handleCreateAllControls = async (standardControlIds: string[]) => {
    try {
      const result = await createFromStandard.mutateAsync({
        standardControlIds,
        frameworkId: frameworkId,
      })
      toast.success(`Created ${result.created.length} control(s), ${result.skipped.length} skipped`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to create controls"
      toast.error(message)
    }
  }
  
  // Get all unmapped standard control IDs
  const allUnmappedIds = allItems
    .filter(i => !mappedStandardIds.has(i.standardControlId))
    .map(i => i.standardControlId)
  
  if (!soc2Framework && !frameworksLoading) {
    return (
      <PageShell
        title="SOC 2 Trust Service Criteria"
        description="AICPA TSC 2017"
      >
        <Card className="py-12">
          <CardContent className="flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">SOC 2 not configured</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Add SOC 2 as a framework first to browse Trust Service Criteria.
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
      title="SOC 2 Trust Service Criteria"
      description="AICPA Trust Service Criteria (TSC 2017) organized by principle."
      action={
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/security/frameworks/soc-2">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
          {allUnmappedIds.length > 0 && (
            <Protected module="security.controls" action="create">
              <Button 
                onClick={() => handleCreateAllControls(allUnmappedIds)}
                disabled={createFromStandard.isPending}
              >
                {createFromStandard.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Create All Controls ({allUnmappedIds.length})
              </Button>
            </Protected>
          )}
        </div>
      }
    >
      {/* Info Banner */}
      <Card className="mb-6 bg-primary/5 border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-start gap-4">
            <Shield className="h-5 w-5 text-primary mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium">AICPA Trust Service Criteria (TSC 2017)</h4>
              <p className="text-sm text-muted-foreground mt-1">
                SOC 2 is based on five Trust Service Principles. Click &quot;Create&quot; on any 
                criterion to add it to your Controls Library. You can also create all unmapped controls at once.
              </p>
              <div className="flex items-center gap-4 mt-2">
                <a 
                  href="https://www.aicpa.org/resources/landing/system-and-organization-controls-soc-suite-of-services" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  AICPA SOC Resources
                  <ExternalLink className="h-3 w-3" />
                </a>
                <span className="text-sm text-muted-foreground">
                  {mappedStandardIds.size} of {allItems.length} mapped to org controls
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-5 mb-6">
        {trustServicePrinciples.map(principle => {
          const principleItems = filteredItems.filter(item => {
            const prefix = item.standardControl.controlId.split(".")[0]
            return categoryToPrinciple[prefix] === principle.id
          })
          const met = principleItems.filter(i => 
            i.implementationStatus === "implemented" || i.implementationStatus === "effective"
          ).length
          const applicable = principleItems.filter(i => i.applicability === "applicable").length
          const mapped = principleItems.filter(i => mappedStandardIds.has(i.standardControlId)).length
          const Icon = principle.icon
          
          return (
            <Card key={principle.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setActiveTab(principle.id)}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`h-8 w-8 rounded-lg ${principle.bgColor} flex items-center justify-center`}>
                    <Icon className={`h-4 w-4 ${principle.color}`} />
                  </div>
                </div>
                <p className="text-sm font-medium truncate">{principle.name.replace(" (Common Criteria)", "")}</p>
                <p className="text-xs text-muted-foreground">{met}/{applicable} implemented</p>
                <p className="text-xs text-muted-foreground">{mapped}/{principleItems.length} mapped</p>
              </CardContent>
            </Card>
          )
        })}
      </div>
      
      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search criteria by ID, title, or description..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {search && (
          <p className="text-sm text-muted-foreground mt-2">
            Found {filteredItems.length} criteria matching &quot;{search}&quot;
          </p>
        )}
      </div>
      
      {/* Tabs for Principles */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start flex-wrap h-auto gap-1 mb-6">
            <TabsTrigger value="all" className="text-xs">All Principles</TabsTrigger>
            {trustServicePrinciples.map(p => (
              <TabsTrigger key={p.id} value={p.id} className="text-xs">
                {p.name.replace(" (Common Criteria)", "")}
              </TabsTrigger>
            ))}
          </TabsList>
          
          <TabsContent value="all" className="space-y-8">
            {trustServicePrinciples.map(principle => (
              <PrincipleView 
                key={principle.id} 
                principle={principle} 
                items={filteredItems}
                search={search}
                onCreateControl={handleCreateControl}
                onCreateAllControls={handleCreateAllControls}
                isCreating={createFromStandard.isPending}
                mappedStandardIds={mappedStandardIds}
              />
            ))}
          </TabsContent>
          
          {trustServicePrinciples.map(principle => (
            <TabsContent key={principle.id} value={principle.id}>
              <PrincipleView 
                principle={principle} 
                items={filteredItems}
                search={search}
                onCreateControl={handleCreateControl}
                onCreateAllControls={handleCreateAllControls}
                isCreating={createFromStandard.isPending}
                mappedStandardIds={mappedStandardIds}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </PageShell>
  )
}
