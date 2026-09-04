"use client";

import { useState } from "react";
import { RecordTabs, RecordTabPanel, type RecordTab } from "@/components/RecordTabs";

/**
 * Client-side wrapper that manages tab state for server-rendered record pages.
 * Each tab's content is passed as a React node; only the active tab renders.
 */
export function RecordPageTabs({
  tabs,
  children,
}: {
  tabs: RecordTab[];
  children: React.ReactNode[];
}) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.key ?? "overview");

  return (
    <div className="space-y-4">
      <RecordTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      {tabs.map((tab, index) => (
        <RecordTabPanel key={tab.key} active={tab.key === activeTab}>
          {children[index]}
        </RecordTabPanel>
      ))}
    </div>
  );
}
