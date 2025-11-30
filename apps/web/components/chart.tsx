import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

interface ChartProps {
  className?: string
  children?: ReactNode
}

export function Chart({ className, children }: ChartProps) {
  return (
    <div
      className={cn(
        'border/50 bg-background grid min-w-[8rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl',
        className,
      )}
    >
      {children}
    </div>
  )
}
