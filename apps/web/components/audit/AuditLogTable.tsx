"use client"

/**
 * Audit Log Table Component
 * 
 * Reusable table for displaying audit logs with filtering
 */

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import type { AuditLogEntry, AuditLogFilters } from "@/lib/audit"
import { getAuditLogsExportUrl } from "@/lib/api/audit"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { AuditFieldDiffCompact } from "./AuditFieldDiff"
import { AuditLogDetail } from "./AuditLogDetail"
import {
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface AuditLogTableProps {
  logs: AuditLogEntry[]
  total: number
  isLoading: boolean
  filters: AuditLogFilters
  onFiltersChange: (filters: AuditLogFilters) => void
  onRefresh?: () => void
}

/**
 * Get action badge color
 */
function getActionColor(action: string): string {
  switch (action) {
    case "create":
      return "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
    case "update":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
    case "delete":
      return "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
    case "login":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300"
    case "logout":
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
    case "sync":
      return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300"
    default:
      return "bg-muted text-muted-foreground"
  }
}

const ACTIONS = [
  { value: "", label: "All Actions" },
  { value: "create", label: "Create" },
  { value: "update", label: "Update" },
  { value: "delete", label: "Delete" },
  { value: "login", label: "Login" },
  { value: "logout", label: "Logout" },
  { value: "sync", label: "Sync" },
]

const PAGE_SIZE = 20

export function AuditLogTable({
  logs,
  total,
  isLoading,
  filters,
  onFiltersChange,
  onRefresh,
}: AuditLogTableProps) {
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const page = Math.floor((filters.offset ?? 0) / PAGE_SIZE) + 1
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const handleSearch = (search: string) => {
    onFiltersChange({ ...filters, search: search || undefined, offset: 0 })
  }

  const handleActionFilter = (action: string) => {
    onFiltersChange({ ...filters, action: action || undefined, offset: 0 })
  }

  const handlePageChange = (newPage: number) => {
    onFiltersChange({ ...filters, offset: (newPage - 1) * PAGE_SIZE })
  }

  const handleViewDetails = (log: AuditLogEntry) => {
    setSelectedLogId(log.id)
    setDetailOpen(true)
  }

  const exportUrl = getAuditLogsExportUrl({ ...filters, format: "csv" })

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email..."
            className="pl-9"
            defaultValue={filters.search ?? ""}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        <Select
          value={filters.action ?? ""}
          onValueChange={handleActionFilter}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Actions" />
          </SelectTrigger>
          <SelectContent>
            {ACTIONS.map((action) => (
              <SelectItem key={action.value} value={action.value}>
                {action.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 ml-auto">
          {onRefresh && (
            <Button variant="outline" size="icon" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <a href={exportUrl} download>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </a>
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Changes</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                </TableRow>
              ))
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <div className="text-muted-foreground">
                    No audit logs found
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">
                    <div className="text-sm">
                      {new Date(log.timestamp).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn("font-medium", getActionColor(log.action))}>
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{log.entityType}</div>
                    {log.entityName && (
                      <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                        {log.entityName}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm truncate max-w-[180px]">
                      {log.actorName || log.actorEmail}
                    </div>
                    {log.actorName && (
                      <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                        {log.actorEmail}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <AuditFieldDiffCompact
                      changedFields={log.changedFields}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleViewDetails(log)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {Math.min((filters.offset ?? 0) + 1, total)} to{" "}
            {Math.min((filters.offset ?? 0) + PAGE_SIZE, total)} of {total} entries
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={page === 1}
              onClick={() => handlePageChange(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={page === totalPages}
              onClick={() => handlePageChange(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Sheet */}
      <AuditLogDetail
        logId={selectedLogId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  )
}
