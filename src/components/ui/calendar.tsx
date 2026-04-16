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
        root: "w-full",
        months: "flex flex-col gap-4",
        month: "space-y-3",
        month_caption: "relative flex items-center justify-center pt-1",
        caption_label: "text-sm font-semibold capitalize",
        nav: "flex items-center justify-between gap-2",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 border-border bg-card p-0 text-foreground opacity-100 shadow-sm hover:bg-muted"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 border-border bg-card p-0 text-foreground opacity-100 shadow-sm hover:bg-muted"
        ),
        weekdays: "grid grid-cols-7 gap-1",
        weekday:
          "text-muted-foreground flex h-9 items-center justify-center rounded-md text-[0.72rem] font-semibold uppercase tracking-wide",
        weeks: "mt-1 space-y-1",
        week: "grid grid-cols-7 gap-1",
        day: "h-9 w-9 p-0",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 rounded-md p-0 font-medium aria-selected:opacity-100"
        ),
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        today: "bg-accent text-accent-foreground",
        outside: "text-muted-foreground opacity-40",
        disabled: "text-muted-foreground opacity-40",
        range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className, ...props }) =>
          orientation === "left" ? (
            <ChevronLeft className={cn("h-4 w-4 text-foreground", className)} />
          ) : (
            <ChevronRight className={cn("h-4 w-4 text-foreground", className)} />
          ),
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
