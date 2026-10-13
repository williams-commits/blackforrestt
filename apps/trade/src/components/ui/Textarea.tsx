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
          "w-full min-w-0 rounded-md border-0 bg-panel-2 px-3 py-2 text-sm text-text transition-colors outline-none",
          "placeholder:text-text-faint",
          "hover:bg-panel-3/60",
          "focus-visible:ring-3 focus-visible:ring-ring/35 focus-visible:bg-canvas",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-panel-2/50 disabled:opacity-60",
          "aria-invalid:bg-down/10 aria-invalid:ring-3 aria-invalid:ring-down/25",
          className,
        )}
        {...rest}
      />
    );
  },
);
