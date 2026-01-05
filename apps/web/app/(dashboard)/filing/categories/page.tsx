"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { 
  AlertCircle,
  Check,
  FileArchive,
  FileBadge,
  FileCheck,
  FileImage,
  FileSignature,
  FileSpreadsheet,
  FileText,
  FileUser,
  FolderTree,
  HardDrive,
  Key,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Receipt,
  Search,
  Shield,
  Trash2,
  Wrench,
} from "lucide-react"
import { toast } from "sonner"

import { PageShell } from "@/components/primitives/page-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Protected, AccessDenied } from "@/components/primitives/protected"
import { useCanAccess, usePermission } from "@/lib/rbac/context"
import { StatusBadge } from "@/components/status-badge"
import {
  useFileCategoriesList,
  useCreateFileCategory,
  useUpdateFileCategory,
  useDeleteFileCategory,
  MODULE_SCOPE_OPTIONS,
  CATEGORY_ICON_OPTIONS,
  CATEGORY_COLOR_OPTIONS,
  type FileCategory,
  type CreateFileCategoryInput,
  type UpdateFileCategoryInput,
} from "@/lib/api/file-categories"
import {
  useStorageIntegrationsList,
  type StorageIntegration,
} from "@/lib/api/storage-integrations"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"

// Icon mapping for dynamic rendering
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText,
  FileCheck,
  FileSignature,
  FileBadge,
  FileUser,
  FileImage,
  FileSpreadsheet,
  FileArchive,
  Receipt,
  Shield,
  Key,
  Wrench,
}

// Color hex values for swatches
const COLOR_HEX_MAP: Record<string, string> = {
  blue: "#3b82f6",
  green: "#22c55e",
  purple: "#a855f7",
  amber: "#f59e0b",
  red: "#ef4444",
  cyan: "#06b6d4",
  pink: "#ec4899",
  slate: "#64748b",
}

// Default form state
const defaultFormState: CreateFileCategoryInput = {
  name: "",
  description: "",
  icon: "FileText",
  color: "blue",
  moduleScope: "people",
  storageIntegrationId: null,
  folderPath: "",
  isRequired: false,
  maxFileSize: null,
  allowedMimeTypes: null,
  sortOrder: 0,
}

export default function FilingCategoriesPage() {
  const canAccess = useCanAccess("filing.categories")
  const canCreate = usePermission("filing.categories", "create")
  const canEdit = usePermission("filing.categories", "edit")
  const canDelete = usePermission("filing.categories", "delete")
  
  const { data: categories = [], isLoading: categoriesLoading } = useFileCategoriesList()
  const { data: storageIntegrations = [], isLoading: storageLoading } = useStorageIntegrationsList()
  
  const createMutation = useCreateFileCategory()
  const updateMutation = useUpdateFileCategory()
  const deleteMutation = useDeleteFileCategory()
  
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedModule, setSelectedModule] = useState<string>("all")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingCategory, setEditingCategory] = useState<FileCategory | null>(null)
  const [deletingCategory, setDeletingCategory] = useState<FileCategory | null>(null)
  const [formData, setFormData] = useState<CreateFileCategoryInput>(defaultFormState)
  
  // Filter categories
  const filteredCategories = useMemo(() => {
    return categories.filter(cat => {
      const matchesSearch = !searchQuery || 
        cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cat.description?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesModule = selectedModule === "all" || cat.moduleScope === selectedModule
      return matchesSearch && matchesModule
    })
  }, [categories, searchQuery, selectedModule])
  
  // Group by module for display
  const categoriesByModule = useMemo(() => {
    const grouped: Record<string, FileCategory[]> = {}
    for (const cat of filteredCategories) {
      if (!grouped[cat.moduleScope]) {
        grouped[cat.moduleScope] = []
      }
      grouped[cat.moduleScope].push(cat)
    }
    // Sort by sortOrder within each module
    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => a.sortOrder - b.sortOrder)
    }
    return grouped
  }, [filteredCategories])
  
  const connectedStorageIntegrations = storageIntegrations.filter(s => s.status === "connected")
  
  const resetForm = () => {
    setFormData(defaultFormState)
  }
  
  const openCreateDialog = () => {
    resetForm()
    setShowCreateDialog(true)
  }
  
  const openEditDialog = (category: FileCategory) => {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      description: category.description || "",
      icon: category.icon || "FileText",
      color: category.color || "blue",
      moduleScope: category.moduleScope,
      storageIntegrationId: category.storageIntegrationId,
      folderPath: category.folderPath || "",
      isRequired: category.isRequired,
      maxFileSize: category.maxFileSize,
      allowedMimeTypes: category.allowedMimeTypes,
      sortOrder: category.sortOrder,
    })
  }
  
  const handleCreate = async () => {
    try {
      await createMutation.mutateAsync(formData)
      toast.success("Category created successfully")
      setShowCreateDialog(false)
      resetForm()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create category")
    }
  }
  
  const handleUpdate = async () => {
    if (!editingCategory) return
    try {
      const updateData: UpdateFileCategoryInput = {
        name: formData.name,
        description: formData.description || null,
        icon: formData.icon || null,
        color: formData.color || null,
        storageIntegrationId: formData.storageIntegrationId,
        folderPath: formData.folderPath || null,
        isRequired: formData.isRequired,
        maxFileSize: formData.maxFileSize,
        allowedMimeTypes: formData.allowedMimeTypes,
        sortOrder: formData.sortOrder,
      }
      await updateMutation.mutateAsync({ id: editingCategory.id, data: updateData })
      toast.success("Category updated successfully")
      setEditingCategory(null)
      resetForm()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update category")
    }
  }
  
  const handleDelete = async () => {
    if (!deletingCategory) return
    try {
      const result = await deleteMutation.mutateAsync(deletingCategory.id)
      if (result.message) {
        toast.success(result.message)
      } else {
        toast.success("Category deleted successfully")
      }
      setDeletingCategory(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete category")
    }
  }
  
  const handleToggleActive = async (category: FileCategory) => {
    try {
      await updateMutation.mutateAsync({
        id: category.id,
        data: { isActive: !category.isActive },
      })
      toast.success(category.isActive ? "Category deactivated" : "Category activated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update category")
    }
  }
  
  if (!canAccess) {
    return (
      <PageShell title="File Categories">
        <AccessDenied 
          title="Access Denied" 
          description="You don't have permission to manage file categories." 
        />
      </PageShell>
    )
  }
  
  const isLoading = categoriesLoading || storageLoading
  
  return (
    <PageShell 
      title="File Categories" 
      description="Create and manage file categories for each module"
      action={
        canCreate && (
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            New Category
          </Button>
        )
      }
    >
      <div className="space-y-4">
        {/* Info Alert */}
        {connectedStorageIntegrations.length === 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Storage Connected</AlertTitle>
            <AlertDescription>
              Connect a storage provider in{" "}
              <Link href="/settings/integrations" className="underline font-medium">
                Settings → Integrations
              </Link>{" "}
              before configuring categories.
            </AlertDescription>
          </Alert>
        )}
        
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={selectedModule} onValueChange={setSelectedModule}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Modules" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Modules</SelectItem>
              {MODULE_SCOPE_OPTIONS.map(module => (
                <SelectItem key={module.value} value={module.value}>
                  {module.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Categories Table */}
        <Card className="py-0 gap-0">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : filteredCategories.length === 0 ? (
              <div className="text-center py-12">
                <FolderTree className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="font-medium">
                  {searchQuery || selectedModule !== "all" ? "No categories found" : "No categories yet"}
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchQuery || selectedModule !== "all" 
                    ? "Try adjusting your filters"
                    : "Create your first file category to get started"
                  }
                </p>
                {canCreate && !searchQuery && selectedModule === "all" && (
                  <Button onClick={openCreateDialog}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Category
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Category</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Storage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(categoriesByModule).map(([module, cats]) => (
                    cats.map((category, index) => (
                      <TableRow key={category.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div 
                              className={`h-8 w-8 rounded-lg flex items-center justify-center bg-${category.color || "slate"}-100 dark:bg-${category.color || "slate"}-900/30`}
                            >
                              <FileText className={`h-4 w-4 text-${category.color || "slate"}-600 dark:text-${category.color || "slate"}-400`} />
                            </div>
                            <div>
                              <p className="font-medium">{category.name}</p>
                              {category.description && (
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {category.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {MODULE_SCOPE_OPTIONS.find(m => m.value === category.moduleScope)?.label || category.moduleScope}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {category.storageIntegration ? (
                            <div className="flex items-center gap-2">
                              <HardDrive className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{category.storageIntegration.name}</span>
                              {category.storageIntegration.status === "connected" ? (
                                <StatusBadge variant="success" className="text-xs">Connected</StatusBadge>
                              ) : (
                                <StatusBadge variant="danger" className="text-xs">Disconnected</StatusBadge>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">Not configured</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {category.isActive ? (
                            <StatusBadge variant="success">Active</StatusBadge>
                          ) : (
                            <StatusBadge variant="default">Inactive</StatusBadge>
                          )}
                        </TableCell>
                        <TableCell>
                          {(canEdit || canDelete) && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {canEdit && (
                                  <DropdownMenuItem onClick={() => openEditDialog(category)}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                )}
                                {canEdit && (
                                  <DropdownMenuItem onClick={() => handleToggleActive(category)}>
                                    {category.isActive ? (
                                      <>
                                        <AlertCircle className="h-4 w-4 mr-2" />
                                        Deactivate
                                      </>
                                    ) : (
                                      <>
                                        <Check className="h-4 w-4 mr-2" />
                                        Activate
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                )}
                                {canDelete && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => setDeletingCategory(category)}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Create/Edit Sheet */}
      <Sheet 
        open={showCreateDialog || !!editingCategory} 
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false)
            setEditingCategory(null)
            resetForm()
          }
        }}
      >
        <SheetContent className="sm:max-w-[540px] w-full p-0 flex flex-col h-full">
          <SheetHeader className="px-6 pt-6 pb-4 shrink-0 border-b">
            <SheetTitle>
              {editingCategory ? "Edit Category" : "Create File Category"}
            </SheetTitle>
            <SheetDescription>
              {editingCategory 
                ? "Update the category settings and storage configuration."
                : "Create a new file category for organizing documents."
              }
            </SheetDescription>
          </SheetHeader>
          
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="px-6 py-4">
                <Tabs defaultValue="general">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="storage">Storage</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="general" className="space-y-4 mt-4">
                    {/* Name */}
                    <div className="space-y-2">
                      <Label htmlFor="name">Name <span className="text-destructive">*</span></Label>
                      <Input
                        id="name"
                        placeholder="e.g., CV/Resume, Employment Contract"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    
                    {/* Description */}
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        placeholder="Brief description of this category..."
                        value={formData.description || ""}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={2}
                      />
                    </div>
                    
                    {/* Module Scope */}
                    <div className="space-y-2">
                      <Label>Module <span className="text-destructive">*</span></Label>
                      <Select
                        value={formData.moduleScope}
                        onValueChange={(value) => setFormData({ ...formData, moduleScope: value as typeof formData.moduleScope })}
                        disabled={!!editingCategory}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MODULE_SCOPE_OPTIONS.map(module => (
                            <SelectItem key={module.value} value={module.value}>
                              {module.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {editingCategory && (
                        <p className="text-xs text-muted-foreground">
                          Module cannot be changed after creation
                        </p>
                      )}
                    </div>
                    
                    {/* Icon */}
                    <div className="space-y-2">
                      <Label>Icon</Label>
                      <Select
                        value={formData.icon || "FileText"}
                        onValueChange={(value) => setFormData({ ...formData, icon: value })}
                      >
                        <SelectTrigger className="w-full">
                          {(() => {
                            const IconComponent = ICON_MAP[formData.icon || "FileText"] || FileText
                            const selectedOption = CATEGORY_ICON_OPTIONS.find(i => i.value === formData.icon)
                            return (
                              <span className="flex items-center gap-2">
                                <IconComponent className="h-4 w-4 text-muted-foreground" />
                                {selectedOption?.label || "Document"}
                              </span>
                            )
                          })()}
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORY_ICON_OPTIONS.map(icon => {
                            const IconComponent = ICON_MAP[icon.value] || FileText
                            return (
                              <SelectItem key={icon.value} value={icon.value}>
                                <span className="flex items-center gap-2">
                                  <IconComponent className="h-4 w-4 text-muted-foreground" />
                                  {icon.label}
                                </span>
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Color */}
                    <div className="space-y-2">
                      <Label>Color</Label>
                      <Select
                        value={formData.color || "blue"}
                        onValueChange={(value) => setFormData({ ...formData, color: value })}
                      >
                        <SelectTrigger className="w-full">
                          {(() => {
                            const selectedColor = formData.color || "blue"
                            const selectedOption = CATEGORY_COLOR_OPTIONS.find(c => c.value === selectedColor)
                            return (
                              <span className="flex items-center gap-2">
                                <span 
                                  className="h-3 w-3 rounded-full shrink-0 border border-border"
                                  style={{ backgroundColor: COLOR_HEX_MAP[selectedColor] || COLOR_HEX_MAP.blue }}
                                />
                                {selectedOption?.label || "Blue"}
                              </span>
                            )
                          })()}
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORY_COLOR_OPTIONS.map(color => (
                            <SelectItem key={color.value} value={color.value}>
                              <span className="flex items-center gap-2">
                                <span 
                                  className="h-3 w-3 rounded-full shrink-0 border border-border"
                                  style={{ backgroundColor: COLOR_HEX_MAP[color.value] || COLOR_HEX_MAP.blue }}
                                />
                                {color.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Required toggle */}
                    <div className="flex items-center justify-between py-2">
                      <div>
                        <Label>Required</Label>
                        <p className="text-xs text-muted-foreground">
                          Mark this category as required for entities
                        </p>
                      </div>
                      <Switch
                        checked={formData.isRequired}
                        onCheckedChange={(checked) => setFormData({ ...formData, isRequired: checked })}
                      />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="storage" className="space-y-4 mt-4">
                    {/* Storage Integration */}
                    <div className="space-y-2">
                      <Label>Storage Provider</Label>
                      <Select
                        value={formData.storageIntegrationId || "__none__"}
                        onValueChange={(value) => setFormData({ 
                          ...formData, 
                          storageIntegrationId: value === "__none__" ? null : value 
                        })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select storage..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">No storage (metadata only)</SelectItem>
                          {connectedStorageIntegrations.length === 0 ? (
                            <SelectItem value="__no_storage__" disabled>
                              No connected storage providers
                            </SelectItem>
                          ) : (
                            connectedStorageIntegrations.map(storage => (
                              <SelectItem key={storage.id} value={storage.id}>
                                <span className="flex items-center gap-2">
                                  <HardDrive className="h-4 w-4" />
                                  {storage.name}
                                  <Badge variant="outline" className="text-xs ml-2">
                                    {storage.provider === "sharepoint" ? "SharePoint" : "Blob"}
                                  </Badge>
                                </span>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      {connectedStorageIntegrations.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          <Link href="/settings/integrations" className="underline">
                            Connect a storage provider
                          </Link>{" "}
                          to enable file uploads
                        </p>
                      )}
                    </div>
                    
                    {/* Folder Path */}
                    {formData.storageIntegrationId && (
                      <div className="space-y-2">
                        <Label htmlFor="folderPath">Folder Path</Label>
                        <Input
                          id="folderPath"
                          placeholder="/HR/Employee Documents"
                          value={formData.folderPath || ""}
                          onChange={(e) => setFormData({ ...formData, folderPath: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">
                          Sub-folder within the storage integration (optional)
                        </p>
                      </div>
                    )}
                    
                    <Separator />
                    
                    {/* File Restrictions */}
                    <div className="space-y-4">
                      <Label className="text-base">File Restrictions</Label>
                      
                      {/* Max File Size */}
                      <div className="space-y-2">
                        <Label htmlFor="maxFileSize">Max File Size (MB)</Label>
                        <Input
                          id="maxFileSize"
                          type="number"
                          placeholder="e.g., 25"
                          value={formData.maxFileSize ? (formData.maxFileSize / 1024 / 1024).toString() : ""}
                          onChange={(e) => {
                            const mb = parseFloat(e.target.value)
                            setFormData({ 
                              ...formData, 
                              maxFileSize: isNaN(mb) ? null : Math.round(mb * 1024 * 1024)
                            })
                          }}
                        />
                        <p className="text-xs text-muted-foreground">
                          Leave empty for no limit
                        </p>
                      </div>
                      
                      {/* Allowed MIME Types */}
                      <div className="space-y-2">
                        <Label htmlFor="allowedTypes">Allowed File Types</Label>
                        <Input
                          id="allowedTypes"
                          placeholder="e.g., application/pdf, image/*"
                          value={formData.allowedMimeTypes?.join(", ") || ""}
                          onChange={(e) => {
                            const types = e.target.value
                              .split(",")
                              .map(t => t.trim())
                              .filter(Boolean)
                            setFormData({ 
                              ...formData, 
                              allowedMimeTypes: types.length > 0 ? types : null 
                            })
                          }}
                        />
                        <p className="text-xs text-muted-foreground">
                          Comma-separated MIME types. Leave empty to allow all types.
                        </p>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </ScrollArea>
          </div>
          
          {/* Sticky footer */}
          <div className="shrink-0 border-t bg-background px-6 py-4">
            <div className="flex items-center gap-2">
              <Button
                onClick={editingCategory ? handleUpdate : handleCreate}
                disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {editingCategory ? "Save Changes" : "Create Category"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false)
                  setEditingCategory(null)
                  resetForm()
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingCategory} onOpenChange={(open) => !open && setDeletingCategory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deletingCategory?.name}&quot;? 
              {deletingCategory?.fileCount && deletingCategory.fileCount > 0 
                ? " This category has files and will be deactivated instead of deleted."
                : " This action cannot be undone."
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingCategory(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
