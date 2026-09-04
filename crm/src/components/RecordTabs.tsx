"use client";

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
    <div
      className="no-print flex gap-0 border-b"
      style={{ borderColor: "var(--border-default)" }}
      role="tablist"
      aria-label="Record sections"
    >
      {tabs.map((tab) => {
        const active = tab.key === activeTab;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onTabChange(tab.key)}
            className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium transition-colors"
            style={{
              color: active ? "var(--brand-700)" : "var(--text-secondary)",
              borderBottom: active ? "2px solid var(--brand-600)" : "2px solid transparent",
              background: active ? "var(--brand-50)" : "transparent",
              borderTopLeftRadius: "var(--radius-sm)",
              borderTopRightRadius: "var(--radius-sm)",
            }}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 ? (
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                style={{
                  background: active ? "var(--brand-100)" : "var(--gray-100)",
                  color: active ? "var(--brand-700)" : "var(--text-secondary)",
                }}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
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
