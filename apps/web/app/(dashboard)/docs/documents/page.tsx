"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Archive,
  CheckCircle,
  Clock,
  Edit,
  Eye,
  FileText,
  Lock,
  MoreHorizontal,
  Pen,
  Plus,
  Trash2,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { useDocuments, useDeleteDocument } from "@/lib/api/docs"
import type { DocumentWithRelations, DocumentCategory, DocumentStatus } from "@/lib/docs/types"
import { toast } from "sonner"
import { usePermission } from "@/lib/rbac/hooks"

const statusConfig: Record<DocumentStatus, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" | "purple" }> = {
  draft: { label: "Draft", variant: "default" },
  in_review: { label: "In Review", variant: "warning" },
  published: { label: "Published", variant: "success" },
  archived: { label: "Archived", variant: "danger" },
}

const categoryLabels: Record<DocumentCategory, string> = {
  policy: "Policy",
  procedure: "Procedure",
  guideline: "Guideline",
  manual: "Manual",
  template: "Template",
  training: "Training",
  general: "General",
}

export default function DocumentsListPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = React.useState("")
  const [categoryFilter, setCategoryFilter] = React.useState<string>(
    searchParams.get("category") || "all"
  )
  const [deleteId, setDeleteId] = React.useState<string | null>(null)
  
  // Check if user has permission to view all documents
  const canViewAll = usePermission("docs.documents", "read_all")
  
  const { data, isLoading, refetch } = useDocuments({
    search: search || undefined,
    category: categoryFilter !== "all" ? categoryFilter as DocumentCategory : undefined,
  })
  
  const deleteDocument = useDeleteDocument()
  
  const documents = data?.data || []
  
  // Show access denied if user doesn't have permission
  if (!canViewAll) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
          <Lock className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold">Access Restricted</h2>
        <p className="text-muted-foreground text-center max-w-md">
          You don&apos;t have permission to view all documents. Please visit{" "}
          <Link href="/docs/my-documents" className="text-primary underline">
            My Documents
          </Link>{" "}
          to see documents assigned to you.
        </p>
        <Button asChild>
          <Link href="/docs/my-documents">Go to My Documents</Link>
        </Button>
      </div>
    )
  }
  
  const handleDelete = async () => {
    if (!deleteId) return
    
    try {
      await deleteDocument.mutateAsync(deleteId)
      toast.success("Document deleted successfully")
      setDeleteId(null)
      refetch()
    } catch (error) {
      toast.error("Failed to delete document")
    }
  }
  
  const groupedByStatus = {
    draft: documents.filter((d) => d.status === "draft"),
    in_review: documents.filter((d) => d.status === "in_review"),
    published: documents.filter((d) => d.status === "published"),
    archived: documents.filter((d) => d.status === "archived"),
  }
  
  return (
    <div className="space-y-6">
      <PageHeader
        title="Document Library"
        description="Manage all organizational documents, policies, and procedures."
      >
        <Button asChild>
          <Link href="/docs/documents/new">
            <Plus className="mr-2 h-4 w-4" />
            New Document
          </Link>
        </Button>
      </PageHeader>
      
      {/* Filters */}
      <div className="flex items-center gap-4">
        <Input
          placeholder="Search documents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.entries(categoryLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Tabs by Status */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">
            All ({documents.length})
          </TabsTrigger>
          <TabsTrigger value="published">
            <CheckCircle className="mr-1 h-3 w-3" />
            Published ({groupedByStatus.published.length})
          </TabsTrigger>
          <TabsTrigger value="in_review">
            <Clock className="mr-1 h-3 w-3" />
            In Review ({groupedByStatus.in_review.length})
          </TabsTrigger>
          <TabsTrigger value="draft">
            <Pen className="mr-1 h-3 w-3" />
            Drafts ({groupedByStatus.draft.length})
          </TabsTrigger>
          <TabsTrigger value="archived">
            <Archive className="mr-1 h-3 w-3" />
            Archived ({groupedByStatus.archived.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="mt-4">
          <DocumentGrid
            documents={documents}
            isLoading={isLoading}
            onDelete={setDeleteId}
          />
        </TabsContent>
        
        <TabsContent value="published" className="mt-4">
          <DocumentGrid
            documents={groupedByStatus.published}
            isLoading={isLoading}
            onDelete={setDeleteId}
          />
        </TabsContent>
        
        <TabsContent value="in_review" className="mt-4">
          <DocumentGrid
            documents={groupedByStatus.in_review}
            isLoading={isLoading}
            onDelete={setDeleteId}
          />
        </TabsContent>
        
        <TabsContent value="draft" className="mt-4">
          <DocumentGrid
            documents={groupedByStatus.draft}
            isLoading={isLoading}
            onDelete={setDeleteId}
          />
        </TabsContent>
        
        <TabsContent value="archived" className="mt-4">
          <DocumentGrid
            documents={groupedByStatus.archived}
            isLoading={isLoading}
            onDelete={setDeleteId}
          />
        </TabsContent>
      </Tabs>
      
      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this document? This action cannot be undone.
              All associated rollouts and acknowledgments will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function DocumentGrid({
  documents,
  isLoading,
  onDelete,
}: {
  documents: DocumentWithRelations[]
  isLoading: boolean
  onDelete: (id: string) => void
}) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2 mt-2" />
            </CardHeader>
            <CardContent>
              <div className="h-3 bg-muted rounded w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }
  
  if (documents.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No documents found</p>
          <Button asChild className="mt-4">
            <Link href="/docs/documents/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Document
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {documents.map((doc) => (
        <DocumentCard key={doc.id} document={doc} onDelete={onDelete} />
      ))}
    </div>
  )
}

function DocumentCard({
  document: doc,
  onDelete,
}: {
  document: DocumentWithRelations
  onDelete: (id: string) => void
}) {
  const config = statusConfig[doc.status]
  
  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <FileText className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
            <div className="min-w-0">
              <CardTitle className="text-base truncate">{doc.title}</CardTitle>
              <CardDescription className="text-xs mt-1">
                v{doc.currentVersion} • {categoryLabels[doc.category]}
              </CardDescription>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/docs/view/${doc.slug}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  View
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/docs/documents/${doc.slug}`}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete(doc.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        {doc.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {doc.description}
          </p>
        )}
        <div className="flex items-center justify-between">
          <StatusBadge variant={config.variant}>{config.label}</StatusBadge>
          {doc.owner && (
            <span className="text-xs text-muted-foreground truncate max-w-[120px]">
              {doc.owner.name}
            </span>
          )}
        </div>
        {doc.rolloutCount && doc.rolloutCount > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            {doc.rolloutCount} active {doc.rolloutCount === 1 ? "rollout" : "rollouts"}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

