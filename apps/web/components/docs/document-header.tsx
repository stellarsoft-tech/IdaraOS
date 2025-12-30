"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Calendar, FileText, Shield, Tag, User } from "lucide-react"
import type { DocumentStatus, DocumentCategory } from "@/lib/docs/types"

/**
 * Document Header Props
 */
interface DocumentHeaderProps {
  title: string
  version?: string
  status?: DocumentStatus
  category?: DocumentCategory
  owner?: {
    name: string
    email?: string
  }
  effectiveDate?: string
  confidentiality?: "public" | "internal" | "confidential" | "restricted"
  tags?: string[]
  className?: string
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
 * Confidentiality badge variants
 */
const confidentialityVariants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  public: "secondary",
  internal: "default",
  confidential: "outline",
  restricted: "destructive",
}

/**
 * Document Header Component
 * Displays document metadata in a styled header component
 * Can be included in MDX files with <DocumentHeader ... />
 */
export function DocumentHeader({
  title,
  version,
  status,
  category,
  owner,
  effectiveDate,
  confidentiality,
  tags,
  className,
}: DocumentHeaderProps) {
  return (
    <div className={cn("mb-8 rounded-lg border bg-card p-6", className)}>
      {/* Title and Status Row */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            {category && (
              <Badge variant="outline" className="text-xs">
                {categoryLabels[category] || category}
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        </div>
        <div className="flex flex-col items-end gap-2">
          {status && (
            <Badge variant={statusVariants[status]}>
              {statusLabels[status] || status}
            </Badge>
          )}
          {version && (
            <span className="text-sm text-muted-foreground">
              Version {version}
            </span>
          )}
        </div>
      </div>
      
      {/* Metadata Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        {/* Owner */}
        {owner && (
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs">
                {owner.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-muted-foreground text-xs">Owner</p>
              <p className="font-medium">{owner.name}</p>
            </div>
          </div>
        )}
        
        {/* Effective Date */}
        {effectiveDate && (
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground text-xs">Effective Date</p>
              <p className="font-medium">
                {new Date(effectiveDate).toLocaleDateString()}
              </p>
            </div>
          </div>
        )}
        
        {/* Confidentiality */}
        {confidentiality && (
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground text-xs">Classification</p>
              <Badge variant={confidentialityVariants[confidentiality]} className="mt-0.5">
                {confidentiality.charAt(0).toUpperCase() + confidentiality.slice(1)}
              </Badge>
            </div>
          </div>
        )}
        
        {/* Tags */}
        {tags && tags.length > 0 && (
          <div className="flex items-start gap-2">
            <Tag className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-muted-foreground text-xs mb-1">Tags</p>
              <div className="flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

