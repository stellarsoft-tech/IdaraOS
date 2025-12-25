"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

/**
 * PageShell props
 */
export interface PageShellProps {
  title: string
  description?: string
  /** Status badge to display inline after the title */
  statusBadge?: React.ReactNode
  /** Back button to display before the title */
  backButton?: React.ReactNode
  /** Use compact layout with smaller title and reduced spacing */
  compact?: boolean
  children: React.ReactNode
  action?: React.ReactNode
  className?: string
  icon?: LucideIcon
}

/**
 * Standard page shell with header and content container
 * Note: Breadcrumbs are in the global TopBar, not per-page
 */
export function PageShell({
  title,
  description,
  statusBadge,
  backButton,
  compact = false,
  children,
  action,
  className,
  icon: Icon,
}: PageShellProps) {
  return (
    <div className={cn(compact ? "space-y-4" : "space-y-6", className)}>
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            {backButton}
            {Icon && <Icon className={cn(compact ? "h-6 w-6" : "h-8 w-8", "text-muted-foreground")} />}
            <h1 className={cn(
              "font-bold tracking-tight",
              compact ? "text-2xl" : "text-3xl"
            )}>{title}</h1>
            {statusBadge}
          </div>
          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
      
      {/* Content - children manage their own spacing */}
      <div className={cn(compact ? "space-y-4" : "space-y-6")}>{children}</div>
    </div>
  )
}

