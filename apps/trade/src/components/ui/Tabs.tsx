"use client";

import { type ReactNode } from "react";
import { Tabs as TabsPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

export interface Tab {
  key: string;
  label: ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
  right?: ReactNode;
  className?: string;
  label?: string;
  /** underline: content-pane tabs with the brand underline (default).
   *  segmented: dense pill toggle for toolbars/docks — pair with a
   *  bg-panel-2 track container on the consumer side. */
  variant?: "underline" | "segmented";
  /** Extra classes for every trigger (e.g. flex-1 for equal widths). */
  triggerClassName?: string;
}

/*
  Keyboard-accessible inline tab bar on Radix Tabs (roving focus, arrow /
  Home / End navigation). Underline keeps the terminal's dense pane styling;
  segmented replaces the hand-rolled toolbar toggles with the same a11y.
  The public API (tabs/active/onChange/right/label) is unchanged.
*/
export function Tabs({
  tabs,
  active,
  onChange,
  right,
  className = "",
  label = "Sections",
  variant = "underline",
  triggerClassName = "",
}: TabsProps) {
  const segmented = variant === "segmented";
  return (
    <div className={cn("flex items-center", !segmented && "border-b border-border", className)}>
      <TabsPrimitive.Root value={active} onValueChange={onChange} className="min-w-0">
        <TabsPrimitive.List
          aria-label={label}
          className={cn("flex gap-1", !segmented && "overflow-x-auto")}
        >
          {tabs.map((tab) => {
            const selected = active === tab.key;
            return (
              <TabsPrimitive.Trigger
                key={tab.key}
                value={tab.key}
                disabled={tab.disabled}
                data-slot="tab-trigger"
                className={cn(
                  "transition-colors focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-brand",
                  segmented
                    ? cn(
                        "rounded-md px-2.5 py-1 text-(length:--term-text-xs) font-medium",
                        selected
                          ? "bg-canvas text-text shadow-sm"
                          : "text-text-muted hover:text-text",
                      )
                    : cn(
                        "-mb-px border-b-2 px-3.5 py-2.5 text-(length:--term-text-sm)",
                        selected
                          ? "border-brand font-semibold text-text"
                          : "border-transparent font-medium text-text-muted hover:text-text",
                      ),
                  triggerClassName,
                )}
              >
                {tab.label}
              </TabsPrimitive.Trigger>
            );
          })}
        </TabsPrimitive.List>
      </TabsPrimitive.Root>
      {right ? <div className="ml-auto shrink-0 pr-2">{right}</div> : null}
    </div>
  );
}
