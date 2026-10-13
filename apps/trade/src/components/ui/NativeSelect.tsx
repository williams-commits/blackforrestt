"use client";

import { type SelectHTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Native <select> styled on the repo's shadcn input pattern (token bridge,
 * focus-visible ring, disabled + aria-invalid states). Deliberately NATIVE:
 * these controls ride native form semantics (GET-form filters, SSR default
 * values, mobile OS pickers) that a Radix Select would re-implement — the
 * migration goal here is one consistent control skin, not widget surgery.
 * `className` merges over the defaults via tailwind-merge (h-10, w-full…).
 */
export const NativeSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function NativeSelect({ className, children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        data-slot="native-select"
        className={cn(
          "h-9 w-full min-w-0 cursor-pointer rounded-md border-0 bg-panel-2 px-2 text-sm text-text transition-colors outline-none",
          "hover:bg-panel-3/60 focus-visible:ring-3 focus-visible:ring-ring/35 focus-visible:bg-canvas",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-panel-2/50 disabled:opacity-60",
          "aria-invalid:bg-down/10 aria-invalid:ring-3 aria-invalid:ring-down/25",
          className,
        )}
        {...rest}
      >
        {children}
      </select>
    );
  },
);
