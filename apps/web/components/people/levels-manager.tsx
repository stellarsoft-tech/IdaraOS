"use client"

import { useState, useCallback } from "react"
import { 
  GripVertical, 
  Plus, 
  Pencil, 
  Trash2, 
  Save,
  X,
  Layers
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
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
import {
  useOrganizationalLevelsList,
  useCreateOrganizationalLevel,
  useUpdateOrganizationalLevel,
  useDeleteOrganizationalLevel,
  useBulkUpdateOrganizationalLevels,
  type OrganizationalLevel,
} from "@/lib/api/org-levels"

interface LevelsManagerProps {
  canEdit?: boolean
  canDelete?: boolean
  canCreate?: boolean
}

interface EditingLevel {
  id: string | null // null for new level
  name: string
  code: string
  description: string
}

export function LevelsManager({ canEdit = false, canDelete = false, canCreate = false }: LevelsManagerProps) {
  const { data: levels = [], isLoading } = useOrganizationalLevelsList()
  const createMutation = useCreateOrganizationalLevel()
  const updateMutation = useUpdateOrganizationalLevel()
  const deleteMutation = useDeleteOrganizationalLevel()
  const bulkUpdateMutation = useBulkUpdateOrganizationalLevels()
  
  const [editingLevel, setEditingLevel] = useState<EditingLevel | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<OrganizationalLevel | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [localLevels, setLocalLevels] = useState<OrganizationalLevel[] | null>(null)
  const [hasReorderChanges, setHasReorderChanges] = useState(false)
  
  // Use local state for reordering, fallback to API data
  const displayLevels = localLevels ?? levels
  
  // Start editing a level
  const handleEdit = useCallback((level: OrganizationalLevel) => {
    setEditingLevel({
      id: level.id,
      name: level.name,
      code: level.code,
      description: level.description || "",
    })
  }, [])
  
  // Start creating a new level
  const handleAdd = useCallback(() => {
    const maxSortOrder = Math.max(0, ...levels.map(l => l.sortOrder))
    const nextNumber = levels.length
    setEditingLevel({
      id: null,
      name: "",
      code: `L${nextNumber}`,
      description: "",
    })
  }, [levels])
  
  // Cancel editing
  const handleCancel = useCallback(() => {
    setEditingLevel(null)
  }, [])
  
  // Save level (create or update)
  const handleSave = useCallback(async () => {
    if (!editingLevel) return
    
    if (!editingLevel.name.trim()) {
      toast.error("Name is required")
      return
    }
    if (!editingLevel.code.trim()) {
      toast.error("Code is required")
      return
    }
    
    try {
      if (editingLevel.id) {
        // Update existing
        await updateMutation.mutateAsync({
          id: editingLevel.id,
          data: {
            name: editingLevel.name,
            code: editingLevel.code,
            description: editingLevel.description || null,
          },
        })
        toast.success("Level updated")
      } else {
        // Create new
        await createMutation.mutateAsync({
          name: editingLevel.name,
          code: editingLevel.code,
          description: editingLevel.description || undefined,
        })
        toast.success("Level created")
      }
      setEditingLevel(null)
      setLocalLevels(null) // Reset to use API data
    } catch (error) {
      toast.error((error as Error).message || "Failed to save level")
    }
  }, [editingLevel, createMutation, updateMutation])
  
  // Delete level
  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    
    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      toast.success("Level deleted")
      setDeleteTarget(null)
      setLocalLevels(null) // Reset to use API data
    } catch (error) {
      toast.error((error as Error).message || "Failed to delete level")
    }
  }, [deleteTarget, deleteMutation])
  
  // Handle drag start
  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = "move"
  }, [])
  
  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }, [])
  
  // Handle drop
  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null)
      return
    }
    
    const currentLevels = localLevels ?? [...levels]
    const draggedIndex = currentLevels.findIndex(l => l.id === draggedId)
    const targetIndex = currentLevels.findIndex(l => l.id === targetId)
    
    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedId(null)
      return
    }
    
    // Reorder
    const newLevels = [...currentLevels]
    const [dragged] = newLevels.splice(draggedIndex, 1)
    newLevels.splice(targetIndex, 0, dragged)
    
    // Update sortOrder
    const reorderedLevels = newLevels.map((level, index) => ({
      ...level,
      sortOrder: index,
    }))
    
    setLocalLevels(reorderedLevels)
    setHasReorderChanges(true)
    setDraggedId(null)
  }, [draggedId, localLevels, levels])
  
  // Save reorder changes
  const handleSaveReorder = useCallback(async () => {
    if (!localLevels || !hasReorderChanges) return
    
    try {
      await bulkUpdateMutation.mutateAsync({
        updates: localLevels.map(level => ({
          id: level.id,
          sortOrder: level.sortOrder,
        })),
      })
      toast.success("Order saved")
      setLocalLevels(null)
      setHasReorderChanges(false)
    } catch (error) {
      toast.error((error as Error).message || "Failed to save order")
    }
  }, [localLevels, hasReorderChanges, bulkUpdateMutation])
  
  // Cancel reorder changes
  const handleCancelReorder = useCallback(() => {
    setLocalLevels(null)
    setHasReorderChanges(false)
  }, [])
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-1" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }
  
  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Organizational Levels
            </CardTitle>
            <CardDescription>
              Define the hierarchical levels for your organization. Drag to reorder.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {hasReorderChanges && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelReorder}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveReorder}
                  disabled={bulkUpdateMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-1" />
                  {bulkUpdateMutation.isPending ? "Saving..." : "Save Order"}
                </Button>
              </>
            )}
            {canCreate && !editingLevel && (
              <Button onClick={handleAdd} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Level
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Add/Edit Form */}
          {editingLevel && (
            <div className="mb-6 p-4 border rounded-lg bg-muted/30">
              <h4 className="font-medium mb-4">
                {editingLevel.id ? "Edit Level" : "New Level"}
              </h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="level-name">Name *</Label>
                  <Input
                    id="level-name"
                    placeholder="e.g., Executive, Director, Manager"
                    value={editingLevel.name}
                    onChange={(e) => setEditingLevel({ ...editingLevel, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="level-code">Code *</Label>
                  <Input
                    id="level-code"
                    placeholder="e.g., L0, L1, L2"
                    value={editingLevel.code}
                    onChange={(e) => setEditingLevel({ ...editingLevel, code: e.target.value })}
                  />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <Label htmlFor="level-description">Description</Label>
                <Textarea
                  id="level-description"
                  placeholder="Optional description of this level"
                  value={editingLevel.description}
                  onChange={(e) => setEditingLevel({ ...editingLevel, description: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSave}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-1" />
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          )}
          
          {/* Levels List */}
          {displayLevels.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Layers className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No levels defined yet.</p>
              {canCreate && (
                <p className="text-sm mt-1">Click &quot;Add Level&quot; to create your first level.</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {displayLevels.map((level, index) => (
                <div
                  key={level.id}
                  draggable={canEdit && !editingLevel}
                  onDragStart={(e) => handleDragStart(e, level.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, level.id)}
                  className={`
                    flex items-center gap-3 p-3 border rounded-lg bg-card
                    transition-all duration-150
                    ${canEdit && !editingLevel ? "cursor-grab active:cursor-grabbing" : ""}
                    ${draggedId === level.id ? "opacity-50 border-dashed" : ""}
                    ${draggedId && draggedId !== level.id ? "hover:border-primary" : ""}
                  `}
                >
                  {/* Drag Handle */}
                  {canEdit && !editingLevel && (
                    <div className="text-muted-foreground">
                      <GripVertical className="h-5 w-5" />
                    </div>
                  )}
                  
                  {/* Level Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono">
                        {level.code}
                      </Badge>
                      <span className="font-medium truncate">{level.name}</span>
                    </div>
                    {level.description && (
                      <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {level.description}
                      </p>
                    )}
                  </div>
                  
                  {/* Position indicator */}
                  <div className="text-xs text-muted-foreground">
                    Position {index + 1}
                  </div>
                  
                  {/* Actions */}
                  {(canEdit || canDelete) && !editingLevel && (
                    <div className="flex items-center gap-1">
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(level)}
                          className="h-8 w-8 p-0"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(level)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Level</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the level &quot;{deleteTarget?.name}&quot; ({deleteTarget?.code})?
              This action cannot be undone.
              {deleteTarget?.roleCount && deleteTarget.roleCount > 0 && (
                <span className="block mt-2 text-destructive">
                  This level is assigned to {deleteTarget.roleCount} role(s) and cannot be deleted.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

