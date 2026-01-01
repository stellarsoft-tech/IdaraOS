"use client"

import * as React from "react"
import { ChevronDown, ChevronRight, Check, Minus, Circle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Module, Permission } from "@/lib/api/rbac"

interface ModuleTreeProps {
  modulesByCategory: Map<string, Array<{ module: Module; permissions: Permission[] }>>
  selectedModule: string | null
  onSelectModule: (slug: string) => void
  permissionIds: string[]
  allPermissions: Permission[] | undefined
}

export function ModuleTree({
  modulesByCategory,
  selectedModule,
  onSelectModule,
  permissionIds,
  allPermissions,
}: ModuleTreeProps) {
  const [expandedCategories, setExpandedCategories] = React.useState<Set<string>>(() => {
    // Start with all categories expanded
    return new Set(modulesByCategory.keys())
  })

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  // Get permission state for a module (none, some, all)
  const getModulePermissionState = (moduleSlug: string): "none" | "some" | "all" => {
    const modulePerms = allPermissions?.filter((p) => p.moduleSlug === moduleSlug) || []
    if (modulePerms.length === 0) return "none"
    
    const selectedCount = modulePerms.filter((p) => permissionIds.includes(p.id)).length
    if (selectedCount === 0) return "none"
    if (selectedCount === modulePerms.length) return "all"
    return "some"
  }

  // Get category summary
  const getCategorySummary = (categoryModules: Array<{ module: Module; permissions: Permission[] }>) => {
    let assigned = 0
    const total = categoryModules.length

    for (const data of categoryModules) {
      const state = getModulePermissionState(data.module.slug)
      if (state === "all" || state === "some") {
        assigned++
      }
    }

    return { assigned, total }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b bg-muted/50">
        <h3 className="text-sm font-medium">Modules</h3>
      </div>
      <div className="flex-1 overflow-y-auto">
        {Array.from(modulesByCategory.entries()).map(([category, categoryModules]) => {
          const isExpanded = expandedCategories.has(category)
          const summary = getCategorySummary(categoryModules)

          return (
            <div key={category}>
              {/* Category Header */}
              <button
                type="button"
                onClick={() => toggleCategory(category)}
                className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="text-sm font-medium">{category}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {summary.assigned}/{summary.total}
                </span>
              </button>

              {/* Module List */}
              {isExpanded && (
                <div className="pb-1">
                  {categoryModules.map((data) => {
                    const state = getModulePermissionState(data.module.slug)
                    const isSelected = selectedModule === data.module.slug

                    return (
                      <button
                        key={data.module.slug}
                        type="button"
                        onClick={() => onSelectModule(data.module.slug)}
                        className={cn(
                          "flex items-center gap-2 w-full px-3 py-1.5 pl-9 text-left text-sm transition-colors",
                          isSelected
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-muted/50"
                        )}
                      >
                        {/* Permission State Indicator */}
                        <div className="flex items-center justify-center w-4 h-4 shrink-0">
                          {state === "all" && (
                            <div className="w-4 h-4 rounded-sm bg-primary flex items-center justify-center">
                              <Check className="h-3 w-3 text-primary-foreground" />
                            </div>
                          )}
                          {state === "some" && (
                            <div className="w-4 h-4 rounded-sm bg-primary/60 flex items-center justify-center">
                              <Minus className="h-3 w-3 text-primary-foreground" />
                            </div>
                          )}
                          {state === "none" && (
                            <div className="w-4 h-4 rounded-sm border-2 border-muted-foreground/30" />
                          )}
                        </div>
                        <span className="truncate">{data.module.name}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

