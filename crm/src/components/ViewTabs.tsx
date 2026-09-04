"use client";

import { useState } from "react";

/**
 * Object Home view tabs — the Salesforce-style preset view selector
 * that sits at the top of every list page. Includes preset views
 * (All, My Records, Recently Added, Unassigned) + saved custom views.
 */

export interface ViewOption {
  key: string;
  label: string;
  isSaved?: boolean;
  isPinned?: boolean;
}

export function ViewTabs({
  views,
  activeView,
  onViewChange,
  onNewClick,
  onImportClick,
  onExportClick,
  canCreate,
  canExport,
  totalCount,
}: {
  views: ViewOption[];
  activeView: string;
  onViewChange: (key: string, filter?: Record<string, string>) => void;
  onNewClick?: () => void;
  onImportClick?: () => void;
  onExportClick?: () => void;
  canCreate?: boolean;
  canExport?: boolean;
  totalCount?: number;
}) {
  const [showSaved, setShowSaved] = useState(false);
  const presetViews = views.filter((v) => !v.isSaved);
  const savedViews = views.filter((v) => v.isSaved);

  return (
    <div className="no-print space-y-0">
      {/* ── Action bar ── */}
      <div
        className="flex items-center justify-between border-b pb-3"
        style={{ borderColor: "var(--border-default)" }}
      >
        <div className="flex items-center gap-2">
          {canCreate && onNewClick ? (
            <button type="button" className="btn btn-primary" onClick={onNewClick}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New
            </button>
          ) : null}
          {onImportClick ? (
            <button type="button" className="btn btn-secondary" onClick={onImportClick}>
              Import
            </button>
          ) : null}
          {canExport && onExportClick ? (
            <button type="button" className="btn btn-secondary" onClick={onExportClick}>
              Export
            </button>
          ) : null}
        </div>
        {totalCount !== undefined ? (
          <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
            {totalCount} record{totalCount === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>

      {/* ── View tabs ── */}
      <div className="flex items-center gap-0 pt-1" role="tablist" aria-label="List views">
        {presetViews.map((view) => {
          const active = view.key === activeView;
          return (
            <button
              key={view.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onViewChange(view.key)}
              className="px-3 py-2 text-[13px] font-medium transition-colors"
              style={{
                color: active ? "var(--brand-700)" : "var(--text-secondary)",
                borderBottom: active ? "2px solid var(--brand-600)" : "2px solid transparent",
                background: active ? "var(--brand-50)" : "transparent",
                borderTopLeftRadius: "var(--radius-sm)",
                borderTopRightRadius: "var(--radius-sm)",
              }}
            >
              {view.label}
            </button>
          );
        })}

        {/* Saved views dropdown */}
        {savedViews.length > 0 ? (
          <div className="relative ml-1">
            <button
              type="button"
              onClick={() => setShowSaved((p) => !p)}
              className="flex items-center gap-1 px-3 py-2 text-[13px] font-medium transition-colors"
              style={{
                color: savedViews.some((v) => v.key === activeView) ? "var(--brand-700)" : "var(--text-secondary)",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M3 12h12M3 18h6" />
              </svg>
              Saved Views
            </button>
            {showSaved ? (
              <div
                className="absolute left-0 top-full z-30 mt-1 w-44 rounded-lg border"
                style={{
                  background: "var(--bg-surface)",
                  borderColor: "var(--border-default)",
                  boxShadow: "var(--shadow-dropdown)",
                }}
              >
                {savedViews.map((view) => (
                  <button
                    key={view.key}
                    type="button"
                    onClick={() => {
                      onViewChange(view.key);
                      setShowSaved(false);
                    }}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] hover:bg-[var(--bg-hover)]"
                    style={{
                      color: view.key === activeView ? "var(--brand-700)" : "var(--text-primary)",
                    }}
                  >
                    <span className="truncate">{view.label}</span>
                    {view.isPinned ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 17v5"/><path d="M9 10.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 004 15.24V16h16v-.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 002-2V3H6v1a2 2 0 002 2h1z"/>
                      </svg>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
