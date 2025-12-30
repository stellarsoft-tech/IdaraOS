"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  CheckCircle,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  PenLine,
  Printer,
  List,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { MDXRenderer, DocumentHeader, DocumentFooter, TableOfContents } from "@/components/docs"
import { useDocument, useMyDocuments, useUpdateAcknowledgment } from "@/lib/api/docs"
import { usePermission } from "@/lib/rbac/hooks"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export default function DocumentViewerPage() {
  const params = useParams()
  const slug = params.slug as string
  
  const { data: docData, isLoading: docLoading } = useDocument(slug)
  const { data: myDocsData, refetch: refetchMyDocs } = useMyDocuments()
  const updateAcknowledgment = useUpdateAcknowledgment()
  
  // Permission check for printing
  const canPrint = usePermission("docs.documents", "print")
  
  const [showAckDialog, setShowAckDialog] = React.useState(false)
  const [showSignDialog, setShowSignDialog] = React.useState(false)
  const [signatureConfirmed, setSignatureConfirmed] = React.useState(false)
  const [typedSignature, setTypedSignature] = React.useState("")
  const [isFullscreen, setIsFullscreen] = React.useState(false)
  const [showToc, setShowToc] = React.useState(true)
  
  // Ref for the content container (for ToC heading extraction)
  const contentRef = React.useRef<HTMLDivElement>(null)
  
  const doc = docData?.data
  const myDocs = myDocsData?.data || []
  
  // Find if this document is in the user's pending list
  const myDocRecord = myDocs.find((d) => d.documentSlug === slug)
  const needsAcknowledgment = myDocRecord && ["pending", "viewed"].includes(myDocRecord.acknowledgmentStatus)
  const needsSignature = myDocRecord?.requirement === "required_with_signature"
  
  // Mark as viewed when document loads
  React.useEffect(() => {
    if (myDocRecord && myDocRecord.acknowledgmentStatus === "pending") {
      updateAcknowledgment.mutate({
        id: myDocRecord.acknowledgmentId!,
        data: { status: "viewed" },
      })
    }
  }, [myDocRecord?.acknowledgmentId])
  
  // Handle Escape key for fullscreen
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isFullscreen])
  
  // Handle print
  const handlePrint = () => {
    window.print()
  }
  
  const handleAcknowledge = async () => {
    if (!myDocRecord?.acknowledgmentId) return
    
    try {
      await updateAcknowledgment.mutateAsync({
        id: myDocRecord.acknowledgmentId,
        data: {
          status: "acknowledged",
          versionAcknowledged: doc?.currentVersion,
        },
      })
      toast.success("Document acknowledged successfully")
      setShowAckDialog(false)
      refetchMyDocs()
    } catch (error) {
      toast.error("Failed to acknowledge document")
    }
  }
  
  const handleSign = async () => {
    if (!myDocRecord?.acknowledgmentId || !signatureConfirmed) return
    
    try {
      await updateAcknowledgment.mutateAsync({
        id: myDocRecord.acknowledgmentId,
        data: {
          status: "signed",
          versionAcknowledged: doc?.currentVersion,
          signatureData: {
            method: "typed",
            value: typedSignature,
          },
        },
      })
      toast.success("Document signed successfully")
      setShowSignDialog(false)
      refetchMyDocs()
    } catch (error) {
      toast.error("Failed to sign document")
    }
  }
  
  if (docLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }
  
  if (!doc) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <FileText className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Document not found</p>
        <Button asChild>
          <Link href="/docs">Back to Docs</Link>
        </Button>
      </div>
    )
  }
  
  // Extract metadata for header
  const referenceId = doc.metadata?.referenceId as string | undefined
  const effectiveDate = doc.metadata?.effectiveDate as string | undefined
  const approvedByMeta = doc.metadata?.approvedBy as { name?: string; role?: string } | undefined
  
  // Get the latest version's approver for header
  const latestVersion = doc.versions?.[0]
  // Build approvedBy ensuring name is present (required by DocumentHeader)
  const approvedBy = (() => {
    if (approvedByMeta?.name) {
      return { name: approvedByMeta.name, role: approvedByMeta.role }
    }
    if (latestVersion?.approvedBy?.name) {
      return { name: latestVersion.approvedBy.name, role: undefined }
    }
    return undefined
  })()
  
  return (
    <div
      className={cn(
        "transition-all duration-300",
        isFullscreen && "fixed inset-0 z-50 bg-background overflow-auto p-6"
      )}
    >
      {/* Action Bar */}
      <div className="flex items-center justify-end mb-4 print:hidden">
        <div className="flex items-center gap-1">
          {/* Acknowledgment Status */}
          {myDocRecord && !needsAcknowledgment && (
            <div className="flex items-center gap-1 text-green-600 mr-2 text-sm">
              <CheckCircle className="h-4 w-4" />
              <span>{myDocRecord.acknowledgmentStatus === "signed" ? "Signed" : "Acknowledged"}</span>
            </div>
          )}
          
          {/* Acknowledgment/Sign Button */}
          {needsAcknowledgment && (
            needsSignature ? (
              <Button size="sm" variant="default" onClick={() => setShowSignDialog(true)} className="mr-2">
                <PenLine className="mr-1.5 h-3.5 w-3.5" />
                Sign Document
              </Button>
            ) : (
              <Button size="sm" variant="default" onClick={() => setShowAckDialog(true)} className="mr-2">
                <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                Acknowledge
              </Button>
            )
          )}
          
          {/* ToC Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => setShowToc(!showToc)} className="h-8 w-8">
                {showToc ? <X className="h-4 w-4" /> : <List className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{showToc ? "Hide contents" : "Show contents"}</TooltipContent>
          </Tooltip>
          
          {/* Print Button */}
          {canPrint && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handlePrint} className="h-8 w-8">
                  <Printer className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Print document</TooltipContent>
            </Tooltip>
          )}
          
          {/* Fullscreen Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => setIsFullscreen(!isFullscreen)} className="h-8 w-8">
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isFullscreen ? "Exit fullscreen (Esc)" : "Enter fullscreen"}</TooltipContent>
          </Tooltip>
        </div>
      </div>
      
      {/* Pending Action Banner */}
      {needsAcknowledgment && (
        <Card className="border-yellow-500/50 bg-yellow-500/5 mb-4 print:hidden">
          <CardContent className="flex items-center justify-between py-3 px-4">
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <FileText className="h-3.5 w-3.5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {needsSignature ? "Signature Required" : "Acknowledgment Required"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {myDocRecord.dueDate
                    ? `Due by ${new Date(myDocRecord.dueDate).toLocaleDateString()}`
                    : "Please review and acknowledge"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Main Layout: Content + ToC Sidebar */}
      <div className="flex gap-6">
        {/* Document Content */}
        <div className={cn("flex-1 min-w-0", showToc ? "lg:pr-0" : "")}>
          {/* Document Header - Always shown for proper display */}
          <DocumentHeader
            title={doc.title}
            referenceId={referenceId}
            version={doc.currentVersion}
            owner={doc.owner ? {
              name: doc.owner.name,
              role: doc.metadata?.ownerRole as string | undefined,
            } : undefined}
            effectiveDate={effectiveDate}
            approvedBy={approvedBy}
            showAnchor={true}
          />
          
          {/* Main Content */}
          <div
            ref={contentRef}
            className="prose prose-neutral dark:prose-invert max-w-none prose-headings:scroll-mt-24"
          >
            {doc.content ? (
              <MDXRenderer content={doc.content} />
            ) : (
              <p className="text-muted-foreground">No content available</p>
            )}
          </div>
          
          {/* Document Footer */}
          {doc.showFooter && (
            <DocumentFooter
              showVersionHistory={doc.showVersionHistory}
              versions={doc.versions?.map((v) => ({
                version: v.version,
                date: v.createdAt,
                author: v.createdBy?.name,
                changes: v.changeSummary || v.changeDescription || undefined,
                approvedBy: v.approvedBy?.name,
                approvedAt: v.approvedAt || undefined,
              }))}
              lastReviewedAt={doc.lastReviewedAt || undefined}
              nextReviewAt={doc.nextReviewAt || undefined}
            />
          )}
        </div>
        
        {/* Table of Contents Sidebar */}
        {showToc && (
          <aside className="hidden md:block w-56 lg:w-64 shrink-0 print:hidden">
            <div className="sticky top-6">
              <TableOfContents
                contentRef={contentRef}
                collapsible={false}
              />
            </div>
          </aside>
        )}
      </div>
      
      {/* Acknowledge Dialog */}
      <AlertDialog open={showAckDialog} onOpenChange={setShowAckDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Acknowledge Document</AlertDialogTitle>
            <AlertDialogDescription>
              By clicking acknowledge, you confirm that you have read and understood
              the contents of &quot;{doc.title}&quot; (v{doc.currentVersion}).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAcknowledge}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Acknowledge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Sign Dialog */}
      <AlertDialog open={showSignDialog} onOpenChange={setShowSignDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign Document</AlertDialogTitle>
            <AlertDialogDescription>
              This document requires your electronic signature. Please type your full name
              below to confirm you have read and agree to the contents of &quot;{doc.title}&quot;
              (v{doc.currentVersion}).
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="signature">Type your full name</Label>
              <Textarea
                id="signature"
                value={typedSignature}
                onChange={(e) => setTypedSignature(e.target.value)}
                placeholder="Enter your full name as your signature"
                className="font-script text-lg"
              />
            </div>
            
            <div className="flex items-start gap-2">
              <Checkbox
                id="confirm"
                checked={signatureConfirmed}
                onCheckedChange={(checked) => setSignatureConfirmed(checked as boolean)}
              />
              <Label htmlFor="confirm" className="text-sm text-muted-foreground">
                I confirm that I have read and understood this document and agree to
                comply with its contents. I understand this signature is legally binding.
              </Label>
            </div>
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSign}
              disabled={!signatureConfirmed || !typedSignature.trim()}
            >
              <PenLine className="mr-2 h-4 w-4" />
              Sign Document
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
