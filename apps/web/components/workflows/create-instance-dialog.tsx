"use client"

/**
 * Create Workflow Instance Dialog
 * 
 * Dialog for manually creating a workflow instance from any template.
 */

import { useState, useEffect, useMemo } from "react"
import { toast } from "sonner"
import { Calendar as CalendarIcon, User, Package, Loader2 } from "lucide-react"
import { format } from "date-fns"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { 
  useCreateWorkflowInstance, 
  type WorkflowTemplate,
} from "@/lib/api/workflows"
import { moduleScopeOptions } from "@/components/workflows/edit-template-dialog"
import { usePeopleList } from "@/lib/api/people"
import { useAssetsList } from "@/lib/api/assets"

interface CreateInstanceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: WorkflowTemplate
  onSuccess?: (instanceId: string) => void
}

// Entity type options based on module scope
const entityTypeOptions: Record<string, Array<{ value: string; label: string; icon: React.ReactNode }>> = {
  people: [
    { value: "person", label: "Person", icon: <User className="h-4 w-4" /> },
  ],
  assets: [
    { value: "asset", label: "Asset", icon: <Package className="h-4 w-4" /> },
  ],
  global: [
    { value: "person", label: "Person", icon: <User className="h-4 w-4" /> },
    { value: "asset", label: "Asset", icon: <Package className="h-4 w-4" /> },
  ],
}

export function CreateInstanceDialog({
  open,
  onOpenChange,
  template,
  onSuccess,
}: CreateInstanceDialogProps) {
  // Form state
  const [name, setName] = useState("")
  const [entityType, setEntityType] = useState("")
  const [entityId, setEntityId] = useState("")
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined)
  
  // Get entity options based on module scope
  const moduleScope = template.moduleScope || "global"
  const availableEntityTypes = entityTypeOptions[moduleScope] || entityTypeOptions.global
  
  // Queries for entity selection
  const { data: people = [], isLoading: isLoadingPeople } = usePeopleList()
  const { data: assets = [], isLoading: isLoadingAssets } = useAssetsList()
  
  // Mutation
  const createMutation = useCreateWorkflowInstance()
  
  // Auto-select entity type if only one option
  useEffect(() => {
    if (availableEntityTypes.length === 1) {
      setEntityType(availableEntityTypes[0].value)
    }
  }, [availableEntityTypes])
  
  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName(`${template.name} - ${new Date().toLocaleDateString()}`)
      setEntityId("")
      setDueDate(template.defaultDueDays 
        ? new Date(Date.now() + template.defaultDueDays * 24 * 60 * 60 * 1000)
        : undefined
      )
      
      // Auto-select entity type based on trigger
      if (template.triggerType?.includes("person") || template.moduleScope === "people") {
        setEntityType("person")
      } else if (template.moduleScope === "assets") {
        setEntityType("asset")
      } else if (availableEntityTypes.length === 1) {
        setEntityType(availableEntityTypes[0].value)
      } else {
        setEntityType("")
      }
    }
  }, [open, template, availableEntityTypes])
  
  // Get entity options based on selected type
  const entityOptions = useMemo((): Array<{ value: string; label: string; sublabel?: string }> => {
    if (entityType === "person") {
      return people.map((p) => ({
        value: p.id,
        label: p.name,
        sublabel: p.email,
      }))
    }
    if (entityType === "asset") {
      return assets.map((a) => ({
        value: a.id,
        label: a.name,
        sublabel: a.assetTag,
      }))
    }
    return []
  }, [entityType, people, assets])
  
  const isLoadingEntities = 
    (entityType === "person" && isLoadingPeople) ||
    (entityType === "asset" && isLoadingAssets)
  
  // Handle submit
  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Please enter a name for the workflow")
      return
    }
    
    if (!entityType) {
      toast.error("Please select an entity type")
      return
    }
    
    if (!entityId) {
      toast.error("Please select an entity")
      return
    }
    
    try {
      const instance = await createMutation.mutateAsync({
        templateId: template.id,
        entityType,
        entityId,
        name: name.trim(),
        dueAt: dueDate?.toISOString(),
      })
      
      toast.success("Workflow instance created successfully")
      onOpenChange(false)
      onSuccess?.(instance.id)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create workflow instance"
      toast.error(message)
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Workflow Instance</DialogTitle>
          <DialogDescription>
            Create a new instance of &quot;{template.name}&quot;. 
            {template.triggerType && template.triggerType !== "manual" && (
              <span className="block mt-1 text-amber-600 dark:text-amber-400">
                Note: This template normally triggers automatically on {
                  template.triggerType === "onboarding" ? "onboarding" :
                  template.triggerType === "offboarding" ? "offboarding" :
                  template.triggerType
                }.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Instance Name */}
          <div className="space-y-2">
            <Label htmlFor="instance-name">Instance Name *</Label>
            <Input
              id="instance-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Onboarding - John Doe"
            />
          </div>
          
          {/* Entity Type (only show if multiple options) */}
          {availableEntityTypes.length > 1 && (
            <div className="space-y-2">
              <Label>Entity Type *</Label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select entity type" />
                </SelectTrigger>
                <SelectContent>
                  {availableEntityTypes.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        {option.icon}
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          {/* Entity Selection */}
          {entityType && (
            <div className="space-y-2">
              <Label>
                Select {entityType === "person" ? "Person" : entityType === "asset" ? "Asset" : "Entity"} *
              </Label>
              {isLoadingEntities ? (
                <div className="flex items-center gap-2 p-3 border rounded-md text-muted-foreground w-full">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </div>
              ) : (
                <Select value={entityId} onValueChange={setEntityId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={`Select ${entityType}`} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {entityOptions.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No {entityType === "person" ? "people" : entityType === "asset" ? "assets" : "entities"} available
                      </div>
                    ) : (
                      entityOptions.map((option: { value: string; label: string; sublabel?: string }) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex flex-col">
                            <span>{option.label}</span>
                            {option.sublabel && (
                              <span className="text-xs text-muted-foreground">{option.sublabel}</span>
                            )}
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
          
          {/* Due Date */}
          <div className="space-y-2">
            <Label>Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dueDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "PPP") : "Select due date (optional)"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                  disabled={(date) => date < new Date()}
                />
              </PopoverContent>
            </Popover>
            {template.defaultDueDays && (
              <p className="text-xs text-muted-foreground">
                Default: {template.defaultDueDays} days from start
              </p>
            )}
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={createMutation.isPending || !name.trim() || !entityType || !entityId}
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Instance"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

