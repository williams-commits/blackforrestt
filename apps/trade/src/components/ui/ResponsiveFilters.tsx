"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export function ResponsiveFilters({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const contentId = useId();

  return (
    <div className="min-w-0">
      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((value) => !value)}
        className="mb-2 h-8 gap-2 md:hidden"
      >
        <SlidersHorizontal size={13} strokeWidth={2} aria-hidden />
        Filter
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
        {children}
      </div>
    </div>
  );
}
