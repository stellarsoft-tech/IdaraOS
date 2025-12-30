"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Calendar, FileText, Tag, User, CheckCircle2 } from "lucide-react"
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
  /** Compact mode shows only essential metadata in a single row */
  compact?: boolean
}

/**
 * Status badge variant mapping
 */
const statusVariants: Record<DocumentStatus, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "secondary",
  in_review: "outline",
  published: "default",
  archived: "destructive",
}

/**
 * Status display labels
 */
const statusLabels: Record<DocumentStatus, string> = {
  draft: "Draft",
  in_review: "In Review",
  published: "Published",
  archived: "Archived",
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
 * Displays document metadata in a compact horizontal bar
 * Matches the reference design with Reference, Version, Owner, Effective, Approved
 */
export function DocumentHeader({
  title,
  referenceId,
  version,
  status,
  category,
  owner,
  effectiveDate,
  approvedBy,
  approvedAt,
  confidentiality,
  tags,
  className,
  compact = true,
}: DocumentHeaderProps) {
  if (compact) {
    return (
      <div className={cn("mb-6", className)}>
        {/* Title */}
        <h1 className="text-3xl font-bold tracking-tight mb-4">{title}</h1>
        
        {/* Compact Metadata Bar */}
        <div className="rounded-lg border bg-card/50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            {/* Reference ID */}
            {referenceId && (
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Reference:</span>
                <span className="font-medium">{referenceId}</span>
              </div>
            )}
            
            {/* Version */}
            {version && (
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Version:</span>
                <Badge variant="outline" className="font-mono text-xs">
                  v{version}
                </Badge>
              </div>
            )}
            
            {/* Owner */}
            {owner && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Owner:</span>
                <span className="font-medium">
                  {owner.role ? `${owner.role}` : owner.name}
                  {owner.role && owner.name && (
                    <span className="text-muted-foreground"> ({owner.name})</span>
                  )}
                </span>
              </div>
            )}
            
            {/* Effective Date */}
            {effectiveDate && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Effective:</span>
                <span className="font-medium">
                  {effectiveDate === "[Implementation Date]" 
                    ? effectiveDate 
                    : new Date(effectiveDate).toLocaleDateString()}
                </span>
              </div>
            )}
            
            {/* Approved By */}
            {approvedBy && (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Approved:</span>
                <span className="font-medium">
                  {approvedBy.role && `${approvedBy.role} — `}
                  {approvedBy.name}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Full header mode (legacy support)
  return (
    <div className={cn("mb-6 rounded-lg border bg-card p-4", className)}>
      {/* Title and Status Row */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-4 w-4 text-muted-foreground" />
            {category && (
              <Badge variant="outline" className="text-xs">
                {categoryLabels[category] || category}
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        </div>
        <div className="flex flex-col items-end gap-1">
          {status && (
            <Badge variant={statusVariants[status]}>
              {statusLabels[status] || status}
            </Badge>
          )}
          {version && (
            <span className="text-sm text-muted-foreground">
              v{version}
            </span>
          )}
        </div>
      </div>
      
      {/* Metadata Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        {/* Reference ID */}
        {referenceId && (
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground text-xs">Reference</p>
              <p className="font-medium">{referenceId}</p>
            </div>
          </div>
        )}
        
        {/* Owner */}
        {owner && (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground text-xs">Owner</p>
              <p className="font-medium">{owner.name}</p>
              {owner.role && (
                <p className="text-xs text-muted-foreground">{owner.role}</p>
              )}
            </div>
          </div>
        )}
        
        {/* Effective Date */}
        {effectiveDate && (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground text-xs">Effective</p>
              <p className="font-medium">
                {effectiveDate === "[Implementation Date]"
                  ? effectiveDate
                  : new Date(effectiveDate).toLocaleDateString()}
              </p>
            </div>
          </div>
        )}
        
        {/* Approved By */}
        {approvedBy && (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground text-xs">Approved</p>
              <p className="font-medium">{approvedBy.name}</p>
              {approvedBy.role && (
                <p className="text-xs text-muted-foreground">{approvedBy.role}</p>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Tags */}
      {tags && tags.length > 0 && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t">
          <Tag className="h-4 w-4 text-muted-foreground" />
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
