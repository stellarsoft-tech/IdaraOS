"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  Eye,
  FileText,
  Globe,
  History,
  Loader2,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Plus,
  Save,
  Send,
  Settings,
  Shield,
  Tag,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { MDXRenderer } from "@/components/docs"
import { useDocument, useUpdateDocument, useDeleteDocument, useRollouts, useAcknowledgments } from "@/lib/api/docs"
import type { DocumentCategory, DocumentStatus, DocumentVersionWithRelations } from "@/lib/docs/types"
import { toast } from "sonner"

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

export default function DocumentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  
  const { data, isLoading, error, refetch } = useDocument(slug)
  const updateDocument = useUpdateDocument()
  const deleteDocument = useDeleteDocument()
  
  const [isEditing, setIsEditing] = React.useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false)
  const [formData, setFormData] = React.useState<Record<string, unknown>>({})
  const [content, setContent] = React.useState("")
  const [fullscreenMode, setFullscreenMode] = React.useState<"editor" | "preview" | null>(null)
  
  const doc = data?.data
  
  // Load rollouts and acknowledgments
  const { data: rolloutsData } = useRollouts({ documentId: doc?.id })
  const { data: acksData } = useAcknowledgments({ documentId: doc?.id })
  
  const rollouts = rolloutsData?.data || []
  const acknowledgments = acksData?.data || []
  
  // Initialize form data when document loads
  React.useEffect(() => {
    if (doc) {
      setFormData({
        title: doc.title,
        description: doc.description || "",
        category: doc.category,
        status: doc.status,
        currentVersion: doc.currentVersion,
        showHeader: doc.showHeader,
        showFooter: doc.showFooter,
        showVersionHistory: doc.showVersionHistory,
        nextReviewAt: doc.nextReviewAt || "",
        reviewFrequencyDays: doc.reviewFrequencyDays || "",
      })
      setContent(doc.content || "")
    }
  }, [doc])
  
  const handleSave = async () => {
    if (!doc) return
    
    try {
      await updateDocument.mutateAsync({
        id: doc.id,
        data: {
          ...formData,
          content,
        },
      })
      toast.success("Document saved successfully")
      setIsEditing(false)
      refetch()
    } catch (error: unknown) {
      // Try to extract field errors from the API response
      const err = error as { message?: string; details?: { fieldErrors?: Record<string, string[]> } }
      const fieldErrors = err?.details?.fieldErrors
      
      if (fieldErrors && Object.keys(fieldErrors).length > 0) {
        const errorMessages = Object.entries(fieldErrors)
          .map(([field, errors]) => `${field}: ${errors.join(", ")}`)
          .join("\n")
        toast.error("Validation failed", {
          description: errorMessages,
          duration: 5000,
        })
      } else {
        toast.error("Failed to save document", {
          description: err?.message || "Please check your input and try again",
        })
      }
    }
  }
  
  const handlePublish = async () => {
    if (!doc) return
    
    try {
      await updateDocument.mutateAsync({
        id: doc.id,
        data: { status: "published" },
      })
      toast.success("Document published successfully")
      refetch()
    } catch (error) {
      toast.error("Failed to publish document")
    }
  }
  
  const handleDelete = async () => {
    if (!doc) return
    
    try {
      await deleteDocument.mutateAsync(doc.id)
      toast.success("Document deleted successfully")
      router.push("/docs/documents")
    } catch (error) {
      toast.error("Failed to delete document")
    }
  }
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }
  
  if (error || !doc) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <FileText className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Document not found</p>
        <Button asChild>
          <Link href="/docs/documents">Back to Documents</Link>
        </Button>
      </div>
    )
  }
  
  const statusCfg = statusConfig[doc.status]
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 pb-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/docs/documents">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{doc.title}</h1>
                <StatusBadge variant={statusCfg.variant}>{statusCfg.label}</StatusBadge>
              </div>
              <p className="text-sm text-muted-foreground">{`v${doc.currentVersion} • ${categoryLabels[doc.category]}`}</p>
            </div>
          </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/docs/view/${doc.slug}`}>
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </Link>
          </Button>
          
          {doc.status !== "published" && (
            <Button onClick={handlePublish}>
              <Send className="mr-2 h-4 w-4" />
              Publish
            </Button>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsEditing(!isEditing)}>
                <Settings className="mr-2 h-4 w-4" />
                {isEditing ? "Cancel Editing" : "Edit Settings"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Document
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        </div>
      </div>
      
      <Tabs defaultValue="content" className="w-full">
        <TabsList>
          <TabsTrigger value="content">
            <FileText className="mr-1 h-3 w-3" />
            Content
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="mr-1 h-3 w-3" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="rollouts">
            <Users className="mr-1 h-3 w-3" />
            Rollouts ({rollouts.length})
          </TabsTrigger>
          <TabsTrigger value="acknowledgments">
            <CheckCircle className="mr-1 h-3 w-3" />
            Acknowledgments ({doc.acknowledgmentStats?.total || 0})
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="mr-1 h-3 w-3" />
            History
          </TabsTrigger>
        </TabsList>
        
        {/* Content Tab */}
        <TabsContent value="content" className="mt-4">
          {/* Fullscreen Editor */}
          {fullscreenMode === "editor" && (
            <div className="fixed inset-0 z-50 bg-background">
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between p-4 border-b shrink-0">
                  <div>
                    <h2 className="text-lg font-semibold">MDX Editor</h2>
                    <p className="text-sm text-muted-foreground">{doc?.title}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button onClick={handleSave} disabled={updateDocument.isPending}>
                      {updateDocument.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      <Save className="mr-2 h-4 w-4" />
                      Save
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setFullscreenMode(null)}>
                      <Minimize2 className="mr-2 h-4 w-4" />
                      Exit Fullscreen
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="flex-1 font-mono text-sm resize-none rounded-none border-0 focus-visible:ring-0"
                  placeholder="# Document Title&#10;&#10;Start writing your document content here..."
                />
              </div>
            </div>
          )}
          
          {/* Fullscreen Preview */}
          {fullscreenMode === "preview" && (
            <div className="fixed inset-0 z-50 bg-background">
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between p-4 border-b shrink-0">
                  <div>
                    <h2 className="text-lg font-semibold">Document Preview</h2>
                    <p className="text-sm text-muted-foreground">{doc?.title}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setFullscreenMode(null)}>
                    <Minimize2 className="mr-2 h-4 w-4" />
                    Exit Fullscreen
                  </Button>
                </div>
                <div className="flex-1 overflow-auto p-6">
                  <div className="max-w-4xl mx-auto">
                    {content ? (
                      <MDXRenderer content={content} />
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        No content to preview...
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Normal View */}
          <div className={`grid gap-6 lg:grid-cols-2 ${fullscreenMode ? "hidden" : ""}`}>
            {/* Editor */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="text-base">MDX Content</CardTitle>
                  <CardDescription>Edit the document content in MDX format</CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setFullscreenMode("editor")}>
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="font-mono text-sm min-h-[500px]"
                  placeholder="# Document Title

Start writing your document content here...

You can use:
- **Bold** and *italic* text
- Lists and tables
- Code blocks
- Mermaid diagrams with ```mermaid

```mermaid
flowchart LR
    A --> B --> C
```"
                />
                <div className="flex justify-end mt-4">
                  <Button onClick={handleSave} disabled={updateDocument.isPending}>
                    {updateDocument.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            {/* Preview */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="text-base">Preview</CardTitle>
                  <CardDescription>Live preview of the rendered content</CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setFullscreenMode("preview")}>
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="h-[500px] rounded-lg border overflow-auto">
                  <div className="p-4">
                    {content ? (
                      <MDXRenderer content={content} />
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        Start typing to see the preview...
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Settings Tab */}
        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Document Settings</CardTitle>
              <CardDescription>Configure document metadata and display options</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={formData.title as string || ""}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Version</Label>
                  <Input
                    value={formData.currentVersion as string || ""}
                    onChange={(e) => setFormData({ ...formData, currentVersion: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={formData.category as string || ""}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(categoryLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status as string || ""}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusConfig).map(([value, cfg]) => (
                        <SelectItem key={value} value={value}>
                          {cfg.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description as string || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <h4 className="font-medium">Display Options</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Show Header</Label>
                      <p className="text-xs text-muted-foreground">
                        Display document metadata header
                      </p>
                    </div>
                    <Switch
                      checked={formData.showHeader as boolean}
                      onCheckedChange={(checked) => setFormData({ ...formData, showHeader: checked })}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Show Footer</Label>
                      <p className="text-xs text-muted-foreground">
                        Display version history and approval info
                      </p>
                    </div>
                    <Switch
                      checked={formData.showFooter as boolean}
                      onCheckedChange={(checked) => setFormData({ ...formData, showFooter: checked })}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Show Version History</Label>
                      <p className="text-xs text-muted-foreground">
                        Display collapsible version history
                      </p>
                    </div>
                    <Switch
                      checked={formData.showVersionHistory as boolean}
                      onCheckedChange={(checked) => setFormData({ ...formData, showVersionHistory: checked })}
                    />
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Next Review Date</Label>
                  <Input
                    type="date"
                    value={formData.nextReviewAt as string || ""}
                    onChange={(e) => setFormData({ ...formData, nextReviewAt: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Review Frequency (days)</Label>
                  <Input
                    type="number"
                    value={formData.reviewFrequencyDays as string || ""}
                    onChange={(e) => setFormData({ ...formData, reviewFrequencyDays: parseInt(e.target.value) || null })}
                    placeholder="365"
                  />
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={updateDocument.isPending}>
                  {updateDocument.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  <Save className="mr-2 h-4 w-4" />
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Rollouts Tab */}
        <TabsContent value="rollouts" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Rollouts</CardTitle>
                  <CardDescription>
                    Manage who needs to read and acknowledge this document
                  </CardDescription>
                </div>
                <Button asChild>
                  <Link href={`/docs/documents/${doc.slug}/rollouts/new`}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Rollout
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {rollouts.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No rollouts configured</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Add a rollout to assign this document to teams, roles, or users.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rollouts.map((rollout) => (
                    <div
                      key={rollout.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        {rollout.targetType === "organization" && <Globe className="h-4 w-4 text-muted-foreground" />}
                        {rollout.targetType === "team" && <Users className="h-4 w-4 text-muted-foreground" />}
                        {rollout.targetType === "role" && <Shield className="h-4 w-4 text-muted-foreground" />}
                        {rollout.targetType === "user" && <User className="h-4 w-4 text-muted-foreground" />}
                        <div>
                          <p className="font-medium">
                            {rollout.targetName || rollout.targetType}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {rollout.requirement.replace("_", " ")}
                            {rollout.dueDate && ` • Due: ${new Date(rollout.dueDate).toLocaleDateString()}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={rollout.isActive ? "default" : "secondary"}>
                          {rollout.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {rollout.acknowledgedCount || 0}/{rollout.targetCount || 0} acknowledged
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Acknowledgments Tab */}
        <TabsContent value="acknowledgments" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Acknowledgments</CardTitle>
              <CardDescription>
                Track who has viewed and acknowledged this document
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Stats */}
              {doc.acknowledgmentStats && (
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">{doc.acknowledgmentStats.total}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-yellow-500/10">
                    <p className="text-2xl font-bold text-yellow-600">{doc.acknowledgmentStats.pending}</p>
                    <p className="text-xs text-muted-foreground">Pending</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-blue-500/10">
                    <p className="text-2xl font-bold text-blue-600">{doc.acknowledgmentStats.viewed}</p>
                    <p className="text-xs text-muted-foreground">Viewed</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-green-500/10">
                    <p className="text-2xl font-bold text-green-600">
                      {doc.acknowledgmentStats.acknowledged + doc.acknowledgmentStats.signed}
                    </p>
                    <p className="text-xs text-muted-foreground">Completed</p>
                  </div>
                </div>
              )}
              
              {acknowledgments.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No acknowledgments yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {acknowledgments.map((ack) => (
                    <div
                      key={ack.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div>
                        <p className="font-medium">{ack.userName}</p>
                        <p className="text-xs text-muted-foreground">{ack.userEmail}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <StatusBadge
                          variant={
                            ack.status === "signed" || ack.status === "acknowledged"
                              ? "success"
                              : ack.status === "viewed"
                              ? "warning"
                              : "default"
                          }
                        >
                          {ack.status}
                        </StatusBadge>
                        {ack.acknowledgedAt && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(ack.acknowledgedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* History Tab */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Version History</CardTitle>
              <CardDescription>
                Track changes and revisions to this document
              </CardDescription>
            </CardHeader>
            <CardContent>
              {doc.versions && doc.versions.length > 0 ? (
                <div className="space-y-3">
                  {doc.versions.map((version, index) => (
                    <div
                      key={version.id}
                      className={`p-4 rounded-lg border ${index === 0 ? "bg-primary/5 border-primary/20" : ""}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant={index === 0 ? "default" : "outline"}>
                          v{version.version}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(version.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {version.changeSummary && (
                        <p className="text-sm font-medium">{version.changeSummary}</p>
                      )}
                      {version.changeDescription && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {version.changeDescription}
                        </p>
                      )}
                      {version.approvedBy && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Approved by {version.approvedBy.name}
                          {version.approvedAt && ` on ${new Date(version.approvedAt).toLocaleDateString()}`}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No version history yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{doc.title}&quot;? This action cannot be undone.
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

