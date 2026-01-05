"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { 
  AlertCircle,
  Download,
  Eye,
  FileText,
  Filter,
  FolderArchive,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"

import { PageShell } from "@/components/primitives/page-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Protected, AccessDenied } from "@/components/primitives/protected"
import { useCanAccess, usePermission } from "@/lib/rbac/context"
import {
  useFilesList,
  useDeleteFile,
  downloadFile,
  type FileRecord,
} from "@/lib/api/files"
import { useFileCategoriesList, MODULE_SCOPE_OPTIONS } from "@/lib/api/file-categories"
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
import { FileUpload } from "@/components/primitives/file-upload"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

// Utility functions
function formatFileSize(bytes: number | null): string {
  if (!bytes) return "Unknown"
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function getFileTypeIcon(mimeType: string | null): string {
  if (!mimeType) return "file"
  if (mimeType.startsWith("image/")) return "image"
  if (mimeType.startsWith("video/")) return "video"
  if (mimeType.startsWith("audio/")) return "audio"
  if (mimeType.includes("pdf")) return "pdf"
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "spreadsheet"
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "presentation"
  if (mimeType.includes("document") || mimeType.includes("word")) return "document"
  if (mimeType.includes("zip") || mimeType.includes("archive") || mimeType.includes("compressed")) return "archive"
  return "file"
}

export default function FilingFilesPage() {
  const canAccess = useCanAccess("filing.files")
  const canCreate = usePermission("filing.files", "create")
  const canDelete = usePermission("filing.files", "delete")
  
  // State
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedModule, setSelectedModule] = useState<string>("all")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [uploadModuleScope, setUploadModuleScope] = useState<string>("people")
  const [deletingFile, setDeletingFile] = useState<FileRecord | null>(null)
  
  // Queries
  const { data: filesData, isLoading: filesLoading } = useFilesList({
    moduleScope: selectedModule !== "all" ? selectedModule : undefined,
    categoryId: selectedCategory !== "all" ? selectedCategory : undefined,
    search: searchQuery || undefined,
    page,
    limit: 25,
  })
  
  const { data: categories = [], isLoading: categoriesLoading } = useFileCategoriesList({ activeOnly: true })
  
  const deleteMutation = useDeleteFile()
  
  // Filtered categories based on selected module
  const filteredCategories = useMemo(() => {
    if (selectedModule === "all") return categories
    return categories.filter(c => c.moduleScope === selectedModule)
  }, [categories, selectedModule])
  
  const handleDelete = async () => {
    if (!deletingFile) return
    try {
      await deleteMutation.mutateAsync(deletingFile.id)
      toast.success("File deleted successfully")
      setDeletingFile(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete file")
    }
  }
  
  const handleDownload = async (file: FileRecord) => {
    try {
      await downloadFile(file.id, file.name)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to download file")
    }
  }
  
  const handleUploadComplete = () => {
    setShowUploadDialog(false)
    toast.success("Files uploaded successfully")
  }
  
  // Reset category when module changes
  const handleModuleChange = (value: string) => {
    setSelectedModule(value)
    setSelectedCategory("all")
    setPage(1)
  }
  
  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value)
    setPage(1)
  }
  
  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setPage(1)
  }
  
  const clearFilters = () => {
    setSearchQuery("")
    setSelectedModule("all")
    setSelectedCategory("all")
    setPage(1)
  }
  
  const hasActiveFilters = searchQuery || selectedModule !== "all" || selectedCategory !== "all"
  
  if (!canAccess) {
    return (
      <PageShell title="All Files">
        <AccessDenied 
          title="Access Denied" 
          description="You don't have permission to view files." 
        />
      </PageShell>
    )
  }
  
  const isLoading = filesLoading || categoriesLoading
  const files = filesData?.data ?? []
  const pagination = filesData?.pagination ?? { page: 1, limit: 25, total: 0, totalPages: 0 }
  
  return (
    <PageShell 
      title="All Files" 
      description="Browse and manage files across all modules"
      action={
        canCreate && (
          <Button onClick={() => setShowUploadDialog(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Files
          </Button>
        )
      }
    >
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Select value={selectedModule} onValueChange={handleModuleChange}>
            <SelectTrigger className="w-[180px]">
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
          
          <Select value={selectedCategory} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {filteredCategories.map(category => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {hasActiveFilters && (
            <Button variant="ghost" onClick={clearFilters} className="shrink-0">
              <X className="h-4 w-4 mr-2" />
              Clear
            </Button>
          )}
        </div>
        
        {/* Files Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : files.length === 0 ? (
              <div className="text-center py-12">
                <FolderArchive className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="font-medium">
                  {hasActiveFilters ? "No files found" : "No files yet"}
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  {hasActiveFilters 
                    ? "Try adjusting your filters"
                    : "Upload files to get started"
                  }
                </p>
                {canCreate && !hasActiveFilters && (
                  <Button onClick={() => setShowUploadDialog(true)}>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Files
                  </Button>
                )}
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40%]">Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Module</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {files.map((file) => (
                      <TableRow key={file.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
                              <FileText className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{file.name}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {file.originalName !== file.name && file.originalName}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {file.category ? (
                            <Badge variant="outline">
                              {file.category.name}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">Uncategorized</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {MODULE_SCOPE_OPTIONS.find(m => m.value === file.moduleScope)?.label || file.moduleScope}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {formatFileSize(file.size)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{formatDistanceToNow(new Date(file.createdAt), { addSuffix: true })}</p>
                            {file.uploadedBy && (
                              <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                                by {file.uploadedBy.name || file.uploadedBy.email}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleDownload(file)}>
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </DropdownMenuItem>
                              {file.entityType && file.entityId && (
                                <DropdownMenuItem asChild>
                                  <Link href={`/${file.moduleScope}/directory/${file.entityId}`}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    View Entity
                                  </Link>
                                </DropdownMenuItem>
                              )}
                              {canDelete && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => setDeletingFile(file)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <p className="text-sm text-muted-foreground">
                      Showing {((pagination.page - 1) * pagination.limit) + 1} to{" "}
                      {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                      {pagination.total} files
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={pagination.page === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm">
                        Page {pagination.page} of {pagination.totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                        disabled={pagination.page === pagination.totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Upload Files</DialogTitle>
            <DialogDescription>
              Select a module and category, then upload your files.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Module</label>
              <Select value={uploadModuleScope} onValueChange={setUploadModuleScope}>
                <SelectTrigger>
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
            </div>
            
            <FileUpload
              moduleScope={uploadModuleScope as "people" | "assets" | "workflows" | "security" | "docs" | "vendors"}
              entityType="general"
              entityId="none"
              multiple
              maxFiles={10}
              onUpload={handleUploadComplete}
            />
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingFile} onOpenChange={(open) => !open && setDeletingFile(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete File</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deletingFile?.name}&quot;? This action cannot be undone.
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
    </PageShell>
  )
}
