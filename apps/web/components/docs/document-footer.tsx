"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CheckCircle2, Clock, History } from "lucide-react"

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
 * Displays version history as a table, approval info, and disclaimers
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
    <div className={cn("mt-8 space-y-4", className)}>
      <Separator />
      
      {/* Review Schedule */}
      {(lastReviewedAt || nextReviewAt) && (
        <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            {lastReviewedAt && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Last Reviewed:</span>
                <span className="font-medium">
                  {new Date(lastReviewedAt).toLocaleDateString()}
                </span>
              </div>
            )}
            {nextReviewAt && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Next Review:</span>
                <span className="font-medium">
                  {new Date(nextReviewAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Approval Info */}
      {(approvedBy || approvedAt) && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-sm">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
          <div>
            <span className="font-medium text-green-700 dark:text-green-300">Approved</span>
            <span className="text-muted-foreground">
              {approvedBy && ` by ${approvedBy}`}
              {approvedAt && ` on ${new Date(approvedAt).toLocaleDateString()}`}
            </span>
          </div>
        </div>
      )}
      
      {/* Version History Table */}
      {showVersionHistory && versions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <History className="h-4 w-4" />
            <span>Version History</span>
            <Badge variant="secondary" className="text-xs">
              {versions.length}
            </Badge>
          </div>
          
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[100px]">Version</TableHead>
                  <TableHead className="w-[120px]">Date</TableHead>
                  <TableHead className="w-[150px]">Author</TableHead>
                  <TableHead>Changes</TableHead>
                  <TableHead className="w-[150px]">Approved By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versions.map((entry, index) => (
                  <TableRow 
                    key={entry.version}
                    className={index === 0 ? "bg-primary/5" : ""}
                  >
                    <TableCell>
                      <Badge variant={index === 0 ? "default" : "outline"} className="font-mono">
                        v{entry.version}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(entry.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.author || "—"}
                    </TableCell>
                    <TableCell className="text-sm max-w-[300px]">
                      <span className="line-clamp-2">{entry.changes || "—"}</span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.approvedBy ? (
                        <div>
                          <span>{entry.approvedBy}</span>
                          {entry.approvedAt && (
                            <span className="text-muted-foreground text-xs block">
                              {new Date(entry.approvedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      
      {/* Disclaimer */}
      {disclaimer && (
        <div className="p-3 rounded-lg bg-muted/30 border">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {disclaimer}
          </p>
        </div>
      )}
    </div>
  )
}
