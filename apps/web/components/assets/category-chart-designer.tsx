"use client"

import { useState, useCallback, useMemo } from "react"
import * as Icons from "lucide-react"
import { FolderTree, Package, X, Save, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  HierarchyChartDesigner,
  type HierarchyChartItem,
  type DraftItem,
  type HierarchyChartConfig,
} from "@/components/primitives/hierarchy-chart-designer"
import { 
  type AssetCategory, 
  type CreateCategory,
  useCreateCategory,
} from "@/lib/api/assets"

export interface CategoryChartDesignerProps {
  categories: AssetCategory[]
  selectedCategoryId?: string | null
  onSelect?: (category: AssetCategory | null) => void
  onAdd?: (parentId?: string | null) => void
  onEdit?: (category: AssetCategory) => void
  onDelete?: (category: AssetCategory) => void
  onSave?: (updates: Array<{ id: string; positionX: number; positionY: number; level?: number }>) => void
  onUpdateParent?: (categoryId: string, newParentId: string | null) => void
  canEdit?: boolean
  canDelete?: boolean
  canCreate?: boolean
  isLoading?: boolean
  isSaving?: boolean
  className?: string
  isFullscreen?: boolean
  onFullscreenChange?: (isFullscreen: boolean) => void
}

// Map AssetCategory to HierarchyChartItem
interface CategoryChartItem extends HierarchyChartItem {
  icon: string
  color: string
  childCount: number
  assetCount: number
}

// Extended draft item with category-specific fields
interface CategoryDraftItem extends DraftItem {
  icon: string
  color: string
}

// Available colors for categories
const CATEGORY_COLORS = [
  { value: "gray", label: "Gray" },
  { value: "red", label: "Red" },
  { value: "orange", label: "Orange" },
  { value: "yellow", label: "Yellow" },
  { value: "green", label: "Green" },
  { value: "teal", label: "Teal" },
  { value: "blue", label: "Blue" },
  { value: "indigo", label: "Indigo" },
  { value: "purple", label: "Purple" },
  { value: "pink", label: "Pink" },
]

// Available icons for categories - comprehensive list
const CATEGORY_ICONS = [
  // Computing devices
  { value: "Laptop", label: "Laptop" },
  { value: "Monitor", label: "Monitor" },
  { value: "Smartphone", label: "Phone" },
  { value: "Tablet", label: "Tablet" },
  { value: "Tv", label: "TV/Display" },
  { value: "Watch", label: "Smartwatch" },
  // Peripherals
  { value: "Keyboard", label: "Keyboard" },
  { value: "Mouse", label: "Mouse" },
  { value: "Headphones", label: "Headphones" },
  { value: "Speaker", label: "Speaker" },
  { value: "Mic", label: "Microphone" },
  { value: "Camera", label: "Camera" },
  { value: "Video", label: "Webcam" },
  { value: "Printer", label: "Printer" },
  // Cables & Accessories
  { value: "Usb", label: "USB Device" },
  { value: "Cable", label: "Cable" },
  { value: "Plug", label: "Charger/Adapter" },
  { value: "Battery", label: "Battery/Power" },
  // Infrastructure & Network
  { value: "Server", label: "Server" },
  { value: "Database", label: "Database" },
  { value: "HardDrive", label: "Hard Drive/Storage" },
  { value: "Cpu", label: "CPU/Processor" },
  { value: "Router", label: "Router" },
  { value: "Wifi", label: "Wireless" },
  { value: "Network", label: "Network Equipment" },
  { value: "Cloud", label: "Cloud Service" },
  { value: "Globe", label: "Internet/Web" },
  // Office & Furniture
  { value: "Armchair", label: "Chair/Furniture" },
  { value: "Lamp", label: "Lamp/Lighting" },
  { value: "Building", label: "Building/Office" },
  { value: "Briefcase", label: "Briefcase" },
  // Vehicles
  { value: "Car", label: "Vehicle" },
  { value: "Truck", label: "Truck/Delivery" },
  // Generic
  { value: "Box", label: "Box/Container" },
  { value: "Package", label: "Package" },
  { value: "Tag", label: "Tagged Item" },
  { value: "Folder", label: "Folder" },
  { value: "Archive", label: "Archive" },
  { value: "FolderTree", label: "Category" },
  { value: "Wrench", label: "Tools/Equipment" },
  { value: "Settings", label: "Settings/Config" },
  { value: "Star", label: "Special Item" },
]

// Color mapping for badges
const colorVariants: Record<string, string> = {
  gray: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  red: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  orange: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  green: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  teal: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  indigo: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  purple: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  pink: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
}

// Get icon component from lucide-react by name
function getIconComponent(iconName: string): React.ElementType {
  const formattedName = iconName.charAt(0).toUpperCase() + iconName.slice(1)
  const IconComponent = (Icons as unknown as Record<string, React.ElementType>)[formattedName]
  return IconComponent || FolderTree
}

/**
 * CategoryChartDesigner - Visual chart designer for asset categories
 * Wraps the generic HierarchyChartDesigner with category-specific features
 */
export function CategoryChartDesigner({
  categories,
  selectedCategoryId,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
  onSave,
  onUpdateParent,
  canEdit = true,
  canDelete = true,
  canCreate = true,
  isLoading,
  isSaving,
  className,
  isFullscreen,
  onFullscreenChange,
}: CategoryChartDesignerProps) {
  const createCategoryMutation = useCreateCategory()
  
  // Extended draft state for category-specific fields
  const [draftExtensions, setDraftExtensions] = useState<Map<string, { icon: string; color: string }>>(new Map())
  
  // Map categories to chart items
  const items: CategoryChartItem[] = useMemo(() => 
    categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      parentId: cat.parentId ?? null,
      level: cat.level,
      sortOrder: cat.sortOrder,
      positionX: cat.positionX,
      positionY: cat.positionY,
      icon: cat.icon,
      color: cat.color,
      childCount: cat.childCount ?? 0,
      assetCount: cat.assetCount ?? 0,
    })),
    [categories]
  )
  
  // Configuration
  const config: HierarchyChartConfig<CategoryChartItem> = useMemo(() => ({
    labels: {
      itemName: "Category",
      addItem: "Add Category",
      addChild: "Add Sub-Category",
      editItem: "Edit Category",
      deleteItem: "Delete Category",
      emptyTitle: "No categories to display",
      emptyDescription: "Add asset categories to organize your inventory.",
      emptyActionLabel: "Add First Category",
      makeTopLevel: "Make Top-Level",
    },
    emptyIcon: <FolderTree className="h-12 w-12 text-muted-foreground mb-4" />,
    getChildCount: (item) => item.childCount,
    canDeleteItem: (item) => item.childCount === 0 && item.assetCount === 0,
    getLevelBadge: (level) => `L${level}`,
  }), [])
  
  // Handle selection (map back to AssetCategory)
  const handleSelect = useCallback((item: CategoryChartItem | null) => {
    if (item) {
      const category = categories.find(c => c.id === item.id)
      onSelect?.(category || null)
    } else {
      onSelect?.(null)
    }
  }, [categories, onSelect])
  
  // Handle edit (map back to AssetCategory)
  const handleEdit = useCallback((item: CategoryChartItem) => {
    const category = categories.find(c => c.id === item.id)
    if (category) {
      onEdit?.(category)
    }
  }, [categories, onEdit])
  
  // Handle delete (map back to AssetCategory)
  const handleDelete = useCallback((item: CategoryChartItem) => {
    const category = categories.find(c => c.id === item.id)
    if (category) {
      onDelete?.(category)
    }
  }, [categories, onDelete])
  
  // Handle inline creation
  const handleCreate = useCallback(async (drafts: DraftItem[]) => {
    // Create categories one by one
    for (const draft of drafts) {
      const extension = draftExtensions.get(draft.id) || { icon: "Box", color: "gray" }
      
      const createData: CreateCategory = {
        name: draft.name,
        description: draft.description || undefined,
        parentId: draft.parentId,
        icon: extension.icon,
        color: extension.color,
        level: draft.level,
        positionX: draft.positionX,
        positionY: draft.positionY,
      }
      
      await createCategoryMutation.mutateAsync(createData)
    }
    
    // Clear draft extensions
    setDraftExtensions(new Map())
  }, [draftExtensions, createCategoryMutation])
  
  // Render properties panel
  const renderPropertiesPanel = useCallback(({
    item,
    draft,
    isOpen,
    onClose,
    onUpdateDraft,
    onDeleteDraft,
    onSave: panelSave,
    hasChanges,
    isSaving: panelSaving,
  }: {
    item: CategoryChartItem | null
    draft: DraftItem | null
    isOpen: boolean
    onClose: () => void
    onUpdateDraft: (updates: Partial<DraftItem>) => void
    onDeleteDraft: () => void
    onSave: () => void
    hasChanges: boolean
    isSaving: boolean
  }) => {
    if (!isOpen) return null
    
    const isDraft = !!draft
    const draftExt = draft ? draftExtensions.get(draft.id) || { icon: "Box", color: "gray" } : null
    const originalCategory = item ? categories.find(c => c.id === item.id) : null
    
    // Get display values
    const displayName = draft?.name ?? originalCategory?.name ?? ""
    const displayDescription = draft?.description ?? originalCategory?.description ?? ""
    const displayIcon = draftExt?.icon ?? originalCategory?.icon ?? "Box"
    const displayColor = draftExt?.color ?? originalCategory?.color ?? "gray"
    const displayParentId = draft?.parentId ?? originalCategory?.parentId ?? null
    
    const IconComponent = getIconComponent(displayIcon)
    
    return (
      <div className="absolute right-0 top-0 h-full w-80 bg-card border-l border-border shadow-lg overflow-y-auto z-10">
        <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-border bg-card z-10">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-foreground">
              {isDraft ? "New Category" : "Category Properties"}
            </h3>
            {isDraft && (
              <Badge variant="outline" className="text-xs border-amber-500 text-amber-600 dark:text-amber-400">
                Draft
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-6 w-6">
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="p-4 space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="category-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="category-name"
              value={displayName}
              onChange={(e) => {
                if (isDraft) {
                  onUpdateDraft({ name: e.target.value })
                }
              }}
              disabled={!canEdit || !isDraft}
              className={cn(!displayName.trim() && isDraft && "border-destructive")}
              placeholder="Enter category name..."
            />
            {!displayName.trim() && isDraft && (
              <p className="text-xs text-destructive">Name is required</p>
            )}
          </div>
          
          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="category-description">Description</Label>
            <Textarea
              id="category-description"
              value={displayDescription}
              onChange={(e) => {
                if (isDraft) {
                  onUpdateDraft({ description: e.target.value })
                }
              }}
              rows={3}
              disabled={!canEdit || !isDraft}
              placeholder="Describe this category..."
            />
          </div>
          
          {/* Icon and Color */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Icon</Label>
              <Select
                value={displayIcon}
                onValueChange={(value) => {
                  if (isDraft && draft) {
                    setDraftExtensions(prev => {
                      const newMap = new Map(prev)
                      newMap.set(draft.id, { ...(prev.get(draft.id) || { icon: "Box", color: "gray" }), icon: value })
                      return newMap
                    })
                  }
                }}
                disabled={!canEdit || !isDraft}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_ICONS.map((icon) => {
                    const Icon = getIconComponent(icon.value)
                    return (
                      <SelectItem key={icon.value} value={icon.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {icon.label}
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Color</Label>
              <Select
                value={displayColor}
                onValueChange={(value) => {
                  if (isDraft && draft) {
                    setDraftExtensions(prev => {
                      const newMap = new Map(prev)
                      newMap.set(draft.id, { ...(prev.get(draft.id) || { icon: "Box", color: "gray" }), color: value })
                      return newMap
                    })
                  }
                }}
                disabled={!canEdit || !isDraft}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_COLORS.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2">
                        <div className={cn("h-3 w-3 rounded-full", colorVariants[color.value]?.split(" ")[0])} />
                        {color.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Preview */}
          <div className="space-y-2">
            <Label>Preview</Label>
            <div className={cn(
              "flex items-center gap-3 p-3 rounded-lg border",
              colorVariants[displayColor] || colorVariants.gray
            )}>
              <IconComponent className="h-5 w-5" />
              <span className="font-medium">{displayName || "Category Name"}</span>
            </div>
          </div>
          
          {/* Parent Category */}
          <div className="space-y-2">
            <Label>Parent Category</Label>
            <Select
              value={displayParentId ?? "__none__"}
              onValueChange={(value) => {
                if (isDraft) {
                  onUpdateDraft({ parentId: value === "__none__" ? null : value })
                }
              }}
              disabled={!canEdit || !isDraft}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select parent..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  <span className="text-muted-foreground">None (Top-level)</span>
                </SelectItem>
                {categories
                  .filter(c => c.id !== (draft?.id ?? item?.id))
                  .map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Info badges - only for existing categories */}
          {!isDraft && originalCategory && (
            <div className="flex gap-4 pt-2">
              <div>
                <div className="text-xs text-muted-foreground">Sub-categories</div>
                <Badge variant="outline" className="font-mono mt-1">{originalCategory.childCount ?? 0}</Badge>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Assets</div>
                <Badge variant="secondary" className="font-mono mt-1">
                  <Package className="h-3 w-3 mr-1" />
                  {originalCategory.assetCount ?? 0}
                </Badge>
              </div>
            </div>
          )}
          
          {/* Draft info */}
          {isDraft && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-xs text-amber-600 dark:text-amber-400">
                This category is not saved yet. Click <strong>Save</strong> in the toolbar to create it.
              </p>
            </div>
          )}
          
          {/* Open full editor - existing categories only */}
          {!isDraft && onEdit && canEdit && originalCategory && (
            <div className="pt-2 border-t">
              <Button
                variant="outline"
                onClick={() => onEdit(originalCategory)}
                className="w-full"
              >
                Open Full Editor
              </Button>
            </div>
          )}
          
          {/* Delete Button */}
          <div className="pt-4 border-t">
            {isDraft ? (
              <Button
                variant="destructive"
                onClick={onDeleteDraft}
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove Draft
              </Button>
            ) : onDelete && canDelete && originalCategory && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => onDelete(originalCategory)}
                  className="w-full"
                  disabled={(originalCategory.childCount ?? 0) > 0 || (originalCategory.assetCount ?? 0) > 0}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Category
                </Button>
                {((originalCategory.childCount ?? 0) > 0 || (originalCategory.assetCount ?? 0) > 0) && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Cannot delete categories with sub-categories or assets
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    )
  }, [categories, canEdit, canDelete, onEdit, onDelete, draftExtensions])
  
  return (
    <HierarchyChartDesigner
      items={items}
      selectedItemId={selectedCategoryId}
      onSelect={handleSelect as (item: HierarchyChartItem | null) => void}
      onAdd={onAdd}
      onEdit={handleEdit as (item: HierarchyChartItem) => void}
      onDelete={handleDelete as (item: HierarchyChartItem) => void}
      onSave={onSave}
      onUpdateParent={onUpdateParent}
      onCreate={handleCreate}
      canEdit={canEdit}
      canDelete={canDelete}
      canCreate={canCreate}
      isLoading={isLoading}
      isSaving={isSaving || createCategoryMutation.isPending}
      className={className}
      config={config as HierarchyChartConfig<HierarchyChartItem>}
      isFullscreen={isFullscreen}
      onFullscreenChange={onFullscreenChange}
      renderPropertiesPanel={renderPropertiesPanel}
    />
  )
}
