"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { 
  ArrowLeft, 
  ChevronDown, 
  ChevronRight, 
  Shield, 
  Users, 
  Building2,
  HardDrive,
  Cpu,
  Search,
  ExternalLink,
  CheckCircle,
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

// ISO 27001:2022 Annex A Categories with theme colors
const annexACategories = [
  { 
    id: "Organizational", 
    name: "Organizational Controls", 
    prefix: "A.5", 
    description: "Information security policies, roles, and responsibilities",
    icon: Building2,
    color: "text-blue-600",
    bgColor: "bg-blue-500/10",
    controlRange: "A.5.1 - A.5.37",
    controlCount: 37
  },
  { 
    id: "People", 
    name: "People Controls", 
    prefix: "A.6", 
    description: "Human resource security and awareness",
    icon: Users,
    color: "text-green-600",
    bgColor: "bg-green-500/10",
    controlRange: "A.6.1 - A.6.8",
    controlCount: 8
  },
  { 
    id: "Physical", 
    name: "Physical Controls", 
    prefix: "A.7", 
    description: "Physical and environmental security",
    icon: HardDrive,
    color: "text-yellow-600",
    bgColor: "bg-yellow-500/10",
    controlRange: "A.7.1 - A.7.14",
    controlCount: 14
  },
  { 
    id: "Technological", 
    name: "Technological Controls", 
    prefix: "A.8", 
    description: "Technology-based security measures",
    icon: Cpu,
    color: "text-purple-600",
    bgColor: "bg-purple-500/10",
    controlRange: "A.8.1 - A.8.34",
    controlCount: 34
  },
]

// Implementation status icons
const statusConfig = {
  not_implemented: { icon: XCircle, label: "Not Implemented", color: "text-gray-400" },
  partially_implemented: { icon: AlertCircle, label: "Partial", color: "text-yellow-500" },
  implemented: { icon: CheckCircle, label: "Implemented", color: "text-blue-500" },
  effective: { icon: CheckCircle, label: "Effective", color: "text-green-500" },
}

interface ControlRowProps {
  item: SoaItem
  onCreateControl: (standardControlId: string) => void
  isCreating: boolean
  hasMapping: boolean
}

function ControlRow({ item, onCreateControl, isCreating, hasMapping }: ControlRowProps) {
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
                  <p>An org control is mapped to this standard control</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <p className="font-medium">{item.standardControl.title}</p>
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
          {item.standardControl.description}
        </p>
        {item.standardControl.guidance && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-1">
            <span className="font-medium">Guidance:</span> {item.standardControl.guidance}
          </p>
        )}
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
                <p>Create org control from this standard</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </Protected>
      )}
    </div>
  )
}

interface ControlSubcategoryProps {
  subcategory: string
  items: SoaItem[]
  defaultOpen?: boolean
  onCreateControl: (standardControlId: string) => void
  isCreating: boolean
  mappedStandardIds: Set<string>
}

function ControlSubcategory({ 
  subcategory, 
  items, 
  defaultOpen = false,
  onCreateControl,
  isCreating,
  mappedStandardIds,
}: ControlSubcategoryProps) {
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
                  <CardTitle className="text-base">{subcategory}</CardTitle>
                  <CardDescription className="text-xs">
                    {items.length} controls • {mappedCount} mapped
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
                <ControlRow 
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

interface CategoryViewProps {
  category: typeof annexACategories[0]
  items: SoaItem[]
  search: string
  onCreateControl: (standardControlId: string) => void
  onCreateAllControls: (standardControlIds: string[]) => void
  isCreating: boolean
  mappedStandardIds: Set<string>
}

function CategoryView({ 
  category, 
  items, 
  search,
  onCreateControl,
  onCreateAllControls,
  isCreating,
  mappedStandardIds,
}: CategoryViewProps) {
  const Icon = category.icon
  
  // Filter items that belong to this category
  const categoryItems = items.filter(item => item.standardControl.category === category.id)
  
  // Group by subcategory if available, otherwise show flat list
  const subcategories = categoryItems.reduce((acc, item) => {
    const sub = item.standardControl.subcategory || "General"
    if (!acc[sub]) {
      acc[sub] = []
    }
    acc[sub].push(item)
    return acc
  }, {} as Record<string, SoaItem[]>)
  
  const subcategoryList = Object.entries(subcategories).sort(([a], [b]) => a.localeCompare(b))
  
  const implementedCount = categoryItems.filter(i => 
    i.implementationStatus === "implemented" || i.implementationStatus === "effective"
  ).length
  const applicableCount = categoryItems.filter(i => i.applicability === "applicable").length
  const progress = applicableCount > 0 ? Math.round((implementedCount / applicableCount) * 100) : 0
  
  // Get unmapped controls
  const unmappedIds = categoryItems
    .filter(i => !mappedStandardIds.has(i.standardControlId))
    .map(i => i.standardControlId)
  
  return (
    <div className="space-y-4">
      {/* Category Header */}
      <Card className={`${category.bgColor} border-0`}>
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-white/80 dark:bg-white/10 flex items-center justify-center">
              <Icon className={`h-6 w-6 ${category.color}`} />
            </div>
            <div className="flex-1">
              <h3 className={`font-semibold ${category.color}`}>{category.name}</h3>
              <p className="text-sm text-muted-foreground">{category.description}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-2xl font-bold">{progress}%</p>
                <p className="text-sm text-muted-foreground">{implementedCount}/{applicableCount} implemented</p>
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
      
      {/* Controls */}
      <div className="space-y-3">
        {subcategoryList.length === 1 && subcategoryList[0][0] === "General" ? (
          // If no subcategories, just show the controls directly in collapsibles
          <ControlSubcategory
            subcategory={`${category.prefix} - ${category.name}`}
            items={categoryItems}
            defaultOpen={true}
            onCreateControl={onCreateControl}
            isCreating={isCreating}
            mappedStandardIds={mappedStandardIds}
          />
        ) : (
          // Show by subcategory
          subcategoryList.map(([subcategory, subItems], index) => {
            if (search && subItems.length === 0) return null
            return (
              <ControlSubcategory
                key={subcategory}
                subcategory={subcategory}
                items={subItems}
                defaultOpen={index === 0 || !!search}
                onCreateControl={onCreateControl}
                isCreating={isCreating}
                mappedStandardIds={mappedStandardIds}
              />
            )
          })
        )}
      </div>
    </div>
  )
}

export default function ISO27001ControlsPage() {
  const { data: frameworksData, isLoading: frameworksLoading } = useSecurityFrameworks()
  const { data: controlsData } = useSecurityControls({})
  const createFromStandard = useCreateControlsFromStandard()
  
  const [frameworkId, setFrameworkId] = useState<string | undefined>()
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState("all")
  
  // Find ISO 27001 framework
  const isoFramework = frameworksData?.data?.find(f => f.code === "iso-27001")
  
  useEffect(() => {
    if (isoFramework) {
      setFrameworkId(isoFramework.id)
    }
  }, [isoFramework])
  
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
        toast.info("Control already exists for this standard")
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
  
  if (!isoFramework && !frameworksLoading) {
    return (
      <PageShell
        title="ISO 27001 Controls"
        description="Annex A Controls Reference"
      >
        <Card className="py-12">
          <CardContent className="flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">ISO 27001 not configured</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Add ISO 27001 as a framework first to browse Annex A controls.
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
      title="ISO 27001:2022 Annex A Controls"
      description="Complete reference of 93 Annex A controls organized by category."
      action={
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/security/frameworks/iso-27001">
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
              <h4 className="font-medium">ISO/IEC 27001:2022 Annex A</h4>
              <p className="text-sm text-muted-foreground mt-1">
                The 2022 version includes 93 controls across 4 categories. Click &quot;Create&quot; on any 
                control to add it to your Controls Library. You can also create all unmapped controls at once.
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
                <span className="text-sm text-muted-foreground">
                  {mappedStandardIds.size} of {allItems.length} mapped to org controls
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Summary Stats - Category Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        {annexACategories.map(category => {
          const categoryItems = filteredItems.filter(item => item.standardControl.category === category.id)
          const met = categoryItems.filter(i => 
            i.implementationStatus === "implemented" || i.implementationStatus === "effective"
          ).length
          const applicable = categoryItems.filter(i => i.applicability === "applicable").length
          const mapped = categoryItems.filter(i => mappedStandardIds.has(i.standardControlId)).length
          const Icon = category.icon
          
          return (
            <Card 
              key={category.id} 
              className="cursor-pointer hover:border-primary/50 transition-colors" 
              onClick={() => setActiveTab(category.id)}
            >
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`h-8 w-8 rounded-lg ${category.bgColor} flex items-center justify-center`}>
                    <Icon className={`h-4 w-4 ${category.color}`} />
                  </div>
                </div>
                <p className="text-sm font-medium">{category.name}</p>
                <p className="text-xs text-muted-foreground">{met}/{applicable} implemented</p>
                <p className="text-xs text-muted-foreground">{mapped}/{categoryItems.length} mapped</p>
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
            placeholder="Search controls by ID, title, or description..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {search && (
          <p className="text-sm text-muted-foreground mt-2">
            Found {filteredItems.length} control{filteredItems.length !== 1 ? "s" : ""} matching &quot;{search}&quot;
          </p>
        )}
      </div>
      
      {/* Tabs for Categories */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start flex-wrap h-auto gap-1 mb-6">
            <TabsTrigger value="all" className="text-xs">All Categories</TabsTrigger>
            {annexACategories.map(c => (
              <TabsTrigger key={c.id} value={c.id} className="text-xs">
                {c.name}
              </TabsTrigger>
            ))}
          </TabsList>
          
          <TabsContent value="all" className="space-y-8">
            {annexACategories.map(category => {
              const categoryItems = filteredItems.filter(item => item.standardControl.category === category.id)
              if (search && categoryItems.length === 0) return null
              return (
                <CategoryView 
                  key={category.id} 
                  category={category} 
                  items={filteredItems}
                  search={search}
                  onCreateControl={handleCreateControl}
                  onCreateAllControls={handleCreateAllControls}
                  isCreating={createFromStandard.isPending}
                  mappedStandardIds={mappedStandardIds}
                />
              )
            })}
          </TabsContent>
          
          {annexACategories.map(category => (
            <TabsContent key={category.id} value={category.id}>
              <CategoryView 
                category={category} 
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
