import { cn } from "@/lib/utils"
// ... existing code ...
return (
    <div
      className={cn(
        // <CHANGE> replaced border-border/50 with border/50 for Tailwind v4 compatibility
        'border/50 bg-background grid min-w-[8rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl',
        className,
      )}
    >
// ... existing code ...\
