"use client"

/**
 * Audit Field Diff Component
 * 
 * Displays before/after comparison of field values
 */

import { cn } from "@/lib/utils"

interface AuditFieldDiffProps {
  changedFields: string[] | null
  previousValues: Record<string, unknown> | null
  newValues: Record<string, unknown> | null
  className?: string
}

/**
 * Format a value for display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "—"
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No"
  }
  if (value instanceof Date) {
    return value.toLocaleString()
  }
  if (typeof value === "object") {
    return JSON.stringify(value)
  }
  return String(value)
}

/**
 * Format a field name for display (convert camelCase to Title Case)
 */
function formatFieldName(field: string): string {
  return field
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim()
}

export function AuditFieldDiff({
  changedFields,
  previousValues,
  newValues,
  className,
}: AuditFieldDiffProps) {
  if (!changedFields || changedFields.length === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        No fields changed
      </div>
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      {changedFields.map((field) => {
        const prevValue = previousValues?.[field]
        const newValue = newValues?.[field]
        
        return (
          <div key={field} className="border rounded-lg overflow-hidden">
            <div className="bg-muted/50 px-3 py-1.5 border-b">
              <span className="text-sm font-medium">
                {formatFieldName(field)}
              </span>
            </div>
            <div className="grid grid-cols-2 divide-x">
              <div className="p-3">
                <div className="text-xs text-muted-foreground mb-1">Before</div>
                <div className="text-sm font-mono bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 px-2 py-1 rounded break-all">
                  {formatValue(prevValue)}
                </div>
              </div>
              <div className="p-3">
                <div className="text-xs text-muted-foreground mb-1">After</div>
                <div className="text-sm font-mono bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 px-2 py-1 rounded break-all">
                  {formatValue(newValue)}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Compact diff display for table cells
 */
export function AuditFieldDiffCompact({
  changedFields,
  className,
}: {
  changedFields: string[] | null
  className?: string
}) {
  if (!changedFields || changedFields.length === 0) {
    return <span className={cn("text-muted-foreground", className)}>—</span>
  }

  const displayFields = changedFields.slice(0, 3)
  const remaining = changedFields.length - 3

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {displayFields.map((field) => (
        <span
          key={field}
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-muted"
        >
          {formatFieldName(field)}
        </span>
      ))}
      {remaining > 0 && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">
          +{remaining} more
        </span>
      )}
    </div>
  )
}
