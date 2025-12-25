"use client"

import { cn } from "@/lib/utils"
import { 
  CheckCircle2, 
  Clock, 
  Circle, 
  XCircle, 
  Pause,
  AlertCircle
} from "lucide-react"

export type StepStatus = "pending" | "in_progress" | "completed" | "skipped" | "blocked"

interface StepStatusBadgeProps {
  status: StepStatus
  size?: "sm" | "md" | "lg"
  showLabel?: boolean
  className?: string
}

const statusConfig: Record<StepStatus, { 
  label: string
  icon: typeof Circle
  className: string
  iconClassName: string
}> = {
  pending: {
    label: "Pending",
    icon: Circle,
    className: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    iconClassName: "text-slate-400",
  },
  in_progress: {
    label: "In Progress",
    icon: Clock,
    className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
    iconClassName: "text-blue-500",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
    iconClassName: "text-emerald-500",
  },
  skipped: {
    label: "Skipped",
    icon: XCircle,
    className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
    iconClassName: "text-amber-500",
  },
  blocked: {
    label: "Blocked",
    icon: AlertCircle,
    className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
    iconClassName: "text-red-500",
  },
}

const sizeConfig = {
  sm: {
    badge: "text-xs px-1.5 py-0.5 gap-1",
    icon: "h-3 w-3",
  },
  md: {
    badge: "text-sm px-2 py-1 gap-1.5",
    icon: "h-4 w-4",
  },
  lg: {
    badge: "text-base px-2.5 py-1.5 gap-2",
    icon: "h-5 w-5",
  },
}

export function StepStatusBadge({ 
  status, 
  size = "md", 
  showLabel = true,
  className 
}: StepStatusBadgeProps) {
  const config = statusConfig[status]
  const sizeClasses = sizeConfig[size]
  const Icon = config.icon
  
  return (
    <span 
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        config.className,
        sizeClasses.badge,
        className
      )}
    >
      <Icon className={cn(sizeClasses.icon, config.iconClassName)} />
      {showLabel && <span>{config.label}</span>}
    </span>
  )
}

/**
 * Icon-only variant for compact displays
 */
export function StepStatusIcon({ 
  status, 
  size = "md",
  className 
}: { 
  status: StepStatus
  size?: "sm" | "md" | "lg"
  className?: string 
}) {
  const config = statusConfig[status]
  const sizeClasses = sizeConfig[size]
  const Icon = config.icon
  
  return (
    <Icon 
      className={cn(sizeClasses.icon, config.iconClassName, className)} 
      aria-label={config.label}
    />
  )
}

/**
 * Instance status badge (slightly different statuses)
 */
export type InstanceStatus = "pending" | "in_progress" | "completed" | "cancelled" | "on_hold"

const instanceStatusConfig: Record<InstanceStatus, { 
  label: string
  icon: typeof Circle
  className: string
  iconClassName: string
}> = {
  pending: {
    label: "Pending",
    icon: Circle,
    className: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    iconClassName: "text-slate-400",
  },
  in_progress: {
    label: "In Progress",
    icon: Clock,
    className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
    iconClassName: "text-blue-500",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
    iconClassName: "text-emerald-500",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
    iconClassName: "text-red-500",
  },
  on_hold: {
    label: "On Hold",
    icon: Pause,
    className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
    iconClassName: "text-amber-500",
  },
}

export function InstanceStatusBadge({ 
  status, 
  size = "md", 
  showLabel = true,
  className 
}: {
  status: InstanceStatus
  size?: "sm" | "md" | "lg"
  showLabel?: boolean
  className?: string
}) {
  const config = instanceStatusConfig[status]
  const sizeClasses = sizeConfig[size]
  const Icon = config.icon
  
  return (
    <span 
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        config.className,
        sizeClasses.badge,
        className
      )}
    >
      <Icon className={cn(sizeClasses.icon, config.iconClassName)} />
      {showLabel && <span>{config.label}</span>}
    </span>
  )
}

