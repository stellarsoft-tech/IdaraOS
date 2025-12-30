"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { CheckCircle2, Clock, History, User } from "lucide-react"

/**
 * Version history entry
 */
interface VersionEntry {
  version: string
  date: string
  author?: string
  changes?: string
  approvedBy?: string
  approvedAt?: string
}

/**
 * Document Footer Props
 */
interface DocumentFooterProps {
  showVersionHistory?: boolean
  versions?: VersionEntry[]
  lastReviewedAt?: string
  nextReviewAt?: string
  approvedBy?: string
  approvedAt?: string
  disclaimer?: string
  className?: string
}

/**
 * Document Footer Component
 * Displays version history, approval info, and disclaimers
 * Can be included in MDX files with <DocumentFooter ... />
 */
export function DocumentFooter({
  showVersionHistory = true,
  versions = [],
  lastReviewedAt,
  nextReviewAt,
  approvedBy,
  approvedAt,
  disclaimer,
  className,
}: DocumentFooterProps) {
  return (
    <div className={cn("mt-12 space-y-6", className)}>
      <Separator />
      
      {/* Approval Info */}
      {(approvedBy || approvedAt) && (
        <div className="flex items-center gap-4 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
          <div>
            <p className="font-medium text-green-700 dark:text-green-300">Document Approved</p>
            <p className="text-sm text-muted-foreground">
              {approvedBy && `Approved by ${approvedBy}`}
              {approvedBy && approvedAt && " on "}
              {approvedAt && new Date(approvedAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      )}
      
      {/* Review Schedule */}
      {(lastReviewedAt || nextReviewAt) && (
        <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1 grid grid-cols-2 gap-4 text-sm">
            {lastReviewedAt && (
              <div>
                <p className="text-muted-foreground">Last Reviewed</p>
                <p className="font-medium">
                  {new Date(lastReviewedAt).toLocaleDateString()}
                </p>
              </div>
            )}
            {nextReviewAt && (
              <div>
                <p className="text-muted-foreground">Next Review Due</p>
                <p className="font-medium">
                  {new Date(nextReviewAt).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Version History */}
      {showVersionHistory && versions.length > 0 && (
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="version-history" className="border rounded-lg">
            <AccordionTrigger className="px-4 hover:no-underline">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4" />
                <span>Version History</span>
                <Badge variant="secondary" className="ml-2">
                  {versions.length} {versions.length === 1 ? "version" : "versions"}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-3">
                {versions.map((entry, index) => (
                  <div
                    key={entry.version}
                    className={cn(
                      "flex gap-4 p-3 rounded-lg",
                      index === 0 ? "bg-primary/5 border border-primary/20" : "bg-muted/30"
                    )}
                  >
                    <div className="shrink-0">
                      <Badge variant={index === 0 ? "default" : "outline"}>
                        v{entry.version}
                      </Badge>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <span>{new Date(entry.date).toLocaleDateString()}</span>
                        {entry.author && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {entry.author}
                            </span>
                          </>
                        )}
                      </div>
                      {entry.changes && (
                        <p className="text-sm">{entry.changes}</p>
                      )}
                      {entry.approvedBy && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Approved by {entry.approvedBy}
                          {entry.approvedAt && ` on ${new Date(entry.approvedAt).toLocaleDateString()}`}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
      
      {/* Disclaimer */}
      {disclaimer && (
        <div className="p-4 rounded-lg bg-muted/30 border">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {disclaimer}
          </p>
        </div>
      )}
    </div>
  )
}

