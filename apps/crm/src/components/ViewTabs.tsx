"use client";

import { Button } from "@/components/ui";
import { Icon } from "@/components/Icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
  /** Saved-view extras: ownership gates the delete affordance (only the
   *  owner may delete); `owner` labels views shared by someone else. */
  isMine?: boolean;
  owner?: string;
}

export function ViewTabs({
  title,
  views,
  activeView,
  onViewChange,
  onDeleteView,
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
  /** Delete one of the caller's own saved views (confirm flow is the
   *  caller's responsibility — ViewTabs stays a pure selector). */
  onDeleteView?: (key: string) => void;
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
        <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
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

          {/* Saved views dropdown — applying, ownership, and (for the
              owner) deletion live in one menu instead of a second selector
              down in the toolbar. */}
          {savedViews.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex items-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors hover:bg-muted"
                style={{
                  color: savedViews.some((v) => v.key === activeView)
                    ? "var(--text-brand)"
                    : "var(--text-secondary)",
                }}
              >
                <Icon name="bookmark" size={14} />
                Saved Views
                <Icon name="chevron_down" size={12} className="opacity-50" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="text-xs">Saved views</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {savedViews.map((view) => (
                  <DropdownMenuItem
                    key={view.key}
                    onSelect={() => onViewChange(view.key)}
                    className="group/item gap-2 py-2"
                  >
                    <span className="flex w-4 shrink-0 justify-center" aria-hidden>
                      {view.key === activeView ? <Icon name="check" size={13} /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate ${view.key === activeView ? "font-medium text-primary" : ""}`}
                      >
                        {view.label}
                      </span>
                      {view.owner ? (
                        <span className="block truncate text-[11px] text-muted-foreground">
                          shared by {view.owner}
                        </span>
                      ) : null}
                    </span>
                    {view.isPinned ? (
                      <Icon name="pin" size={12} className="shrink-0 text-muted-foreground" />
                    ) : null}
                    {view.isSaved && view.isMine && onDeleteView ? (
                      <button
                        type="button"
                        aria-label={`Delete view “${view.label}”`}
                        onClick={(event) => {
                          // Keep the click from also selecting the menu item.
                          event.stopPropagation();
                          onDeleteView(view.key);
                        }}
                        className="-mr-1 inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 max-sm:opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100"
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    ) : view.isSaved && view.owner ? (
                      <Icon name="users" size={13} className="shrink-0 text-muted-foreground" aria-label="Shared view" />
                    ) : null}
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
