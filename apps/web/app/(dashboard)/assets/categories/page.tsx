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
} from "lucide-react"
import { toast } from "sonner"
import type { ColumnDef } from "@tanstack/react-table"

import { DataTableAdvanced as DataTable } from "@/components/primitives/data-table-advanced"
import { PageShell } from "@/components/primitives/page-shell"
import { FormDrawer } from "@/components/primitives/form-drawer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { useCanAccess, usePermission } from "@/lib/rbac/context"
import { z } from "zod"

// API hooks
import { 
  useCategoriesList, 
  useCreateCategory, 
  useUpdateCategory, 
  useDeleteCategory,
  type AssetCategory,
  type CreateCategory,
  type UpdateCategory,
} from "@/lib/api/assets"

// Icon mapping
const iconOptions = [
  { value: "Box", label: "Box", Icon: Box },
  { value: "Laptop", label: "Laptop", Icon: Laptop },
  { value: "Monitor", label: "Monitor", Icon: Monitor },
  { value: "Phone", label: "Phone", Icon: Phone },
  { value: "Tablet", label: "Tablet", Icon: Tablet },
  { value: "Keyboard", label: "Keyboard", Icon: Keyboard },
  { value: "Headphones", label: "Headphones", Icon: Headphones },
  { value: "Server", label: "Server", Icon: Server },
  { value: "Printer", label: "Printer", Icon: Printer },
  { value: "Package", label: "Package", Icon: Package },
]

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
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
  const canEdit = usePermission("assets.categories", "edit")
  const canDelete = usePermission("assets.categories", "delete")
  
  // State
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory | null>(null)
  
  // Fetch data
  const { data: categories = [], isLoading, error } = useCategoriesList()
  
  // Mutations
  const createMutation = useCreateCategory()
  const updateMutation = useUpdateCategory()
  const deleteMutation = useDeleteCategory()
  
  // Build parent category options
  const parentOptions = useMemo(() => {
    // Only allow top-level categories as parents (for simplicity)
    return categories
      .filter(c => !c.parentId)
      .map(c => ({ value: c.id, label: c.name }))
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
      options: iconOptions.map(o => ({ value: o.value, label: o.label })),
    },
    color: { 
      component: "select" as const,
      label: "Color", 
      options: colorOptions,
    },
    defaultDepreciationYears: { 
      component: "input" as const,
      type: "number",
      label: "Default Depreciation (Years)", 
      placeholder: "e.g., 3", 
    },
  }), [parentOptions])
  
  const formFields = ["name", "description", "parentId", "icon", "color", "defaultDepreciationYears"]
  
  // Organize categories into tree structure for display
  const organizedCategories = useMemo(() => {
    const topLevel = categories.filter(c => !c.parentId)
    const children = categories.filter(c => c.parentId)
    
    // Sort by name
    topLevel.sort((a, b) => a.name.localeCompare(b.name))
    children.sort((a, b) => a.name.localeCompare(b.name))
    
    // Interleave: parent followed by its children
    const result: AssetCategory[] = []
    for (const parent of topLevel) {
      result.push(parent)
      const parentChildren = children.filter(c => c.parentId === parent.id)
      result.push(...parentChildren)
    }
    
    // Add orphans (children without parents in our list)
    const orphans = children.filter(c => !topLevel.some(p => p.id === c.parentId))
    result.push(...orphans)
    
    return result
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
        const isChild = !!category.parentId
        
        return (
          <div className={`flex items-center gap-3 ${isChild ? "ml-8" : ""}`}>
            <div 
              className="h-8 w-8 rounded flex items-center justify-center bg-muted"
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-2">
              {isChild && <span className="text-muted-foreground">└</span>}
              <span className="font-medium">{category.name}</span>
            </div>
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
      id: "icon",
      header: "Icon",
      accessorKey: "icon",
      cell: ({ row }) => {
        const category = row.original
        const Icon = getIcon(category.icon)
        return (
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{category.icon}</span>
          </div>
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
          <Badge 
            variant="outline" 
            className="text-xs capitalize"
            style={{ borderColor: `var(--${color}-500)`, color: `var(--${color}-600)` }}
          >
            {color}
          </Badge>
        )
      },
      size: 100,
    },
    {
      id: "depreciation",
      header: "Depreciation",
      accessorKey: "defaultDepreciationYears",
      cell: ({ row }) => {
        const years = row.original.defaultDepreciationYears
        if (!years) return <span className="text-muted-foreground">—</span>
        return <span className="text-sm">{years} years</span>
      },
      size: 100,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const category = row.original
        
        return (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              {canEdit && (
                <DropdownMenuItem 
                  onSelect={(e) => { 
                    e.preventDefault()
                    setSelectedCategory(category)
                    setEditOpen(true)
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onSelect={(e) => { 
                      e.preventDefault()
                      setSelectedCategory(category)
                      setDeleteOpen(true)
                    }}
                    className="text-destructive"
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
        // Convert __none__ placeholder to undefined
        parentId: values.parentId === "__none__" ? undefined : values.parentId || undefined,
      })
      toast.success(`Category "${category.name}" has been created`)
      setCreateOpen(false)
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
          // Convert __none__ placeholder to null
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
      <PageShell
        title="Categories"
        description="Manage asset categories and types."
      >
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
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Category
          </Button>
        </Protected>
      }
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>All Categories</CardTitle>
            <CardDescription>
              Categories help organize your assets by type. Sub-categories are indented under their parent.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={organizedCategories}
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
      </div>
      
      {/* Create Drawer */}
      <FormDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Add Category"
        description="Create a new asset category"
        schema={createCategorySchema}
        config={formConfig}
        fields={formFields}
        mode="create"
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

