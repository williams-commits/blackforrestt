"use client";

import { type ReactNode } from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/*
  Wrap any inline element with a styled tooltip revealed on hover or focus,
  now powered by Radix (collision-aware placement, Escape dismiss) with the
  same instant-open bubble look. Replaces native title-attribute tooltips,
  which show nothing on many setups (long delay, suppressed hovers, all
  touch devices).
*/
export function Tooltip({
  text,
  children,
  placement = "top",
}: {
  text: string;
  children: ReactNode;
  placement?: "top" | "bottom";
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={0}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          {/* Single wrapper element so ANY children shape works (text,
              fragments, multiple nodes) — Radix's asChild requires exactly
              one element, and call sites pass plain strings. */}
          <span className="inline-flex min-w-0 max-w-full">{children}</span>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={placement}
            sideOffset={6}
            data-slot="tooltip-content"
            className={cn(
              "z-50 w-44 rounded border border-border bg-panel-2 p-2 text-center text-[11px] leading-snug text-text-muted shadow-lg",
              "data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
            )}
          >
            {text}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
