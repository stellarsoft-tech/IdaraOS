"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * PageShell props
 */
export interface PageShellProps {
  title: string
  description?: string
  children: React.ReactNode
  action?: React.ReactNode
  className?: string
}

/**
 * Standard page shell with header and content container
 * Note: Breadcrumbs are in the global TopBar, not per-page
 */
export function PageShell({
  title,
  description,
  children,
  action,
  className,
}: PageShellProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
      
      {/* Content */}
      <div className="rounded-xl border bg-card">
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

