"use client";

import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { RecordTabs, RecordTabPanel, type RecordTab } from "@/components/RecordTabs";
import { useTabSession } from "@/components/useTabSession";

/**
 * Client-side wrapper that manages tab state for server-rendered record pages.
 * Each tab's content is passed as a React node; only the active tab renders.
 *
 * The active tab persists per record (keyed by pathname) in sessionStorage —
 * a refresh or hard refresh reopens the section the user was on; a record
 * never visited in this session starts on its first tab.
 *
 * Deep links win over the session: entry points across the CRM (search hits,
 * notifications) append `?tab=<key>` so a click lands on the exact section
 * containing the matched content. A valid `?tab=` also becomes the persisted
 * state, so the section stays sticky afterwards.
 */
export function RecordPageTabs({
  tabs,
  children,
}: {
  tabs: RecordTab[];
  children: React.ReactNode[];
}) {
  const pathname = usePathname();
  const firstTab = tabs[0]?.key ?? "overview";
  const validKeys = useMemo(() => new Set(tabs.map((tab) => tab.key)), [tabs]);
  const [activeTab, setActiveTab] = useTabSession(
    pathname,
    firstTab,
    (value) => validKeys.has(value),
  );

  // `?tab=` deep link — read once per navigation, straight from the URL
  // (window.location, not useSearchParams: no Suspense boundary needed).
  // Declared AFTER the session-restore effect inside useTabSession, so the
  // deep link wins deterministically over the remembered state.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (requested && validKeys.has(requested)) {
      setActiveTab(requested);
    }
  }, [pathname, validKeys, setActiveTab]);

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
