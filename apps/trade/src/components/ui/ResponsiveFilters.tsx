"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export function ResponsiveFilters({
  children,
  className,
  label = "Filter",
  rootClassName,
  triggerClassName,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
  rootClassName?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const contentId = useId();

  return (
    <div className={cn("min-w-0", rootClassName)}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((value) => !value)}
        className={cn("mb-2 h-8 gap-2 md:hidden", triggerClassName)}
      >
        <SlidersHorizontal size={13} strokeWidth={2} aria-hidden />
        {label}
        <ChevronDown
          size={13}
          strokeWidth={2}
          aria-hidden
          className={cn("transition-transform", open && "rotate-180")}
        />
      </Button>
      <div
        id={contentId}
        className={cn(className, open ? "flex" : "hidden", "md:flex")}
      >
        <div className="hidden shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground md:flex">
          <SlidersHorizontal size={16} strokeWidth={2} aria-hidden />
          <span>{label}</span>
        </div>
        {children}
      </div>
    </div>
  );
}
