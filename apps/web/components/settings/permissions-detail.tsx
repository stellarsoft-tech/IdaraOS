"use client"

import * as React from "react"
import { Check, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Module, Permission, Action } from "@/lib/api/rbac"

interface PermissionDetailProps {
  module: Module | undefined
  permissions: Permission[]
  actions: Action[] | undefined
  permissionIds: string[]
  onToggle: (permissionId: string) => void
  onSelectAll: () => void
  onClearAll: () => void
}

export function PermissionDetail({
  module,
  permissions,
  actions,
  permissionIds,
  onToggle,
  onSelectAll,
  onClearAll,
}: PermissionDetailProps) {
  if (!module) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <Info className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">
          Select a module from the list to configure its permissions
        </p>
      </div>
    )
  }

  // Get action details for each permission
  const permissionsWithActions = permissions.map((perm) => {
    const action = actions?.find((a) => a.slug === perm.actionSlug)
    return {
      ...perm,
      actionName: action?.name || perm.actionSlug,
      actionDescription: action?.description || "",
    }
  })

  // Sort permissions by action order
  const sortedPermissions = permissionsWithActions.sort((a, b) => {
    const aOrder = actions?.findIndex((act) => act.slug === a.actionSlug) ?? 0
    const bOrder = actions?.findIndex((act) => act.slug === b.actionSlug) ?? 0
    return aOrder - bOrder
  })

  const selectedCount = permissions.filter((p) => permissionIds.includes(p.id)).length
  const allSelected = selectedCount === permissions.length
  const noneSelected = selectedCount === 0

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b pb-4 mb-4">
        <h3 className="text-lg font-semibold">{module.name}</h3>
        {module.description && (
          <p className="text-sm text-muted-foreground mt-1">{module.description}</p>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          Select which actions users with this role can perform.
        </p>
      </div>

      {/* Permissions List */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {sortedPermissions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No permissions available for this module.
          </p>
        ) : (
          sortedPermissions.map((perm) => {
            const isChecked = permissionIds.includes(perm.id)
            
            return (
              <div
                key={perm.id}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                  isChecked
                    ? "border-primary/50 bg-primary/5"
                    : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
                }`}
                onClick={() => onToggle(perm.id)}
              >
                <Checkbox
                  id={perm.id}
                  checked={isChecked}
                  onCheckedChange={() => onToggle(perm.id)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <Label
                    htmlFor={perm.id}
                    className="text-sm font-medium cursor-pointer"
                  >
                    {perm.actionName}
                  </Label>
                  {perm.actionDescription && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {perm.actionDescription}
                    </p>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Footer Actions */}
      {sortedPermissions.length > 0 && (
        <div className="border-t pt-4 mt-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {selectedCount} of {permissions.length} selected
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClearAll}
              disabled={noneSelected}
            >
              Clear All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onSelectAll}
              disabled={allSelected}
            >
              Select All
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

