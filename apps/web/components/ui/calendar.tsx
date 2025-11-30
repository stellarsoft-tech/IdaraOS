"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4 sm:gap-x-4 sm:gap-y-0",
        month: "flex flex-col gap-4",
        month_caption: "flex justify-center pt-1 relative items-center h-9",
        caption_label: "text-sm font-medium",
        nav: "flex items-center justify-between absolute inset-x-0 z-10",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 rounded-full"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 rounded-full"
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "text-muted-foreground rounded-full w-9 font-normal text-[0.8rem] text-center",
        week: "flex w-full mt-2",
        day: cn(
          "h-9 w-9 text-center text-sm p-0 relative",
          "[&:has([aria-selected].day-range-end)]:rounded-r-full",
          "[&:has([aria-selected].day-range-start)]:rounded-l-full",
          "[&:has([aria-selected].day-outside)]:bg-accent/50",
          "[&:has([aria-selected])]:bg-accent",
          "first:[&:has([aria-selected])]:rounded-l-full",
          "last:[&:has([aria-selected])]:rounded-r-full",
          "focus-within:relative focus-within:z-20"
        ),
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal rounded-full aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground"
        ),
        range_start: "day-range-start rounded-l-full",
        range_end: "day-range-end rounded-r-full",
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-full",
        today: "bg-accent text-accent-foreground rounded-full",
        outside:
          "day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground opacity-50",
        disabled: "text-muted-foreground opacity-50",
        range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight
          return <Icon className="h-4 w-4" />
        },
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
