"use client"

import { useState } from "react"
import { format, formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import {
  CheckCircle,
  Download,
  ExternalLink,
  FileText,
  FolderArchive,
  Loader2,
  MoreHorizontal,
  Paperclip,
  Trash2,
  Upload,
  User,
  UserPlus,
  Calendar,
  Clock,
  X,
} from "lucide-react"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { CompactFileUpload } from "@/components/primitives/file-upload"
import {
  useEntityFiles,
  useDeleteFile,
  downloadFile,
  type FileRecord,
} from "@/lib/api/files"
import { useUpdateWorkflowStep, type WorkflowInstanceStep } from "@/lib/api/workflows"

// Status badge config
const statusConfig: Record<WorkflowInstanceStep["status"], { color: string; label: string }> = {
  pending: { color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300", label: "Pending" },
  in_progress: { color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300", label: "In Progress" },
  completed: { color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300", label: "Completed" },
  skipped: { color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300", label: "Skipped" },
  blocked: { color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300", label: "Blocked" },
}

interface PersonOption {
  id: string
  name: string
  email?: string
}

interface TaskDetailSheetProps {
  step: WorkflowInstanceStep | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate?: () => void
  readOnly?: boolean
  instanceStatus: "pending" | "in_progress" | "completed" | "cancelled" | "on_hold"
  people?: PersonOption[]
}

export function TaskDetailSheet({
  step,
  open,
  onOpenChange,
  onUpdate,
  readOnly = false,
  instanceStatus,
  people = [],
}: TaskDetailSheetProps) {
  const [notes, setNotes] = useState(step?.notes || "")
  const [assigneeId, setAssigneeId] = useState<string | null>(step?.assignedPersonId || null)
  const [status, setStatus] = useState<WorkflowInstanceStep["status"]>(step?.status || "pending")
  const [activeTab, setActiveTab] = useState("details")
  
  const updateStepMutation = useUpdateWorkflowStep()
  
  // Sync state when step changes
  if (step && step.notes !== notes && !updateStepMutation.isPending) {
    setNotes(step.notes || "")
  }
  if (step && step.assignedPersonId !== assigneeId && !updateStepMutation.isPending) {
    setAssigneeId(step.assignedPersonId || null)
  }
  if (step && step.status !== status && !updateStepMutation.isPending) {
    setStatus(step.status)
  }
  
  const isStepReadOnly = readOnly || instanceStatus === "completed" || instanceStatus === "cancelled"
  const isStepCompleted = step?.status === "completed"
  
  const handleSave = async () => {
    if (!step) return
    
    try {
      await updateStepMutation.mutateAsync({
        id: step.id,
        data: {
          notes,
          assignedPersonId: assigneeId || null,
          status,
        },
      })
      toast.success("Task updated")
      onUpdate?.()
    } catch {
      toast.error("Failed to update task")
    }
  }
  
  const handleQuickStatusChange = async (newStatus: WorkflowInstanceStep["status"]) => {
    if (!step || isStepReadOnly) return
    
    try {
      await updateStepMutation.mutateAsync({
        id: step.id,
        data: { status: newStatus },
      })
      setStatus(newStatus)
      toast.success(`Task moved to ${newStatus.replace(/_/g, " ")}`)
      onUpdate?.()
    } catch {
      toast.error("Failed to update task status")
    }
  }
  
  if (!step) return null
  
  // Check if attachments are enabled from template step config
  const attachmentsEnabled = step.templateStep?.attachmentsEnabled ?? true
  const fileCategoryId = step.templateStep?.fileCategoryId
  const filePathPrefix = step.templateStep?.filePathPrefix
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl w-full overflow-y-auto" side="right">
        <SheetHeader className="space-y-1">
          <div className="flex items-start justify-between gap-4 pr-8">
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-lg leading-tight line-clamp-2">
                {step.name}
              </SheetTitle>
              {step.description && (
                <SheetDescription className="mt-1 line-clamp-2">
                  {step.description}
                </SheetDescription>
              )}
            </div>
            <Badge className={statusConfig[step.status].color}>
              {statusConfig[step.status].label}
            </Badge>
          </div>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto py-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="attachments" disabled={!attachmentsEnabled}>
                <Paperclip className="h-3.5 w-3.5 mr-1.5" />
                Attachments
              </TabsTrigger>
            </TabsList>
            
            {/* Details Tab */}
            <TabsContent value="details" className="space-y-4 mt-0">
              {/* Status Quick Actions */}
              {!isStepReadOnly && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Quick Actions</Label>
                  <div className="flex flex-wrap gap-2">
                    {step.status === "pending" && (
                      <Button 
                        size="sm" 
                        onClick={() => handleQuickStatusChange("in_progress")}
                        disabled={updateStepMutation.isPending}
                      >
                        <Clock className="h-3.5 w-3.5 mr-1.5" />
                        Start Task
                      </Button>
                    )}
                    {(step.status === "pending" || step.status === "in_progress") && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="text-green-600 hover:text-green-700 border-green-200 hover:bg-green-50 dark:border-green-900 dark:hover:bg-green-950"
                        onClick={() => handleQuickStatusChange("completed")}
                        disabled={updateStepMutation.isPending}
                      >
                        <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                        Complete
                      </Button>
                    )}
                    {step.status === "in_progress" && (
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => handleQuickStatusChange("pending")}
                        disabled={updateStepMutation.isPending}
                      >
                        Reset to Pending
                      </Button>
                    )}
                  </div>
                </div>
              )}
              
              <Separator />
              
              {/* Step Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                {step.dueAt && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      Due Date
                    </Label>
                    <p className="font-medium">
                      {format(new Date(step.dueAt), "MMM d, yyyy")}
                    </p>
                  </div>
                )}
                {step.startedAt && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Started</Label>
                    <p className="font-medium">
                      {formatDistanceToNow(new Date(step.startedAt), { addSuffix: true })}
                    </p>
                  </div>
                )}
                {step.completedAt && (
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                      Completed
                    </Label>
                    <p className="font-medium">
                      {format(new Date(step.completedAt), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                )}
              </div>
              
              <Separator />
              
              {/* Assignee */}
              <div className="space-y-2">
                <Label htmlFor="assignee" className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-muted-foreground" />
                  Assignee
                </Label>
                {isStepReadOnly || isStepCompleted ? (
                  <div className="flex items-center gap-2 py-2 px-3 bg-muted/50 rounded-md">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {step.assignedPerson?.name || step.assignee?.name || "Unassigned"}
                    </span>
                  </div>
                ) : (
                  <Select
                    value={assigneeId || "__none__"}
                    onValueChange={(value) => setAssigneeId(value === "__none__" ? null : value)}
                  >
                    <SelectTrigger id="assignee" className="w-full">
                      <SelectValue placeholder="Select assignee..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        <span className="text-muted-foreground">Unassigned</span>
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
                )}
              </div>
              
              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this task..."
                  rows={4}
                  disabled={isStepReadOnly || isStepCompleted}
                  className="resize-none"
                />
              </div>
            </TabsContent>
            
            {/* Attachments Tab */}
            <TabsContent value="attachments" className="mt-0">
              {attachmentsEnabled ? (
                <TaskAttachments
                  stepId={step.id}
                  categoryId={fileCategoryId}
                  pathPrefix={filePathPrefix}
                  readOnly={isStepReadOnly || isStepCompleted}
                />
              ) : (
                <div className="py-8 text-center border rounded-lg border-dashed">
                  <Paperclip className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Attachments are disabled for this task
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
        
        <SheetFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={updateStepMutation.isPending || isStepReadOnly || isStepCompleted}
          >
            {updateStepMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ============================================================================
// Task Attachments Component
// ============================================================================

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "Unknown"
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

interface TaskAttachmentsProps {
  stepId: string
  categoryId?: string | null
  pathPrefix?: string | null
  readOnly?: boolean
}

function TaskAttachments({ stepId, categoryId, pathPrefix, readOnly }: TaskAttachmentsProps) {
  const [showUpload, setShowUpload] = useState(false)
  const [deletingFile, setDeletingFile] = useState<FileRecord | null>(null)
  
  const { data: filesData, isLoading } = useEntityFiles("workflow_step", stepId)
  const deleteMutation = useDeleteFile()
  
  const files = filesData?.data ?? []
  
  const handleDownload = async (file: FileRecord) => {
    try {
      await downloadFile(file.id, file.name)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to download file")
    }
  }
  
  const handleViewInStorage = (file: FileRecord) => {
    if (file.webUrl) {
      window.open(file.webUrl, "_blank", "noopener,noreferrer")
    } else {
      toast.error("Storage URL not available for this file")
    }
  }
  
  const getStorageProviderLabel = (provider?: string): string => {
    switch (provider) {
      case "sharepoint": return "SharePoint"
      case "azure_blob": return "Azure Blob"
      case "local": return "Local Storage"
      default: return "Storage"
    }
  }
  
  const handleDelete = async () => {
    if (!deletingFile) return
    try {
      await deleteMutation.mutateAsync(deletingFile.id)
      toast.success("File deleted")
      setDeletingFile(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete file")
    }
  }
  
  const handleUploadComplete = () => {
    setShowUpload(false)
    toast.success("File uploaded")
  }
  
  return (
    <div className="space-y-4">
      {/* Upload Section */}
      {!readOnly && (
        <div className="space-y-3">
          {showUpload ? (
            <div className="border rounded-lg p-4 bg-muted/30">
              <CompactFileUpload
                moduleScope="workflows"
                entityType="workflow_step"
                entityId={stepId}
                defaultCategoryId={categoryId ?? undefined}
                defaultPathPrefix={pathPrefix ?? undefined}
                multiple
                maxFiles={5}
                onUpload={handleUploadComplete}
              />
              <div className="mt-3 flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => setShowUpload(false)}>
                  <X className="h-3.5 w-3.5 mr-1.5" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => setShowUpload(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Files
            </Button>
          )}
        </div>
      )}
      
      {/* Files List */}
      {isLoading ? (
        <div className="py-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-2">Loading attachments...</p>
        </div>
      ) : files.length === 0 ? (
        <div className="py-8 text-center border rounded-lg border-dashed">
          <FolderArchive className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            No attachments yet
          </p>
          {!readOnly && !showUpload && (
            <p className="text-xs text-muted-foreground mt-1">
              Click &quot;Upload Files&quot; to add attachments
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
              {files.length} File{files.length !== 1 ? "s" : ""}
            </Label>
          </div>
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                  {file.createdAt && (
                    <>
                      {" · "}
                      {formatDistanceToNow(new Date(file.createdAt), { addSuffix: true })}
                    </>
                  )}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleDownload(file)}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </DropdownMenuItem>
                  {file.webUrl && (
                    <DropdownMenuItem onClick={() => handleViewInStorage(file)}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View in {getStorageProviderLabel(file.storageProvider)}
                    </DropdownMenuItem>
                  )}
                  {!readOnly && (
                    <DropdownMenuItem
                      onClick={() => setDeletingFile(file)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}
      
      {/* Delete Confirmation */}
      <Dialog open={!!deletingFile} onOpenChange={(open) => !open && setDeletingFile(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Attachment</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deletingFile?.name}&quot;?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingFile(null)}>
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
    </div>
  )
}

export default TaskDetailSheet
