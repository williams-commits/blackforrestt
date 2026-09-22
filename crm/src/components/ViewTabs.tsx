"use client";

import { Button } from "@/components/ui";
import { Icon } from "@/components/Icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  title,
  views,
  activeView,
  onViewChange,
  onNewClick,
  onImportClick,
  onExportClick,
  canCreate,
  canExport,
  totalCount,
  showHeader = true,
}: {
  title: string;
  views: ViewOption[];
  activeView: string;
  onViewChange: (key: string, filter?: Record<string, string>) => void;
  onNewClick?: () => void;
  onImportClick?: () => void;
  onExportClick?: () => void;
  canCreate?: boolean;
  canExport?: boolean;
  totalCount?: number;
  showHeader?: boolean;
}) {
  const presetViews = views.filter((v) => !v.isSaved);
  const savedViews = views.filter((v) => v.isSaved);

  return (
    <div className="no-print space-y-0">
      {/* ── Action bar ── */}
      {showHeader ? (
        <div className="flex flex-col gap-3 border-b border-(--border-default) pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-(--text-primary)">
              {title}
            </h1>
            <p className="mt-0.5 text-xs text-(--text-tertiary)">
              {totalCount ?? 0} record{totalCount === 1 ? "" : "s"} in your view
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canCreate && onNewClick ? (
              <Button variant="primary" icon="plus" onClick={onNewClick}>
                New {title.endsWith("s") ? title.slice(0, -1) : title}
              </Button>
            ) : null}
            {onImportClick ? (
              <Button variant="secondary" icon="upload" onClick={onImportClick}>
                Import
              </Button>
            ) : null}
            {canExport && onExportClick ? (
              <Button variant="secondary" icon="download" onClick={onExportClick}>
                Export
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* ── View tabs ── */}
      <Tabs value={activeView} onValueChange={(key) => onViewChange(key)}>
        <div className="flex items-center gap-1 overflow-x-auto pt-1">
          <TabsList
            variant="line"
            aria-label="List views"
            className="h-auto w-fit justify-start gap-0 p-0"
          >
            {presetViews.map((view) => (
              <TabsTrigger
                key={view.key}
                value={view.key}
                className="flex-none px-3 py-2 text-[13px]"
              >
                {view.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Saved views dropdown */}
          {savedViews.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex items-center gap-1 px-3 py-2 text-[13px] font-medium transition-colors"
                style={{
                  color: savedViews.some((v) => v.key === activeView)
                    ? "var(--text-brand)"
                    : "var(--text-secondary)",
                }}
              >
                <Icon name="list" size={14} />
                Saved Views
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                {savedViews.map((view) => (
                  <DropdownMenuItem
                    key={view.key}
                    onSelect={() => onViewChange(view.key)}
                    className={view.key === activeView ? "text-(--text-brand)" : ""}
                  >
                    <span className="truncate">{view.label}</span>
                    {view.isPinned ? <Icon name="pin" size={12} /> : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </Tabs>
    </div>
  );
}
