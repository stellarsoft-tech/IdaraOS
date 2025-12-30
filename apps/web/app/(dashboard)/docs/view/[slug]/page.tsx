"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  CheckCircle,
  FileText,
  Loader2,
  PenLine,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { MDXRenderer, DocumentHeader, DocumentFooter } from "@/components/docs"
import { useDocument, useMyDocuments, useUpdateAcknowledgment } from "@/lib/api/docs"
import { toast } from "sonner"

export default function DocumentViewerPage() {
  const params = useParams()
  const slug = params.slug as string
  
  const { data: docData, isLoading: docLoading } = useDocument(slug)
  const { data: myDocsData, refetch: refetchMyDocs } = useMyDocuments()
  const updateAcknowledgment = useUpdateAcknowledgment()
  
  const [showAckDialog, setShowAckDialog] = React.useState(false)
  const [showSignDialog, setShowSignDialog] = React.useState(false)
  const [signatureConfirmed, setSignatureConfirmed] = React.useState(false)
  const [typedSignature, setTypedSignature] = React.useState("")
  
  const doc = docData?.data
  const myDocs = myDocsData?.data || []
  
  // Find if this document is in the user's pending list
  const myDocRecord = myDocs.find((d) => d.documentSlug === slug)
  const needsAcknowledgment = myDocRecord && ["pending", "viewed"].includes(myDocRecord.acknowledgmentStatus)
  const needsSignature = myDocRecord?.requirement === "required_with_signature"
  
  // Mark as viewed when document loads
  React.useEffect(() => {
    if (myDocRecord && myDocRecord.acknowledgmentStatus === "pending") {
      // Auto-mark as viewed
      updateAcknowledgment.mutate({
        id: myDocRecord.acknowledgmentId!,
        data: { status: "viewed" },
      })
    }
  }, [myDocRecord?.acknowledgmentId])
  
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
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 pb-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/docs">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{doc.title}</h1>
              <p className="text-sm text-muted-foreground">{`v${doc.currentVersion}`}</p>
            </div>
          </div>
        {needsAcknowledgment && (
          <div className="flex items-center gap-2">
            {needsSignature ? (
              <Button onClick={() => setShowSignDialog(true)}>
                <PenLine className="mr-2 h-4 w-4" />
                Sign Document
              </Button>
            ) : (
              <Button onClick={() => setShowAckDialog(true)}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Acknowledge
              </Button>
            )}
          </div>
        )}
        
        {myDocRecord && !needsAcknowledgment && (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">
              {myDocRecord.acknowledgmentStatus === "signed" ? "Signed" : "Acknowledged"}
            </span>
          </div>
        )}
        </div>
      </div>
      
      {/* Pending Action Banner */}
      {needsAcknowledgment && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <FileText className="h-4 w-4 text-yellow-600" />
              </div>
              <div>
                <p className="font-medium">
                  {needsSignature ? "Signature Required" : "Acknowledgment Required"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {myDocRecord.dueDate
                    ? `Please complete by ${new Date(myDocRecord.dueDate).toLocaleDateString()}`
                    : "Please review and acknowledge this document"}
                </p>
              </div>
            </div>
            {needsSignature ? (
              <Button onClick={() => setShowSignDialog(true)}>
                <PenLine className="mr-2 h-4 w-4" />
                Sign Document
              </Button>
            ) : (
              <Button onClick={() => setShowAckDialog(true)}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Acknowledge
              </Button>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Document Content */}
      <Card>
        <CardContent className="p-8">
          {/* Document Header */}
          {doc.showHeader && (
            <DocumentHeader
              title={doc.title}
              version={doc.currentVersion}
              status={doc.status}
              category={doc.category}
              owner={doc.owner || undefined}
              effectiveDate={doc.metadata?.effectiveDate as string}
              confidentiality={doc.metadata?.confidentiality as "public" | "internal" | "confidential" | "restricted"}
              tags={doc.tags || undefined}
            />
          )}
          
          {/* Main Content */}
          <div className="prose prose-neutral dark:prose-invert max-w-none">
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
        </CardContent>
      </Card>
      
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

