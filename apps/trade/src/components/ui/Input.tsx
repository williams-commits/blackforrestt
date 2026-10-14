import * as React from "react"
import { Calendar } from "lucide-react"
import { cn } from "@/lib/utils"

/** Premium filled input — flat tonal field (no border), soft hover, ring on
 *  focus. The same primitive serves every surface via the token bridge.
 *  `startIcon` renders a leading Lucide icon inside the field. */
function Input({ className, type, startIcon, ...props }: React.ComponentProps<"input"> & { startIcon?: React.ReactNode }) {
  if (startIcon) {
    return (
      <div className="relative w-full">
        <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground">
          {startIcon}
        </span>
        <Input className={cn("pl-9", className)} {...props} />
      </div>
    );
  }
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-lg border-0 bg-muted px-3 py-1 text-sm shadow-none transition-[background-color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground",
        "hover:bg-muted/70 focus-visible:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40",
        "placeholder:text-muted-foreground/70 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "aria-invalid:bg-(--term-danger-bg)/40 aria-invalid:ring-[3px] aria-invalid:ring-destructive/30",
        "[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50",
        className
      )}
      {...props}
    />
  )
}

/** Date field with a calendar affordance — filled tonal, consistent heights. */
function DateInput({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <div className="relative w-full">
      <Calendar size={13} strokeWidth={2} aria-hidden className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground" />
      <Input type="date" className={cn("pl-8", className)} {...props} />
    </div>
  )
}

export { Input, DateInput }
