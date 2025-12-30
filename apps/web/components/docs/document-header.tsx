"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { 
  FileText, 
  Tag, 
  User, 
  Calendar, 
  CheckCircle2,
} from "lucide-react"
import type { DocumentStatus, DocumentCategory } from "@/lib/docs/types"

/**
 * Document Header Props
 */
interface DocumentHeaderProps {
  title: string
  referenceId?: string
  version?: string
  status?: DocumentStatus
  category?: DocumentCategory
  owner?: {
    name: string
    role?: string
    email?: string
  }
  effectiveDate?: string
  approvedBy?: {
    name: string
    role?: string
  }
  approvedAt?: string
  confidentiality?: "public" | "internal" | "confidential" | "restricted"
  tags?: string[]
  className?: string
  /** Optional action buttons to render in the header */
  actions?: React.ReactNode
}

/**
 * Category display labels
 */
const categoryLabels: Record<DocumentCategory, string> = {
  policy: "Policy",
  procedure: "Procedure",
  guideline: "Guideline",
  manual: "Manual",
  template: "Template",
  training: "Training",
  general: "General",
}

/**
 * Document Header Component
 * Displays document title and metadata in a clean, professional layout
 * Matching the reference design with 2-row grid metadata
 */
export function DocumentHeader({
  title,
  referenceId,
  version,
  owner,
  effectiveDate,
  approvedBy,
  className,
  actions,
}: DocumentHeaderProps) {
  // Check if we have any metadata to show
  const hasMetadata = referenceId || version || owner || effectiveDate || approvedBy

  return (
    <div className={cn("mb-6", className)}>
      {/* Title row with optional actions */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {actions}
      </div>
      
      {/* Metadata Box - 2 row grid layout like reference */}
      {hasMetadata && (
        <div className="rounded-lg border bg-card/50 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            {/* Row 1 */}
            {/* Reference ID */}
            {referenceId && (
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Reference:</span>
                <span className="font-semibold">{referenceId}</span>
              </div>
            )}
            
            {/* Version */}
            {version && (
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Version:</span>
                <Badge variant="secondary" className="font-mono text-xs px-2">
                  v{version}
                </Badge>
              </div>
            )}
            
            {/* Owner */}
            {owner && (
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex flex-wrap items-baseline gap-x-1">
                  <span className="text-muted-foreground">Owner:</span>
                  <span className="font-semibold">
                    {owner.role || owner.name}
                    {owner.role && owner.name && ` (${owner.name})`}
                  </span>
                </div>
              </div>
            )}
            
            {/* Row 2 */}
            {/* Effective Date */}
            {effectiveDate && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Effective:</span>
                <span className="font-semibold">
                  {effectiveDate === "[Implementation Date]" 
                    ? effectiveDate 
                    : new Date(effectiveDate).toLocaleDateString()}
                </span>
              </div>
            )}
            
            {/* Approved By */}
            {approvedBy && (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Approved:</span>
                <span className="font-semibold">
                  {approvedBy.role ? `${approvedBy.role} — ` : ""}
                  {approvedBy.name}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
