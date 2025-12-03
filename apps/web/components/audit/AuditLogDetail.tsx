"use client"

/**
 * Audit Log Detail Component
 * 
 * Displays detailed information about a single audit log entry
 */

import { useAuditLog } from "@/lib/api/audit"
import { formatDistanceToNow } from "date-fns"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { AuditFieldDiff } from "./AuditFieldDiff"
import { Skeleton } from "@/components/ui/skeleton"
import {
  User,
  Calendar,
  Globe,
  Monitor,
  FileText,
  ArrowRight,
} from "lucide-react"

interface AuditLogDetailProps {
  logId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Get action badge color
 */
function getActionColor(action: string): string {
  switch (action) {
    case "create":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
    case "update":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
    case "delete":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
    case "login":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
    case "logout":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    case "sync":
      return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200"
    default:
      return "bg-muted text-muted-foreground"
  }
}

/**
 * Get initials from name
 */
function getInitials(name: string | null): string {
  if (!name) return "?"
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function AuditLogDetail({
  logId,
  open,
  onOpenChange,
}: AuditLogDetailProps) {
  const { data: log, isLoading } = useAuditLog(logId)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Audit Log Details</SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-4 mt-6">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : log ? (
          <div className="space-y-6 mt-6">
            {/* Action & Entity */}
            <div className="flex items-center gap-3">
              <Badge className={getActionColor(log.action)}>
                {log.action.toUpperCase()}
              </Badge>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="font-medium">{log.entityType}</span>
                {log.entityName && (
                  <span className="text-muted-foreground ml-1">
                    ({log.entityName})
                  </span>
                )}
              </div>
            </div>

            {/* Description */}
            {log.description && (
              <div className="flex items-start gap-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span>{log.description}</span>
              </div>
            )}

            <Separator />

            {/* Actor Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">
                Performed by
              </h3>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  {log.actor?.avatar && (
                    <AvatarImage src={log.actor.avatar} />
                  )}
                  <AvatarFallback>
                    {getInitials(log.actorName || log.actorEmail)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">
                    {log.actorName || "Unknown User"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {log.actorEmail}
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Metadata */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                Details
              </h3>

              <div className="grid gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {new Date(log.timestamp).toLocaleString()}
                    <span className="text-muted-foreground ml-1">
                      ({formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })})
                    </span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>
                    Module: <span className="font-mono">{log.module}</span>
                  </span>
                </div>

                {log.actorIp && (
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span>IP: {log.actorIp}</span>
                  </div>
                )}

                {log.actorUserAgent && (
                  <div className="flex items-start gap-2">
                    <Monitor className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span className="text-xs break-all">
                      {log.actorUserAgent}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Field Changes */}
            {log.changedFields && log.changedFields.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Changes
                  </h3>
                  <AuditFieldDiff
                    changedFields={log.changedFields}
                    previousValues={log.previousValues}
                    newValues={log.newValues}
                  />
                </div>
              </>
            )}

            {/* Entity ID */}
            {log.entityId && (
              <>
                <Separator />
                <div className="text-xs text-muted-foreground">
                  <span>Entity ID: </span>
                  <span className="font-mono">{log.entityId}</span>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-12">
            Audit log not found
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
