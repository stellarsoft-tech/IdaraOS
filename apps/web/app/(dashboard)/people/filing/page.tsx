"use client"

import { useState } from "react"
import Link from "next/link"
import { 
  Download,
  FileText,
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
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Protected, AccessDenied } from "@/components/primitives/protected"
import { useCanAccess, usePermission } from "@/lib/rbac/context"
import {
  useModuleFiles,
  useDeleteFile,
  downloadFile,
  type FileRecord,
} from "@/lib/api/files"
import { useFileCategoriesList } from "@/lib/api/file-categories"
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

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "Unknown"
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export default function PeopleFilingPage() {
  const canAccess = useCanAccess("filing.files")
  const canCreate = usePermission("filing.files", "create")
  const canDelete = usePermission("filing.files", "delete")
  
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [deletingFile, setDeletingFile] = useState<FileRecord | null>(null)
  
  const { data: filesData, isLoading: filesLoading } = useModuleFiles("people", {
    categoryId: selectedCategory !== "all" ? selectedCategory : undefined,
    search: searchQuery || undefined,
    page,
    limit: 25,
  })
  
  const { data: categories = [], isLoading: categoriesLoading } = useFileCategoriesList({
    moduleScope: "people",
    activeOnly: true,
  })
  
  const deleteMutation = useDeleteFile()
  
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
  
  const clearFilters = () => {
    setSearchQuery("")
    setSelectedCategory("all")
    setPage(1)
  }
  
  const hasActiveFilters = searchQuery || selectedCategory !== "all"
  
  if (!canAccess) {
    return (
      <PageShell title="People Files">
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
      title="People Files" 
      description="Employee documents and HR records"
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
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
              className="pl-9"
            />
          </div>
          
          <Select value={selectedCategory} onValueChange={(v) => { setSelectedCategory(v); setPage(1) }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(category => (
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
        <Card className="py-0 gap-0">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
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
                    : "Upload employee documents to get started"
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
                              {file.entityId && (
                                <Link 
                                  href={`/people/directory/${file.entityId}`}
                                  className="text-xs text-muted-foreground hover:underline"
                                >
                                  View employee →
                                </Link>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {file.category ? (
                            <Badge variant="outline">{file.category.name}</Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">Uncategorized</span>
                          )}
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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Upload People Files</DialogTitle>
            <DialogDescription>
              Upload employee documents, CVs, contracts, etc.
            </DialogDescription>
          </DialogHeader>
          <FileUpload
            moduleScope="people"
            entityType="general"
            entityId="none"
            multiple
            maxFiles={10}
            onUpload={handleUploadComplete}
          />
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation */}
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
