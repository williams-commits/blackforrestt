"use client";

import { type InputHTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  suffix?: string;
}

/**
 * Terminal input on the repo's shadcn input pattern (focus-visible ring,
 * disabled and aria-invalid states, file handling) expressed through the
 * platform token bridge — border-input/ring resolve to the trade palette,
 * with the terminal's compact height and tabular figures kept.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, suffix, ...rest },
  ref,
) {
  return (
    <div className="relative flex items-center" data-slot="input-wrapper">
      <input
        ref={ref}
        data-slot="input"
        className={cn(
          "h-9 w-full min-w-0 rounded-md border-0 bg-panel-2 px-2 text-sm text-text transition-colors outline-none",
          "placeholder:text-text-faint placeholder:text-ellipsis",
          "hover:bg-panel-3/60",
          "focus-visible:ring-3 focus-visible:ring-ring/35 focus-visible:bg-canvas",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-panel-2/50 disabled:opacity-60",
          "aria-invalid:bg-down/10 aria-invalid:ring-3 aria-invalid:ring-down/25",
          "tnum",
          suffix && "pr-12",
          className,
        )}
        {...rest}
      />
      {suffix ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-2 select-none text-xs text-text-muted"
        >
          {suffix}
        </span>
      ) : null}
    </div>
  );
});
