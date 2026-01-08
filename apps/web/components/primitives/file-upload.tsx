"use client"

import { useCallback, useState, useRef } from "react"
import { 
  AlertCircle,
  Check,
  FileText,
  Loader2,
  Upload,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  useModuleFileCategories,
  type FileCategory,
} from "@/lib/api/file-categories"
import { cn } from "@/lib/utils"
import { useQueryClient } from "@tanstack/react-query"

// ============================================================================
// Types
// ============================================================================

export interface UploadedFile {
  id: string
  name: string
  originalName: string
  mimeType: string
  size: number
  categoryId: string
  categoryName?: string
  storagePath: string
  externalId?: string
  createdAt: string
}

export interface FileUploadProps {
  /** Module scope determines which categories are shown */
  moduleScope: "people" | "assets" | "workflows" | "security" | "docs" | "vendors"
  
  /** Entity type and ID for file association */
  entityType: string
  entityId: string
  
  /** Pre-selected category (bypasses category selection) */
  categoryId?: string
  
  /** Default category ID from template configuration (allows user override) */
  defaultCategoryId?: string
  
  /** Path prefix to prepend to storage path (e.g., from workflow template) */
  defaultPathPrefix?: string
  
  /** Callback when file(s) are uploaded */
  onUpload?: (files: UploadedFile[]) => void
  
  /** Callback when upload fails */
  onError?: (error: Error) => void
  
  /** Allow multiple files */
  multiple?: boolean
  
  /** Max number of files (when multiple=true) */
  maxFiles?: number
  
  /** Custom accept attribute for file input */
  accept?: string
  
  /** Custom max file size in bytes (overrides category setting) */
  maxSize?: number
  
  /** Compact mode for inline usage */
  compact?: boolean
  
  /** Disabled state */
  disabled?: boolean
  
  /** Custom class name */
  className?: string
}

export interface PendingFile {
  id: string
  file: File
  categoryId: string | null
  status: "pending" | "uploading" | "success" | "error"
  progress: number
  error?: string
  uploadedFile?: UploadedFile
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function validateFile(
  file: File,
  category: FileCategory | null,
  maxSize?: number
): { valid: boolean; error?: string } {
  // Check file size
  const maxFileSize = maxSize || category?.maxFileSize
  if (maxFileSize && file.size > maxFileSize) {
    return {
      valid: false,
      error: `File exceeds maximum size of ${formatFileSize(maxFileSize)}`,
    }
  }
  
  // Check MIME type
  const allowedTypes = category?.allowedMimeTypes
  if (allowedTypes && allowedTypes.length > 0) {
    const isAllowed = allowedTypes.some(type => {
      if (type.endsWith("/*")) {
        // Wildcard match (e.g., "image/*")
        return file.type.startsWith(type.replace("/*", "/"))
      }
      return file.type === type
    })
    
    if (!isAllowed) {
      return {
        valid: false,
        error: `File type ${file.type || "unknown"} is not allowed`,
      }
    }
  }
  
  return { valid: true }
}

// ============================================================================
// Component
// ============================================================================

export function FileUpload({
  moduleScope,
  entityType,
  entityId,
  categoryId: fixedCategoryId,
  defaultCategoryId,
  defaultPathPrefix,
  onUpload,
  onError,
  multiple = false,
  maxFiles = 10,
  accept,
  maxSize,
  compact = false,
  disabled = false,
  className,
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  // Use fixedCategoryId if provided, otherwise default to defaultCategoryId (can be overridden by user)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(fixedCategoryId ?? defaultCategoryId ?? null)
  const [isDragging, setIsDragging] = useState(false)
  // Path prefix for storage path (from template configuration)
  const pathPrefix = defaultPathPrefix ?? null
  
  const queryClient = useQueryClient()
  const { data: categories = [], isLoading: categoriesLoading } = useModuleFileCategories(moduleScope)
  
  // Get the effective category ID
  const effectiveCategoryId = fixedCategoryId || selectedCategoryId
  const selectedCategory = categories.find(c => c.id === effectiveCategoryId) ?? null
  
  // Build accept string from category or prop
  const effectiveAccept = accept || (selectedCategory?.allowedMimeTypes?.join(",") ?? undefined)
  
  // ==================== File Handling ====================
  
  const addFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files)
    
    // Limit files if not multiple or exceeds max
    const filesToAdd = multiple 
      ? fileArray.slice(0, maxFiles - pendingFiles.length)
      : [fileArray[0]]
    
    if (fileArray.length > filesToAdd.length) {
      toast.warning(`Only ${filesToAdd.length} file(s) added. Maximum is ${maxFiles}.`)
    }
    
    const newPendingFiles: PendingFile[] = filesToAdd.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      categoryId: effectiveCategoryId,
      status: "pending",
      progress: 0,
    }))
    
    // Validate files immediately
    newPendingFiles.forEach(pf => {
      const validation = validateFile(pf.file, selectedCategory, maxSize)
      if (!validation.valid) {
        pf.status = "error"
        pf.error = validation.error
      }
    })
    
    setPendingFiles(prev => 
      multiple ? [...prev, ...newPendingFiles] : newPendingFiles
    )
  }, [effectiveCategoryId, selectedCategory, maxSize, multiple, maxFiles, pendingFiles.length])
  
  const removeFile = useCallback((id: string) => {
    setPendingFiles(prev => prev.filter(pf => pf.id !== id))
  }, [])
  
  const clearAll = useCallback(() => {
    setPendingFiles([])
  }, [])
  
  // ==================== Drag & Drop ====================
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) {
      setIsDragging(true)
    }
  }, [disabled])
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    if (disabled) return
    
    const { files } = e.dataTransfer
    if (files.length > 0) {
      addFiles(files)
    }
  }, [disabled, addFiles])
  
  // ==================== Upload ====================
  
  const uploadFile = async (pendingFile: PendingFile): Promise<UploadedFile | null> => {
    if (!effectiveCategoryId) {
      throw new Error("Please select a category first")
    }
    
    // Update status to uploading
    setPendingFiles(prev => 
      prev.map(pf => pf.id === pendingFile.id 
        ? { ...pf, status: "uploading" as const, progress: 0 }
        : pf
      )
    )
    
    try {
      const formData = new FormData()
      formData.append("file", pendingFile.file)
      formData.append("categoryId", effectiveCategoryId)
      formData.append("entityType", entityType)
      formData.append("entityId", entityId)
      
      // Include path prefix if configured (e.g., from workflow template)
      if (pathPrefix) {
        formData.append("pathPrefix", pathPrefix)
      }
      
      // TODO: Implement actual upload with progress tracking
      // For now, simulate with a simple POST
      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Upload failed")
      }
      
      const uploadedFile = await response.json() as UploadedFile
      
      // Update status to success
      setPendingFiles(prev => 
        prev.map(pf => pf.id === pendingFile.id 
          ? { ...pf, status: "success" as const, progress: 100, uploadedFile }
          : pf
        )
      )
      
      return uploadedFile
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Upload failed"
      
      // Update status to error
      setPendingFiles(prev => 
        prev.map(pf => pf.id === pendingFile.id 
          ? { ...pf, status: "error" as const, error: errorMessage }
          : pf
        )
      )
      
      throw error
    }
  }
  
  const uploadAll = async () => {
    const filesToUpload = pendingFiles.filter(pf => pf.status === "pending")
    
    if (filesToUpload.length === 0) {
      toast.warning("No files to upload")
      return
    }
    
    if (!effectiveCategoryId) {
      toast.error("Please select a category first")
      return
    }
    
    const uploadedFiles: UploadedFile[] = []
    const errors: Error[] = []
    
    for (const pendingFile of filesToUpload) {
      try {
        const uploaded = await uploadFile(pendingFile)
        if (uploaded) {
          uploadedFiles.push(uploaded)
        }
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error("Upload failed"))
      }
    }
    
    if (uploadedFiles.length > 0) {
      // Invalidate files queries to refresh file lists
      queryClient.invalidateQueries({ queryKey: ["files"] })
      
      onUpload?.(uploadedFiles)
      toast.success(`${uploadedFiles.length} file(s) uploaded successfully`)
    }
    
    if (errors.length > 0) {
      onError?.(errors[0])
    }
    
    // Clear successful uploads after a short delay
    setTimeout(() => {
      setPendingFiles(prev => prev.filter(pf => pf.status !== "success"))
    }, 2000)
  }
  
  // ==================== Render ====================
  
  const hasPendingFiles = pendingFiles.length > 0
  const hasValidPendingFiles = pendingFiles.some(pf => pf.status === "pending")
  const isUploading = pendingFiles.some(pf => pf.status === "uploading")
  
  // Category not configured with storage
  const categoryMissingStorage = selectedCategory && !selectedCategory.storageIntegrationId
  
  return (
    <div className={cn("space-y-4", className)}>
      {/* Category Selection (if not fixed) */}
      {!fixedCategoryId && (
        <div className="space-y-2">
          <Label>File Category</Label>
          <Select
            value={selectedCategoryId ?? "__none__"}
            onValueChange={(value) => setSelectedCategoryId(value === "__none__" ? null : value)}
            disabled={disabled || categoriesLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category..." />
            </SelectTrigger>
            <SelectContent>
              {categories.length === 0 ? (
                <SelectItem value="__none__" disabled>
                  No categories available
                </SelectItem>
              ) : (
                categories.map(category => (
                  <SelectItem key={category.id} value={category.id}>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {category.name}
                      {!category.storageIntegrationId && (
                        <Badge variant="outline" className="text-xs text-amber-600">
                          No storage
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      )}
      
      {/* Storage Warning */}
      {categoryMissingStorage && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>This category doesn&apos;t have storage configured. Files will be stored as metadata only.</span>
        </div>
      )}
      
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={cn(
          "relative border-2 border-dashed rounded-lg transition-colors cursor-pointer",
          compact ? "p-4" : "p-8",
          isDragging 
            ? "border-primary bg-primary/5" 
            : "border-muted-foreground/25 hover:border-muted-foreground/50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={effectiveAccept}
          multiple={multiple}
          onChange={(e) => e.target.files && addFiles(e.target.files)}
          className="hidden"
          disabled={disabled}
        />
        
        <div className={cn(
          "flex flex-col items-center justify-center text-center",
          compact ? "gap-2" : "gap-3"
        )}>
          <div className={cn(
            "rounded-full bg-muted flex items-center justify-center",
            compact ? "h-10 w-10" : "h-12 w-12"
          )}>
            <Upload className={cn("text-muted-foreground", compact ? "h-5 w-5" : "h-6 w-6")} />
          </div>
          <div>
            <p className={cn("font-medium", compact ? "text-sm" : "text-base")}>
              {isDragging ? "Drop files here" : "Drag & drop files here"}
            </p>
            <p className="text-sm text-muted-foreground">
              or click to browse
            </p>
          </div>
          {selectedCategory?.maxFileSize && (
            <p className="text-xs text-muted-foreground">
              Max size: {formatFileSize(selectedCategory.maxFileSize)}
            </p>
          )}
        </div>
      </div>
      
      {/* Pending Files List */}
      {hasPendingFiles && (
        <div className="space-y-2">
          {pendingFiles.map(pf => (
            <Card key={pf.id} className="overflow-hidden">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{pf.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(pf.file.size)}
                    </p>
                    
                    {pf.status === "uploading" && (
                      <Progress value={pf.progress} className="h-1 mt-2" />
                    )}
                    
                    {pf.status === "error" && pf.error && (
                      <p className="text-xs text-destructive mt-1">{pf.error}</p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    {pf.status === "uploading" && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                    {pf.status === "success" && (
                      <Check className="h-4 w-4 text-green-600" />
                    )}
                    {pf.status === "error" && (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                    {(pf.status === "pending" || pf.status === "error") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeFile(pf.id)
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {/* Upload Actions */}
          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" size="sm" onClick={clearAll} disabled={isUploading}>
              Clear All
            </Button>
            <Button 
              size="sm" 
              onClick={uploadAll} 
              disabled={!hasValidPendingFiles || isUploading || !effectiveCategoryId}
            >
              {isUploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Upload {pendingFiles.filter(pf => pf.status === "pending").length} File(s)
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Compact File Upload (for inline use)
// ============================================================================

export function CompactFileUpload(props: Omit<FileUploadProps, "compact">) {
  return <FileUpload {...props} compact />
}
