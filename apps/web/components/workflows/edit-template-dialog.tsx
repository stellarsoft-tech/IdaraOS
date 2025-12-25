"use client"

import { useState, useEffect } from "react"
import { User } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export const moduleScopeOptions = [
  { value: "people", label: "People & HR" },
  { value: "assets", label: "Assets" },
  { value: "security", label: "Security" },
  { value: "global", label: "Global" },
]

export const triggerTypeOptions = [
  { value: "onboarding", label: "Onboarding" },
  { value: "offboarding", label: "Offboarding" },
  { value: "manual", label: "Manual" },
  { value: "asset_provisioning", label: "Asset Provisioning" },
  { value: "review", label: "Review" },
]

export interface EditTemplateFormData {
  name: string
  description: string
  moduleScope: string
  triggerType: string
  status: "draft" | "active" | "archived"
  defaultOwnerId: string | null
}

export interface EditTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData?: Partial<EditTemplateFormData>
  onSave: (data: EditTemplateFormData) => Promise<void>
  isSaving?: boolean
  people?: { id: string; name: string }[]
  title?: string
  description?: string
}

export function EditTemplateDialog({
  open,
  onOpenChange,
  initialData,
  onSave,
  isSaving = false,
  people = [],
  title = "Edit Template",
  description = "Update the template details.",
}: EditTemplateDialogProps) {
  const [formData, setFormData] = useState<EditTemplateFormData>({
    name: "",
    description: "",
    moduleScope: "people",
    triggerType: "manual",
    status: "draft",
    defaultOwnerId: null,
  })

  // Reset form when dialog opens with initial data
  useEffect(() => {
    if (open && initialData) {
      setFormData({
        name: initialData.name || "",
        description: initialData.description || "",
        moduleScope: initialData.moduleScope || "people",
        triggerType: initialData.triggerType || "manual",
        status: initialData.status || "draft",
        defaultOwnerId: initialData.defaultOwnerId ?? null,
      })
    }
  }, [open, initialData])

  const handleSave = async () => {
    await onSave(formData)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name *</Label>
            <Input
              id="edit-name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Module</Label>
              <Select
                value={formData.moduleScope}
                onValueChange={(value) => setFormData(prev => ({ ...prev, moduleScope: value }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select module" />
                </SelectTrigger>
                <SelectContent>
                  {moduleScopeOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Trigger</Label>
              <Select
                value={formData.triggerType}
                onValueChange={(value) => setFormData(prev => ({ ...prev, triggerType: value }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select trigger" />
                </SelectTrigger>
                <SelectContent>
                  {triggerTypeOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value: "draft" | "active" | "archived") => 
                setFormData(prev => ({ ...prev, status: value }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Default Owner</Label>
            <Select
              value={formData.defaultOwnerId ?? "__none__"}
              onValueChange={(v) => setFormData(prev => ({ 
                ...prev, 
                defaultOwnerId: v === "__none__" ? null : v 
              }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select owner..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  <span className="text-muted-foreground">No owner</span>
                </SelectItem>
                {people.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {person.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={isSaving || !formData.name.trim()}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

