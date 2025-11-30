import type React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const statusBadgeVariants = cva("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", {
  variants: {
    variant: {
      default: "bg-secondary text-secondary-foreground",
      success: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      danger: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      purple: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

interface StatusBadgeProps extends VariantProps<typeof statusBadgeVariants> {
  children: React.ReactNode
  className?: string
}

export function StatusBadge({ children, variant, className }: StatusBadgeProps) {
  return <span className={cn(statusBadgeVariants({ variant }), className)}>{children}</span>
}
