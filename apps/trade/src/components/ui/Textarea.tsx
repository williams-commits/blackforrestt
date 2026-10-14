"use client";

import { forwardRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Textarea on the repo's shadcn input pattern — same filled-surface styling
 * as ui/Input (bg-panel-2, borderless, focus ring through the token bridge)
 * so every form control in the app shares one visual system.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        data-slot="textarea"
        className={cn(
          "w-full min-w-0 rounded-lg border-0 bg-muted px-3 py-2 text-sm text-foreground transition-[background-color,box-shadow] outline-none",
          "placeholder:text-muted-foreground/70",
          "hover:bg-muted/70",
          "focus-visible:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60",
          "aria-invalid:bg-(--term-danger-bg)/40 aria-invalid:ring-[3px] aria-invalid:ring-destructive/30",
          className,
        )}
        {...rest}
      />
    );
  },
);
