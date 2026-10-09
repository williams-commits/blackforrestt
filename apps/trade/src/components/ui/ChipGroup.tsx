"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/*
  ChipGroup — the terminal's single-select control for compact option rows
  (chart timeframes, volume/expiry picks, instrument categories, settings
  toggles). One selected style (brand fill) and one unselected style
  (tonal panel chip) replace the four per-screen dialects that had drifted
  apart in radius, weight and hover behavior. Selection state is exposed as
  aria-pressed toggles in a labelled group — honest semantics for filters,
  unlike fake tablists with no tabpanels.
*/

export interface ChipOption<T extends string | number> {
  value: T;
  label: ReactNode;
  /** Optional title/tooltip for abbreviated labels. */
  title?: string;
}

export function ChipGroup<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
  chipClassName,
  size = "md",
}: {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the group (e.g. "Chart timeframe"). */
  ariaLabel: string;
  className?: string;
  chipClassName?: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="group" aria-label={ariaLabel} className={cn("flex items-center gap-1", className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={selected}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={cn(
              "shrink-0 cursor-pointer rounded-md font-medium text-(length:--term-text-xs) transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand",
              size === "sm" ? "h-7 px-2.5" : "h-8 px-3",
              selected
                ? "bg-brand text-white"
                : "bg-panel-2 text-text-muted hover:bg-panel-3 hover:text-text",
              chipClassName,
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
