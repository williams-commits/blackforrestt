"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Record page tab navigation — the Salesforce-style tab bar that sits
 * between the highlights panel and the content area. Tabs switch the
 * content section without navigating away from the record.
 */

export interface RecordTab {
  key: string;
  label: string;
  count?: number;
}

export function RecordTabs({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: RecordTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
}) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <TabsList
        variant="line"
        aria-label="Record sections"
        className="no-print sticky top-13 z-20 h-auto w-full justify-start gap-0 overflow-x-auto rounded-none bg-(--bg-app) p-0"
      >
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.key}
            value={tab.key}
            className="flex-none gap-1.5 px-4 py-2.5 text-[13px]"
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 ? (
              <span className="rounded-full bg-(--gray-100) px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-(--text-secondary)">
                {tab.count}
              </span>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

/**
 * Tab panel wrapper — renders children only when active.
 */
export function RecordTabPanel({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  if (!active) return null;
  return <div className="animate-fade">{children}</div>;
}
