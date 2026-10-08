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
}

/*
  Keyboard-accessible inline tab bar on Radix Tabs (roving focus, arrow /
  Home / End navigation) with the terminal's dense underline styling.
  The public API (tabs/active/onChange/right/label) is unchanged.
*/
export function Tabs({
  tabs,
  active,
  onChange,
  right,
  className = "",
  label = "Sections",
}: TabsProps) {
  return (
    <div className={cn("flex items-center border-b border-border", className)}>
      <TabsPrimitive.Root value={active} onValueChange={onChange} className="min-w-0">
        <TabsPrimitive.List
          aria-label={label}
          className="flex gap-1 overflow-x-auto"
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
                  "-mb-px border-b-2 px-3.5 py-2.5 text-(length:--term-text-sm) transition-colors focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-brand disabled:opacity-40",
                  selected
                    ? "border-brand font-semibold text-text"
                    : "border-transparent font-medium text-text-muted hover:text-text",
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
