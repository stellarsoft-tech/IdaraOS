"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Lightbulb } from "lucide-react"

/**
 * Callout variants
 */
type CalloutVariant = "info" | "warning" | "error" | "success" | "tip"

/**
 * Callout Props
 */
interface CalloutProps {
  variant?: CalloutVariant
  title?: string
  children: React.ReactNode
  className?: string
}

/**
 * Variant configurations
 */
const variantConfig: Record<CalloutVariant, { icon: React.ElementType; className: string }> = {
  info: {
    icon: Info,
    className: "border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  warning: {
    icon: AlertTriangle,
    className: "border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
  },
  error: {
    icon: AlertCircle,
    className: "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300",
  },
  success: {
    icon: CheckCircle2,
    className: "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-300",
  },
  tip: {
    icon: Lightbulb,
    className: "border-purple-500/50 bg-purple-500/10 text-purple-700 dark:text-purple-300",
  },
}

/**
 * Callout Component
 * A styled callout box for highlighting important information in documents
 */
export function Callout({ variant = "info", title, children, className }: CalloutProps) {
  const config = variantConfig[variant]
  const Icon = config.icon
  
  return (
    <div
      className={cn(
        "my-4 flex gap-3 rounded-lg border p-4",
        config.className,
        className
      )}
    >
      <Icon className="h-5 w-5 shrink-0 mt-0.5" />
      <div className="flex-1 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        <div className="text-sm [&>p]:mt-0">{children}</div>
      </div>
    </div>
  )
}

