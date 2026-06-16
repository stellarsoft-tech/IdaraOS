"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, FileText, Loader2, Save } from "lucide-react"

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
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MDXRenderer } from "@/components/docs"
import { useCreateDocument } from "@/lib/api/docs"
import { useAssignableObjectiveOwners } from "@/lib/api/security"
import { documentCategoryLabels, type DocumentCategory } from "@/lib/docs/types"
import { toast } from "sonner"

const defaultContent = `# Document Title

## Purpose

Describe the purpose of this document.

## Scope

Define who this document applies to.

## Content

Add your document content here.

You can use:
- **Bold** and *italic* text
- Lists and tables
- Code blocks
- Mermaid diagrams

## References

- Related documents
- External resources
`

const incidentContent = `# Incident Report

## Summary

Describe what happened, when it was detected, and who reported it.

## Impact

Document affected systems, data, users, services, and business impact.

## Response Actions

### Containment

Describe immediate containment actions.

### Eradication

Describe how the root cause or threat was removed.

### Recovery

Describe service restoration and validation.

## Root Cause

Record the root cause analysis.

## Lessons Learned

Capture improvements required under ISO 27001 A.5.27.

## Linked Evidence

List evidence references, screenshots, files, logs, or external tickets.
`

const incidentSeverityOptions = [
  { value: "p1", label: "P1 — Critical" },
  { value: "p2", label: "P2 — High" },
  { value: "p3", label: "P3 — Medium" },
  { value: "p4", label: "P4 — Low" },
]

const incidentStatusOptions = [
  { value: "draft", label: "Draft" },
  { value: "reported", label: "Reported" },
  { value: "triaging", label: "Triaging" },
  { value: "responding", label: "Responding" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
]

export default function NewDocumentPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const createDocument = useCreateDocument()
  const { data: ownersData } = useAssignableObjectiveOwners()
  const initialCategory =
    searchParams.get("category") === "incident" ? "incident" : "general"
  
  const [title, setTitle] = React.useState("")
  const [slug, setSlug] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [category, setCategory] = React.useState<DocumentCategory>(initialCategory)
  const [content, setContent] = React.useState(initialCategory === "incident" ? incidentContent : defaultContent)
  const [showHeader, setShowHeader] = React.useState(true)
  const [showFooter, setShowFooter] = React.useState(true)
  const [showVersionHistory, setShowVersionHistory] = React.useState(true)
  const [incidentId, setIncidentId] = React.useState("")
  const [incidentClassification, setIncidentClassification] = React.useState<"event" | "incident">("incident")
  const [incidentSeverity, setIncidentSeverity] = React.useState("p3")
  const [incidentStatus, setIncidentStatus] = React.useState("draft")
  const [incidentOwnerId, setIncidentOwnerId] = React.useState("__unassigned__")
  const assignableOwners = ownersData?.data ?? []
  
  // Auto-generate slug from title
  React.useEffect(() => {
    if (title) {
      const generatedSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
      setSlug(generatedSlug)
    }
  }, [title])

  const handleCategoryChange = (value: string) => {
    const nextCategory = value as DocumentCategory
    setCategory(nextCategory)
    if (nextCategory === "incident" && content === defaultContent) {
      setContent(incidentContent)
    }
    if (nextCategory !== "incident" && content === incidentContent) {
      setContent(defaultContent)
    }
  }
  
  const handleSubmit = async (status: "draft" | "published") => {
    if (!title.trim()) {
      toast.error("Title is required")
      return
    }
    
    if (!slug.trim()) {
      toast.error("Slug is required")
      return
    }

    if (category === "incident" && !incidentId.trim()) {
      toast.error("Incident ID is required for incident documents")
      return
    }
    
    try {
      const doc = await createDocument.mutateAsync({
        title,
        slug,
        description: description || undefined,
        category,
        status,
        content,
        showHeader,
        showFooter,
        showVersionHistory,
        currentVersion: "1.0",
        metadata: category === "incident"
          ? {
              referenceId: incidentId,
              incidentId,
              classification: incidentClassification,
              severity: incidentSeverity,
              status: incidentStatus,
              ownerUserId: incidentOwnerId === "__unassigned__" ? undefined : incidentOwnerId,
              confidentiality: "confidential",
              department: "Security",
            }
          : undefined,
      })
      
      toast.success(status === "published" ? "Document published!" : "Document saved as draft")
      router.push(category === "incident" ? "/security/incidents" : `/docs/documents/${doc.slug}`)
    } catch (_error) {
      toast.error("Failed to create document")
    }
  }
  
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
              <h1 className="text-2xl font-semibold tracking-tight">New Document</h1>
              <p className="text-sm text-muted-foreground">Create a new document for your organization.</p>
            </div>
          </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => handleSubmit("draft")}
            disabled={createDocument.isPending}
          >
            {createDocument.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            <Save className="mr-2 h-4 w-4" />
            Save Draft
          </Button>
          <Button
            onClick={() => handleSubmit("published")}
            disabled={createDocument.isPending}
          >
            {createDocument.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            <FileText className="mr-2 h-4 w-4" />
            Publish
          </Button>
        </div>
        </div>
      </div>
      
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Settings Column */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Document Settings</CardTitle>
            <CardDescription>Configure document metadata</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Information Security Policy"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="e.g., information-security-policy"
              />
              <p className="text-xs text-muted-foreground">
                Used in URLs and file names. Lowercase alphanumeric with hyphens.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={category}
                onValueChange={handleCategoryChange}
              >
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(documentCategoryLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {category === "incident" && (
              <>
                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium text-sm">Incident Register Metadata</h4>

                  <div className="space-y-2">
                    <Label htmlFor="incident-id">Incident ID *</Label>
                    <Input
                      id="incident-id"
                      value={incidentId}
                      onChange={(e) => setIncidentId(e.target.value)}
                      placeholder="e.g., INC-001"
                    />
                    <p className="text-xs text-muted-foreground">
                      This ID is used to list the controlled document in Incident Management.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="incident-classification">Classification</Label>
                    <Select
                      value={incidentClassification}
                      onValueChange={(value) => setIncidentClassification(value as "event" | "incident")}
                    >
                      <SelectTrigger id="incident-classification">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="event">Event</SelectItem>
                        <SelectItem value="incident">Incident</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="incident-severity">Severity</Label>
                    <Select value={incidentSeverity} onValueChange={setIncidentSeverity}>
                      <SelectTrigger id="incident-severity">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {incidentSeverityOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="incident-status">Register Status</Label>
                    <Select value={incidentStatus} onValueChange={setIncidentStatus}>
                      <SelectTrigger id="incident-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {incidentStatusOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="incident-owner">Owner</Label>
                    <Select value={incidentOwnerId} onValueChange={setIncidentOwnerId}>
                      <SelectTrigger id="incident-owner">
                        <SelectValue placeholder="Select owner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__unassigned__">Unassigned</SelectItem>
                        {assignableOwners.map((owner) => (
                          <SelectItem key={owner.id} value={owner.id}>
                            {owner.name || owner.email} ({owner.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Lists platform users and updates the Incident Register owner.
                    </p>
                  </div>
                </div>
              </>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this document"
                rows={3}
              />
            </div>
            
            <Separator />
            
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Display Options</h4>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label>Show Header</Label>
                  <p className="text-xs text-muted-foreground">
                    Display metadata header
                  </p>
                </div>
                <Switch
                  checked={showHeader}
                  onCheckedChange={setShowHeader}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label>Show Footer</Label>
                  <p className="text-xs text-muted-foreground">
                    Display approval info
                  </p>
                </div>
                <Switch
                  checked={showFooter}
                  onCheckedChange={setShowFooter}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label>Show Version History</Label>
                  <p className="text-xs text-muted-foreground">
                    Display version history
                  </p>
                </div>
                <Switch
                  checked={showVersionHistory}
                  onCheckedChange={setShowVersionHistory}
                />
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Editor Column */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Content</CardTitle>
            <CardDescription>Write your document in Markdown format</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label>Editor</Label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="font-mono text-sm min-h-[500px]"
                  placeholder="Start writing your document..."
                />
              </div>
              
              <div className="space-y-2">
                <Label>Preview</Label>
                <ScrollArea className="h-[500px] rounded-lg border p-4">
                  {content ? (
                    <MDXRenderer content={content} />
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Start typing to see the preview...
                    </p>
                  )}
                </ScrollArea>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

