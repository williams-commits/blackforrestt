"use client";

import { forwardRef } from "react";

import { cn } from "@/lib/utils";

const textareaClasses = [
  "w-full min-w-0 rounded-lg border-0 bg-muted px-3 py-2 text-sm text-foreground transition-[background-color,box-shadow] outline-none",
  "placeholder:text-muted-foreground/70",
  "hover:bg-muted/70",
  "focus-visible:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40",
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60",
  "aria-invalid:bg-(--term-danger-bg)/40 aria-invalid:ring-[3px] aria-invalid:ring-destructive/30",
] as const;

/**
 * Textarea on the repo's shadcn input pattern — same filled-surface styling
 * as ui/Input (bg-muted, borderless, focus ring through the token bridge)
 * so every form control in the app shares one visual system.
 * `startIcon` renders a leading Lucide icon pinned to the first text line,
 * mirroring ui/Input's affordance.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { startIcon?: React.ReactNode }>(
  function Textarea({ className, startIcon, ...rest }, ref) {
    if (startIcon) {
      return (
        <div className="relative w-full">
          <span aria-hidden className="pointer-events-none absolute left-3 top-2.5 z-10 text-muted-foreground">
            {startIcon}
          </span>
          <textarea ref={ref} data-slot="textarea" className={cn(textareaClasses, "pl-9", className)} {...rest} />
        </div>
      );
    }
    return <textarea ref={ref} data-slot="textarea" className={cn(textareaClasses, className)} {...rest} />;
  },
);
