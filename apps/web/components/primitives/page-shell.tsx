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
  children,
  action,
  className,
  icon: Icon,
}: PageShellProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-8 w-8 text-muted-foreground" />}
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          </div>
          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
      
      {/* Content - children manage their own spacing */}
      <div className="space-y-6">{children}</div>
    </div>
  )
}

