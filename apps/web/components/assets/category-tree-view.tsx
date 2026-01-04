"use client"

import { useMemo } from "react"
import * as Icons from "lucide-react"
import { FolderTree, Package } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { 
  HierarchyTreeView, 
  type HierarchyItem,
  type HierarchyTreeConfig,
} from "@/components/primitives/hierarchy-tree-view"
import { type AssetCategory } from "@/lib/api/assets"

export interface CategoryTreeViewProps {
  categories: AssetCategory[]
  selectedCategoryId?: string | null
  onSelect?: (category: AssetCategory) => void
  onAdd?: (parentId?: string | null) => void
  onEdit?: (category: AssetCategory) => void
  onDelete?: (category: AssetCategory) => void
  canEdit?: boolean
  canDelete?: boolean
  isLoading?: boolean
  className?: string
}

/**
 * Adapter interface to map AssetCategory to HierarchyItem
 */
interface CategoryTreeItem extends HierarchyItem {
  originalCategory: AssetCategory
  icon: string
  color: string
}

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
  // Ensure it's a valid icon name (PascalCase)
  const formattedName = iconName.charAt(0).toUpperCase() + iconName.slice(1)
  const IconComponent = (Icons as unknown as Record<string, React.ElementType>)[formattedName]
  return IconComponent || FolderTree
}

/**
 * CategoryTreeView - Tree view component for asset categories
 * Wraps the generic HierarchyTreeView with category-specific rendering
 */
export function CategoryTreeView({
  categories,
  selectedCategoryId,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
  isLoading,
  className,
}: CategoryTreeViewProps) {
  // Map AssetCategory[] to HierarchyItem[]
  const items: CategoryTreeItem[] = useMemo(() => 
    categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      parentId: cat.parentId ?? null,
      level: cat.level,
      sortOrder: cat.sortOrder,
      icon: cat.icon,
      color: cat.color,
      originalCategory: cat,
    })),
    [categories]
  )
  
  // Configuration for category-specific rendering
  const config: HierarchyTreeConfig<CategoryTreeItem> = useMemo(() => ({
    labels: {
      itemName: "category",
      addChild: "Add Sub-Category",
      editItem: "Edit Category",
      deleteItem: "Delete Category",
      addRoot: "Add Category",
      emptyTitle: "No categories defined",
      emptyDescription: "Create asset categories to organize your inventory.",
      addFirstButton: "Add First Category",
    },
    emptyIcon: <FolderTree className="h-10 w-10 text-muted-foreground mb-3" />,
    
    // Render category-specific icon with color
    renderIcon: (item) => {
      const IconComponent = getIconComponent(item.icon || "Box")
      const colorClass = colorVariants[item.color || "gray"] || colorVariants.gray
      
      return (
        <div className={`h-6 w-6 rounded flex items-center justify-center flex-shrink-0 ${colorClass}`}>
          <IconComponent className="h-3.5 w-3.5" />
        </div>
      )
    },
    
    // Render badges (asset count if available)
    renderBadges: (item) => (
      <>
        {item.originalCategory.assetCount !== undefined && item.originalCategory.assetCount > 0 && (
          <Badge variant="secondary" className="font-mono text-xs flex items-center gap-1">
            <Package className="h-3 w-3" />
            {item.originalCategory.assetCount}
          </Badge>
        )}
      </>
    ),
    
    // Check if category can be deleted (no children, no assets)
    canDeleteItem: (item) => 
      (item.originalCategory.childCount ?? 0) === 0 && 
      (item.originalCategory.assetCount ?? 0) === 0,
    
    // Sort by sortOrder, then level, then name
    sortFn: (a, b) => {
      if (a.sortOrder !== b.sortOrder) return (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
      if (a.level !== b.level) return (a.level ?? 0) - (b.level ?? 0)
      return a.name.localeCompare(b.name)
    },
  }), [])
  
  // Event handlers that map back to AssetCategory
  const handleSelect = (item: CategoryTreeItem) => {
    onSelect?.(item.originalCategory)
  }
  
  const handleEdit = (item: CategoryTreeItem) => {
    onEdit?.(item.originalCategory)
  }
  
  const handleDelete = (item: CategoryTreeItem) => {
    onDelete?.(item.originalCategory)
  }
  
  return (
    <HierarchyTreeView
      items={items}
      selectedId={selectedCategoryId}
      onSelect={handleSelect}
      onAdd={onAdd}
      onEdit={handleEdit}
      onDelete={handleDelete}
      canEdit={canEdit}
      canDelete={canDelete}
      isLoading={isLoading}
      className={className}
      config={config}
    />
  )
}
