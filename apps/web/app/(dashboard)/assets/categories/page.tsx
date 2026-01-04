"use client"

import { useState, useMemo } from "react"
import { 
  MoreHorizontal, 
  Pencil, 
  Plus, 
  Trash2, 
  FolderTree, 
  Box,
  Laptop,
  Monitor,
  Phone,
  Tablet,
  Keyboard,
  Headphones,
  Server,
  Printer,
  Package,
  TreeDeciduous,
  LayoutGrid,
  Table2,
  Layers,
  FolderOpen,
  // Additional peripherals
  Mouse,
  Usb,
  Cable,
  Plug,
  Speaker,
  Mic,
  Video,
  Camera,
  // Office/Furniture
  Armchair,
  Lamp,
  Building,
  Briefcase,
  // Network/Infrastructure
  Router,
  Wifi,
  Network,
  Globe,
  Cloud,
  Database,
  HardDrive,
  Cpu,
  // Generic
  Tag,
  Folder,
  Archive,
  Wrench,
  Settings,
  Star,
  Tv,
  Watch,
  Battery,
  Truck,
  Car,
} from "lucide-react"
import { toast } from "sonner"
import type { ColumnDef } from "@tanstack/react-table"

import { DataTableAdvanced as DataTable } from "@/components/primitives/data-table-advanced"
import { PageShell } from "@/components/primitives/page-shell"
import { FormDrawer } from "@/components/primitives/form-drawer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Protected, AccessDenied } from "@/components/primitives/protected"
import { StatCard } from "@/components/stat-card"
import { useCanAccess, usePermission } from "@/lib/rbac/context"
import { cn } from "@/lib/utils"
import { z } from "zod"

// Category components
import { CategoryTreeView } from "@/components/assets/category-tree-view"
import { CategoryChartDesigner } from "@/components/assets/category-chart-designer"

// API hooks
import { 
  useCategoriesList, 
  useCreateCategory, 
  useUpdateCategory, 
  useDeleteCategory,
  useBulkUpdateCategories,
  type AssetCategory,
  type CreateCategory,
  type UpdateCategory,
} from "@/lib/api/assets"

// Icon mapping - expanded with peripherals, office, network, and generic options
const iconOptions = [
  // Computing devices
  { value: "Laptop", label: "Laptop", Icon: Laptop },
  { value: "Monitor", label: "Monitor", Icon: Monitor },
  { value: "Phone", label: "Phone", Icon: Phone },
  { value: "Tablet", label: "Tablet", Icon: Tablet },
  { value: "Tv", label: "TV/Display", Icon: Tv },
  { value: "Watch", label: "Smartwatch", Icon: Watch },
  // Peripherals
  { value: "Keyboard", label: "Keyboard", Icon: Keyboard },
  { value: "Mouse", label: "Mouse", Icon: Mouse },
  { value: "Headphones", label: "Headphones", Icon: Headphones },
  { value: "Speaker", label: "Speaker", Icon: Speaker },
  { value: "Mic", label: "Microphone", Icon: Mic },
  { value: "Camera", label: "Camera", Icon: Camera },
  { value: "Video", label: "Webcam", Icon: Video },
  { value: "Printer", label: "Printer", Icon: Printer },
  // Cables & Accessories
  { value: "Usb", label: "USB Device", Icon: Usb },
  { value: "Cable", label: "Cable", Icon: Cable },
  { value: "Plug", label: "Charger/Adapter", Icon: Plug },
  { value: "Battery", label: "Battery/Power", Icon: Battery },
  // Infrastructure & Network
  { value: "Server", label: "Server", Icon: Server },
  { value: "Database", label: "Database", Icon: Database },
  { value: "HardDrive", label: "Hard Drive/Storage", Icon: HardDrive },
  { value: "Cpu", label: "CPU/Processor", Icon: Cpu },
  { value: "Router", label: "Router", Icon: Router },
  { value: "Wifi", label: "Wireless", Icon: Wifi },
  { value: "Network", label: "Network Equipment", Icon: Network },
  { value: "Cloud", label: "Cloud Service", Icon: Cloud },
  { value: "Globe", label: "Internet/Web", Icon: Globe },
  // Office & Furniture
  { value: "Armchair", label: "Chair/Furniture", Icon: Armchair },
  { value: "Lamp", label: "Lamp/Lighting", Icon: Lamp },
  { value: "Building", label: "Building/Office", Icon: Building },
  { value: "Briefcase", label: "Briefcase", Icon: Briefcase },
  // Vehicles & Transport
  { value: "Car", label: "Vehicle", Icon: Car },
  { value: "Truck", label: "Truck/Delivery", Icon: Truck },
  // Generic
  { value: "Box", label: "Box/Container", Icon: Box },
  { value: "Package", label: "Package", Icon: Package },
  { value: "Tag", label: "Tagged Item", Icon: Tag },
  { value: "Folder", label: "Folder", Icon: Folder },
  { value: "Archive", label: "Archive", Icon: Archive },
  { value: "FolderTree", label: "Category", Icon: FolderTree },
  { value: "Wrench", label: "Tools/Equipment", Icon: Wrench },
  { value: "Settings", label: "Settings/Config", Icon: Settings },
  { value: "Star", label: "Special Item", Icon: Star },
]

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  // Computing devices
  Laptop,
  Monitor,
  Phone,
  Tablet,
  Tv,
  Watch,
  // Peripherals
  Keyboard,
  Mouse,
  Headphones,
  Speaker,
  Mic,
  Camera,
  Video,
  Printer,
  // Cables & Accessories
  Usb,
  Cable,
  Plug,
  Battery,
  // Infrastructure & Network
  Server,
  Database,
  HardDrive,
  Cpu,
  Router,
  Wifi,
  Network,
  Cloud,
  Globe,
  // Office & Furniture
  Armchair,
  Lamp,
  Building,
  Briefcase,
  // Vehicles
  Car,
  Truck,
  // Generic
  Box,
  Package,
  Tag,
  Folder,
  Archive,
  FolderTree,
  Wrench,
  Settings,
  Star,
}

function getIcon(iconName: string): React.ComponentType<{ className?: string }> {
  return iconMap[iconName] || Box
}

// Color options
const colorOptions = [
  { value: "gray", label: "Gray" },
  { value: "red", label: "Red" },
  { value: "orange", label: "Orange" },
  { value: "amber", label: "Amber" },
  { value: "yellow", label: "Yellow" },
  { value: "lime", label: "Lime" },
  { value: "green", label: "Green" },
  { value: "emerald", label: "Emerald" },
  { value: "teal", label: "Teal" },
  { value: "cyan", label: "Cyan" },
  { value: "sky", label: "Sky" },
  { value: "blue", label: "Blue" },
  { value: "indigo", label: "Indigo" },
  { value: "violet", label: "Violet" },
  { value: "purple", label: "Purple" },
  { value: "fuchsia", label: "Fuchsia" },
  { value: "pink", label: "Pink" },
  { value: "rose", label: "Rose" },
]

// Color badge variants with proper contrast
const colorVariants: Record<string, string> = {
  gray: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  red: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  orange: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  lime: "bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-200",
  green: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  teal: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  cyan: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  sky: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  indigo: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  violet: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  purple: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  fuchsia: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900 dark:text-fuchsia-200",
  pink: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  rose: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
}

// Form schemas
const createCategorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  parentId: z.string().optional().nullable(),
  icon: z.string().default("Box"),
  color: z.string().default("gray"),
  defaultDepreciationYears: z.coerce.number().min(0).max(50).optional(),
})

const editCategorySchema = createCategorySchema.partial()

export default function CategoriesPage() {
  const canAccess = useCanAccess("assets.categories")
  const canCreate = usePermission("assets.categories", "create")
  const canEdit = usePermission("assets.categories", "edit")
  const canDelete = usePermission("assets.categories", "delete")
  
  // State
  const [viewMode, setViewMode] = useState<"tree" | "chart" | "table">("tree")
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory | null>(null)
  const [parentIdForCreate, setParentIdForCreate] = useState<string | null>(null)
  const [isChartFullscreen, setIsChartFullscreen] = useState(false)
  
  // Fetch data
  const { data: categories = [], isLoading, error } = useCategoriesList()
  
  // Mutations
  const createMutation = useCreateCategory()
  const updateMutation = useUpdateCategory()
  const deleteMutation = useDeleteCategory()
  const bulkUpdateMutation = useBulkUpdateCategories()
  
  // Calculate stats
  const stats = useMemo(() => {
    const total = categories.length
    const topLevel = categories.filter(c => !c.parentId).length
    const withAssets = categories.filter(c => (c.assetCount ?? 0) > 0).length
    const empty = categories.filter(c => (c.assetCount ?? 0) === 0 && (c.childCount ?? 0) === 0).length
    
    return { total, topLevel, withAssets, empty }
  }, [categories])
  
  // Build parent category options
  const parentOptions = useMemo(() => {
    return categories.map(c => ({ value: c.id, label: c.name }))
  }, [categories])
  
  // Form config with dynamic parent options
  const formConfig = useMemo(() => ({
    name: { component: "input" as const, label: "Name", placeholder: "e.g., Laptops" },
    description: { component: "textarea" as const, label: "Description", placeholder: "Category description" },
    parentId: { 
      component: "select" as const,
      label: "Parent Category", 
      placeholder: "None (top-level)", 
      options: [{ value: "__none__", label: "None (top-level)" }, ...parentOptions],
    },
    icon: { 
      component: "select" as const,
      label: "Icon", 
      options: iconOptions.map(o => ({ value: o.value, label: o.label, icon: o.Icon })),
    },
    color: { 
      component: "select" as const,
      label: "Color", 
      options: colorOptions.map(c => ({ value: c.value, label: c.label, color: c.value })),
    },
    defaultDepreciationYears: { 
      component: "input" as const,
      type: "number",
      label: "Default Depreciation (Years)", 
      placeholder: "e.g., 3", 
    },
  }), [parentOptions])
  
  const formFields = ["name", "description", "parentId", "icon", "color", "defaultDepreciationYears"]
  
  // Simple alphabetical sort for flat table view
  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => a.name.localeCompare(b.name))
  }, [categories])
  
  // Table columns
  const columns: ColumnDef<AssetCategory>[] = [
    {
      id: "name",
      header: "Name",
      accessorKey: "name",
      cell: ({ row }) => {
        const category = row.original
        const Icon = getIcon(category.icon)
        
        return (
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded flex items-center justify-center bg-muted">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="font-medium">{category.name}</span>
          </div>
        )
      },
      enableSorting: true,
      size: 250,
    },
    {
      id: "description",
      header: "Description",
      accessorKey: "description",
      cell: ({ row }) => {
        const description = row.original.description
        if (!description) return <span className="text-muted-foreground">—</span>
        return (
          <span className="text-sm text-muted-foreground truncate max-w-[200px]" title={description}>
            {description.length > 50 ? `${description.slice(0, 50)}...` : description}
          </span>
        )
      },
      size: 200,
    },
    {
      id: "parent",
      header: "Parent",
      accessorKey: "parentId",
      cell: ({ row }) => {
        const parentId = row.original.parentId
        if (!parentId) return <span className="text-muted-foreground">—</span>
        const parent = categories.find(c => c.id === parentId)
        if (!parent) return <span className="text-muted-foreground">—</span>
        const ParentIcon = getIcon(parent.icon)
        return (
          <div className="flex items-center gap-2">
            <ParentIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm">{parent.name}</span>
          </div>
        )
      },
      size: 150,
    },
    {
      id: "assetCount",
      header: "Assets",
      accessorKey: "assetCount",
      cell: ({ row }) => {
        const count = row.original.assetCount ?? 0
        return (
          <Badge variant="secondary" className="font-mono">
            <Package className="h-3 w-3 mr-1" />
            {count}
          </Badge>
        )
      },
      size: 80,
    },
    {
      id: "childCount",
      header: "Sub-categories",
      accessorKey: "childCount",
      cell: ({ row }) => {
        const count = row.original.childCount ?? 0
        if (count === 0) return <span className="text-muted-foreground">—</span>
        return (
          <Badge variant="outline" className="font-mono">
            <FolderOpen className="h-3 w-3 mr-1" />
            {count}
          </Badge>
        )
      },
      size: 100,
    },
    {
      id: "color",
      header: "Color",
      accessorKey: "color",
      cell: ({ row }) => {
        const color = row.original.color
        return (
          <Badge className={cn("text-xs capitalize border-0", colorVariants[color] || colorVariants.gray)}>
            {color}
          </Badge>
        )
      },
      size: 100,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const category = row.original
        const hasChildrenOrAssets = (category.childCount ?? 0) > 0 || (category.assetCount ?? 0) > 0
        
        return (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              {canEdit && (
                <DropdownMenuItem onSelect={() => { setSelectedCategory(category); setEditOpen(true) }}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {canCreate && (
                <DropdownMenuItem onSelect={() => { setParentIdForCreate(category.id); setCreateOpen(true) }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Sub-Category
                </DropdownMenuItem>
              )}
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onSelect={() => { setSelectedCategory(category); setDeleteOpen(true) }}
                    className="text-destructive"
                    disabled={hasChildrenOrAssets}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
      enableSorting: false,
      size: 50,
    },
  ]
  
  // Handlers
  const handleCreate = async (values: CreateCategory) => {
    try {
      const category = await createMutation.mutateAsync({
        ...values,
        parentId: values.parentId === "__none__" ? undefined : values.parentId || undefined,
      })
      toast.success(`Category "${category.name}" has been created`)
      setCreateOpen(false)
      setParentIdForCreate(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create category")
    }
  }
  
  const handleEdit = async (values: UpdateCategory) => {
    if (!selectedCategory) return
    try {
      await updateMutation.mutateAsync({ 
        id: selectedCategory.id, 
        data: {
          ...values,
          parentId: values.parentId === "__none__" ? null : values.parentId || null,
        }
      })
      toast.success("Category updated successfully")
      setEditOpen(false)
      setSelectedCategory(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update category")
    }
  }
  
  const handleDelete = async () => {
    if (!selectedCategory) return
    try {
      await deleteMutation.mutateAsync(selectedCategory.id)
      toast.success(`Category "${selectedCategory.name}" has been deleted`)
      setDeleteOpen(false)
      setSelectedCategory(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete category")
    }
  }
  
  // Chart designer handlers
  const handleChartSave = async (updates: Array<{ id: string; positionX: number; positionY: number; level?: number }>) => {
    try {
      await bulkUpdateMutation.mutateAsync({ updates })
      toast.success("Category positions saved")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save positions")
    }
  }
  
  const handleChartUpdateParent = async (categoryId: string, newParentId: string | null) => {
    try {
      await updateMutation.mutateAsync({
        id: categoryId,
        data: { parentId: newParentId },
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update parent")
    }
  }
  
  // Tree/Chart add handlers
  const handleTreeAdd = (parentId?: string | null) => {
    setParentIdForCreate(parentId || null)
    setCreateOpen(true)
  }
  
  const handleTreeSelect = (category: AssetCategory | null) => {
    setSelectedCategory(category)
  }
  
  const handleTreeEdit = (category: AssetCategory) => {
    setSelectedCategory(category)
    setEditOpen(true)
  }
  
  const handleTreeDelete = (category: AssetCategory) => {
    setSelectedCategory(category)
    setDeleteOpen(true)
  }
  
  if (!canAccess) {
    return (
      <PageShell title="Categories">
        <AccessDenied 
          title="Access Denied" 
          description="You don't have permission to view asset categories." 
        />
      </PageShell>
    )
  }

  if (error) {
    return (
      <PageShell title="Categories" description="Manage asset categories and types.">
        <div className="flex items-center justify-center h-64 text-destructive">
          Failed to load categories
        </div>
      </PageShell>
    )
  }
  
  return (
    <PageShell
      title="Asset Categories"
      description="Organize assets into categories for better management."
      action={
        <Protected module="assets.categories" action="create">
          <Button onClick={() => { setParentIdForCreate(null); setCreateOpen(true) }}>
            <Plus className="mr-2 h-4 w-4" />
            Add Category
          </Button>
        </Protected>
      }
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            title="Total Categories"
            value={stats.total}
            icon={FolderTree}
            iconColor="bg-primary/10 text-primary"
          />
          <StatCard
            title="Top-Level"
            value={stats.topLevel}
            icon={Layers}
            iconColor="bg-blue-500/10 text-blue-600 dark:text-blue-400"
          />
          <StatCard
            title="With Assets"
            value={stats.withAssets}
            icon={Package}
            iconColor="bg-green-500/10 text-green-600 dark:text-green-400"
          />
          <StatCard
            title="Empty"
            value={stats.empty}
            icon={FolderOpen}
            iconColor="bg-amber-500/10 text-amber-600 dark:text-amber-400"
          />
        </div>
        
        {/* View Tabs */}
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
          <TabsList>
            <TabsTrigger value="tree" className="gap-2">
              <TreeDeciduous className="h-4 w-4" />
              Tree View
            </TabsTrigger>
            <TabsTrigger value="chart" className="gap-2">
              <LayoutGrid className="h-4 w-4" />
              Chart
            </TabsTrigger>
            <TabsTrigger value="table" className="gap-2">
              <Table2 className="h-4 w-4" />
              Table
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="tree">
            <Card className="py-0">
              <CardContent className="p-0">
                <CategoryTreeView
                  categories={categories}
                  selectedCategoryId={selectedCategory?.id}
                  onSelect={handleTreeSelect}
                  onAdd={handleTreeAdd}
                  onEdit={handleTreeEdit}
                  onDelete={handleTreeDelete}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  isLoading={isLoading}
                />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="chart">
            <Card className={isChartFullscreen ? "fixed inset-0 z-50 rounded-none py-0" : "py-0"}>
              <CardContent className={isChartFullscreen ? "p-0 h-full" : "p-0 h-[600px]"}>
                <CategoryChartDesigner
                  categories={categories}
                  selectedCategoryId={selectedCategory?.id}
                  onSelect={handleTreeSelect}
                  onAdd={handleTreeAdd}
                  onEdit={handleTreeEdit}
                  onDelete={handleTreeDelete}
                  onSave={handleChartSave}
                  onUpdateParent={handleChartUpdateParent}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  canCreate={canCreate}
                  isLoading={isLoading}
                  isSaving={bulkUpdateMutation.isPending}
                  isFullscreen={isChartFullscreen}
                  onFullscreenChange={setIsChartFullscreen}
                />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="table">
            <Card>
              <CardHeader>
                <CardTitle>All Categories</CardTitle>
                <CardDescription>
                  Categories help organize your assets by type. Use the Parent column to see hierarchy.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={columns}
                  data={sortedCategories}
                  loading={isLoading}
                  searchKey="name"
                  searchPlaceholder="Search categories..."
                  enableSorting
                  emptyState={
                    <div className="text-center py-12">
                      <FolderTree className="mx-auto h-12 w-12 text-muted-foreground/50" />
                      <h3 className="mt-4 text-lg font-semibold">No categories yet</h3>
                      <p className="text-muted-foreground mt-2 mb-4">
                        Get started by creating your first asset category.
                      </p>
                      <Protected module="assets.categories" action="create">
                        <Button onClick={() => setCreateOpen(true)}>
                          <Plus className="mr-2 h-4 w-4" />
                          Create first category
                        </Button>
                      </Protected>
                    </div>
                  }
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Create Drawer */}
      <FormDrawer
        open={createOpen}
        onOpenChange={(open) => { setCreateOpen(open); if (!open) setParentIdForCreate(null) }}
        title="Add Category"
        description="Create a new asset category"
        schema={createCategorySchema}
        config={formConfig}
        fields={formFields}
        mode="create"
        defaultValues={{
          parentId: parentIdForCreate || "__none__",
        }}
        onSubmit={handleCreate}
      />
      
      {/* Edit Drawer */}
      {selectedCategory && (
        <FormDrawer
          open={editOpen}
          onOpenChange={(open) => { setEditOpen(open); if (!open) setSelectedCategory(null); }}
          title={`Edit ${selectedCategory.name}`}
          description="Update category information"
          schema={editCategorySchema}
          config={formConfig}
          fields={formFields}
          mode="edit"
          defaultValues={{
            name: selectedCategory.name,
            description: selectedCategory.description || "",
            parentId: selectedCategory.parentId || "__none__",
            icon: selectedCategory.icon,
            color: selectedCategory.color,
            defaultDepreciationYears: selectedCategory.defaultDepreciationYears || undefined,
          }}
          onSubmit={handleEdit}
        />
      )}
      
      {/* Delete Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{selectedCategory?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the category. Assets in this category will become uncategorized.
              Any sub-categories will also become top-level categories.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedCategory(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  )
}
