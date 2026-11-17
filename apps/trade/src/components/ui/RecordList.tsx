"use client";

import * as React from "react";
import { Activity, ArrowDown, ArrowLeftRight, ArrowUp, ArrowUpDown, ArrowRight, BookOpenText, CandlestickChart, ChevronDown, ChevronRight, ClipboardCheck, CreditCard, Inbox, LifeBuoy, List, LockKeyhole, Search, ScrollText, ShieldAlert, SlidersHorizontal, Sparkles, UserRound, Users, UsersRound, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/Input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Skeleton";
import { IdentityTile } from "@/components/ui/Initial";
import { ResponsiveFilters } from "@/components/ui/ResponsiveFilters";

const RECORD_TITLE_ICONS: Record<string, LucideIcon> = {
  "Closed Trades": CandlestickChart,
  Members: UsersRound,
  "Payment queue": CreditCard,
  "Position History": CandlestickChart,
  "Active blocks": LockKeyhole,
  Cases: LifeBuoy,
  "Recent runs": Activity,
  Accounts: Users,
  "Transaction history": ArrowLeftRight,
  Postings: BookOpenText,
  "Positions by user": UsersRound,
  Symbols: CandlestickChart,
  Rules: ShieldAlert,
  Events: ScrollText,
  "Change requests": ClipboardCheck,
  "Payment requests": CreditCard,
  Transactions: ArrowLeftRight,
  "Your support cases": LifeBuoy,
  "Recent decisions": ClipboardCheck,
  "Referral History": UserRound,
};

/* ────────────────────────────────────────────────────────────────────────────
   RecordList — the account portal's centralized enterprise record list.

   One component drives every record surface (positions, transactions,
   payments, reports, referrals, support cases) with a consistent contract:

   • Card frame with title/description and a structured filter row
     (search pill + caller-composed chips/selects + trailing actions).
   • Sortable columns (tonal, icon-annotated, honest aria labels).
   • Master–detail: a row opens a right slide-over (shadcn Sheet) with a
     summary hero and label/value metadata rows — no page navigation.
   • Load more (client-side windowing over the rows you pass, or controlled
     via hasMore/onLoadMore for server-fed lists).
   • Flat tonal styling: no hairlines — the header band and zebra come from
   the .account-flat scope in globals.css.
   ──────────────────────────────────────────────────────────────────────── */

export interface RecordColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  align?: "left" | "right";
  /** Cell renderer; defaults to sortValue/stringified. */
  render?: (row: T) => React.ReactNode;
  className?: string;
}

export interface RecordDetailMeta {
  label: string;
  value: React.ReactNode;
}

export interface RecordSearchSuggestion {
  value: string;
  label: string;
  category: string;
  detail?: string;
}

export function RecordSearchInput<T>({
  ariaLabel,
  placeholder,
  value,
  onChange,
  rows,
  text,
  suggestions,
  iconPosition = "end",
  className,
  inputClassName,
}: {
  ariaLabel: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  rows: readonly T[];
  text: (row: T) => string;
  suggestions?: RecordSearchSuggestion[];
  iconPosition?: "start" | "end";
  className?: string;
  inputClassName?: string;
}) {
  const [suggestionsOpen, setSuggestionsOpen] = React.useState(false);
  const [activeSuggestion, setActiveSuggestion] = React.useState(-1);
  const suggestionsId = React.useId();
  const searchSuggestions = React.useMemo(() => {
    if (suggestions !== undefined) return suggestions;
    const needle = value.trim().toLowerCase();
    if (!needle) return [];

    const candidates = new Map<string, RecordSearchSuggestion>();
    for (const row of rows) {
      const tokens = text(row).match(/[\p{L}\p{N}_@./:+-]+/gu) ?? [];
      for (let start = 0; start < tokens.length; start += 1) {
        for (let length = 1; length <= 3 && start + length <= tokens.length; length += 1) {
          const value = tokens.slice(start, start + length).join(" ");
          const key = value.toLowerCase();
          if (key.includes(needle) && !candidates.has(key)) {
            candidates.set(key, { value, label: value, category: "Record match" });
          }
        }
      }
    }

    return [...candidates.values()]
      .sort((a, b) => {
        const aPrefix = a.value.toLowerCase().startsWith(needle) ? 0 : 1;
        const bPrefix = b.value.toLowerCase().startsWith(needle) ? 0 : 1;
        return aPrefix - bPrefix || a.value.length - b.value.length || a.label.localeCompare(b.label);
      })
      .slice(0, 8);
  }, [rows, suggestions, text, value]);
  const showSuggestions = suggestionsOpen && Boolean(value.trim());

  const selectSuggestion = (suggestion: RecordSearchSuggestion) => {
    onChange(suggestion.value);
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
  };

  return (
    <div className={cn("relative w-full min-w-0", className)}>
      <Search
        size={14}
        strokeWidth={2}
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground",
          iconPosition === "start" ? "left-3" : "right-3",
        )}
      />
      <Input
        type="search"
        value={value}
        role="combobox"
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-expanded={showSuggestions}
        aria-controls={showSuggestions ? suggestionsId : undefined}
        aria-activedescendant={
          showSuggestions && activeSuggestion >= 0 && activeSuggestion < searchSuggestions.length
            ? `${suggestionsId}-option-${activeSuggestion}`
            : undefined
        }
        onFocus={() => setSuggestionsOpen(true)}
        onClick={() => setSuggestionsOpen(true)}
        onBlur={() => setSuggestionsOpen(false)}
        onChange={(event) => {
          onChange(event.target.value);
          setSuggestionsOpen(true);
          setActiveSuggestion(-1);
        }}
        onKeyDown={(event) => {
          if (!searchSuggestions.length) {
            if (event.key === "Escape" && showSuggestions) setSuggestionsOpen(false);
            return;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setSuggestionsOpen(true);
            setActiveSuggestion((current) => (current + 1) % searchSuggestions.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setSuggestionsOpen(true);
            setActiveSuggestion((current) => current <= 0 ? searchSuggestions.length - 1 : current - 1);
          } else if (event.key === "Enter" && showSuggestions && activeSuggestion >= 0 && activeSuggestion < searchSuggestions.length) {
            event.preventDefault();
            selectSuggestion(searchSuggestions[activeSuggestion]);
          } else if (event.key === "Escape" && showSuggestions) {
            event.preventDefault();
            setSuggestionsOpen(false);
            setActiveSuggestion(-1);
          }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cn(
          "h-9",
          iconPosition === "start" ? "pl-9 pr-3" : "pl-3 pr-9",
          inputClassName,
        )}
      />
      {showSuggestions && (
        <div
          id={suggestionsId}
          role="listbox"
          aria-label="Search suggestions"
          className="absolute inset-x-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-xl bg-popover p-1.5 text-popover-foreground shadow-lg ring-1 ring-border/60"
        >
          <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground">
            <Sparkles size={13} aria-hidden />
            Suggested matches
            <span className="ml-auto tabular-nums">{searchSuggestions.length}</span>
          </div>
          {searchSuggestions.length > 0 ? (
            <>
              {searchSuggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion.category}:${suggestion.value}`}
                  id={`${suggestionsId}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={activeSuggestion === index}
                  onPointerDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveSuggestion(index)}
                  onClick={() => selectSuggestion(suggestion)}
                  className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left outline-none transition-colors hover:bg-accent focus-visible:bg-accent aria-selected:bg-accent"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{suggestion.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {suggestion.category}{suggestion.detail ? ` · ${suggestion.detail}` : ""}
                    </span>
                  </span>
                  <ArrowRight size={14} aria-hidden className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-aria-selected:opacity-100" />
                </button>
              ))}
              <div className="px-3 py-2 text-[11px] text-muted-foreground">
                Select a match to apply search
              </div>
            </>
          ) : (
            <div className="px-3 py-3 text-sm text-muted-foreground">
              No matching suggestions. Your search still filters records.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export interface RecordLeading {
  /** Tinted identity tile (icon, initials, instrument mark). */
  icon?: React.ReactNode;
  tone?: "up" | "down" | "brand" | "warn" | "muted";
  title: React.ReactNode;
  secondary?: React.ReactNode;
}

export function RecordList<T>({
  ariaLabel,
  title,
  count,
  description,
  rows,
  rowKey,
  leading,
  columns,
  sortValue,
  initialSort,
  search,
  filters,
  toolbarEnd,
  detailTitle,
  renderDetailHero,
  renderDetailMeta,
  renderDetailExtra,
  pageSize = 8,
  hasMore,
  onLoadMore,
  loading = false,
  loadingMore = false,
  storageKey,
  emptyTitle = "Nothing here yet",
  emptyHint,
  emptyIcon,
  onRowActivate,
  mobilePrimary,
  sheetWidth = "sm:max-w-lg",
  className,
}: {
  ariaLabel: string;
  title: string;
  count?: React.ReactNode;
  description?: React.ReactNode;
  rows: T[];
  rowKey: (row: T) => string;
  /** Leading two-line identity cell. */
  leading: (row: T) => RecordLeading;
  columns: RecordColumn<T>[];
  /** Comparable extractor for sorting (numbers compare numerically). */
  sortValue: (row: T, key: string) => string | number;
  initialSort?: { key: string; direction: "asc" | "desc" };
  /** When provided, renders a search pill; value/onChange enable remote-controlled search. */
  search?: {
    placeholder: string;
    text: (row: T) => string;
    value?: string;
    onChange?: (value: string) => void;
    suggestions?: RecordSearchSuggestion[];
  };
  /** Caller-composed filter controls — rendered after the search pill. */
  filters?: React.ReactNode;
  /** Trailing toolbar slot (CSV export, counters). */
  toolbarEnd?: React.ReactNode;
  /** Required for the built-in slide-over detail; omit when onRowActivate drives it. */
  detailTitle?: string;
  /** Detail hero: big value + supporting identity above the metadata. */
  renderDetailHero?: (row: T) => React.ReactNode;
  /** Detail metadata rows (label → value). */
  renderDetailMeta?: (row: T) => RecordDetailMeta[];
  /** Extra detail content below metadata (actions, grids, notes). */
  renderDetailExtra?: (row: T) => React.ReactNode;
  pageSize?: number;
  /** Controlled mode for server-fed lists: shows Load more when true. */
  hasMore?: boolean;
  onLoadMore?: () => void;
  /** Initial load — skeletons instead of the empty state. */
  loading?: boolean;
  loadingMore?: boolean;
  /** Persist list search and sorting preferences in localStorage. */
  storageKey?: string;
  emptyTitle?: string;
  emptyHint?: string;
  emptyIcon?: React.ReactNode;
  /** Optional override instead of the slide-over detail. */
  onRowActivate?: (row: T) => void;
  /** Concise right-hand metric shown on phones (defaults to the last
   *  right-aligned column). */
  mobilePrimary?: (row: T) => React.ReactNode;
  /** Detail slide-over width — Tailwind max-width class. */
  sheetWidth?: string;
  className?: string;
}) {
  const [sort, setSort] = React.useState<{ key: string; direction: "asc" | "desc" }>(
    initialSort ?? { key: columns[0]?.key ?? "", direction: "desc" },
  );
  const [query, setQuery] = React.useState("");
  const [visible, setVisible] = React.useState(pageSize);
  const [detailKey, setDetailKey] = React.useState<string | null>(null);
  const [storageReady, setStorageReady] = React.useState(!storageKey);
  const columnsRef = React.useRef(columns);
  columnsRef.current = columns;
  const searchRef = React.useRef(search);
  searchRef.current = search;
  const activeQuery = search?.value ?? query;
  // Derive the LIVE row from the current rows — the stored key survives
  // data refreshes so the slider always shows current data.
  const detail = detailKey != null ? rows.find((r) => rowKey(r) === detailKey) ?? null : null;

  React.useEffect(() => setVisible(pageSize), [pageSize, activeQuery, sort]);

  React.useEffect(() => {
    if (!storageKey) {
      setStorageReady(true);
      return;
    }
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const saved: unknown = JSON.parse(raw);
        if (typeof saved === "object" && saved !== null) {
          const preferences = saved as { query?: unknown; sort?: { key?: unknown; direction?: unknown } };
          if (typeof preferences.query === "string" && searchRef.current?.value === undefined) {
            setQuery(preferences.query);
          }
          if (
            typeof preferences.sort?.key === "string" &&
            columnsRef.current.some((column) => column.key === preferences.sort?.key) &&
            (preferences.sort.direction === "asc" || preferences.sort.direction === "desc")
          ) {
            setSort({ key: preferences.sort.key, direction: preferences.sort.direction });
          }
        } else {
          console.warn(`Ignoring invalid saved record-list preferences: ${storageKey}`);
        }
      }
    } catch (error) {
      console.warn(`Unable to restore record-list preferences: ${storageKey}`, error);
    } finally {
      setStorageReady(true);
    }
  }, [storageKey]);

  React.useEffect(() => {
    if (!storageKey || !storageReady) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({
        ...(searchRef.current?.value === undefined ? { query } : {}),
        sort,
      }));
    } catch (error) {
      console.warn(`Unable to save record-list preferences: ${storageKey}`, error);
    }
  }, [query, sort, storageKey, storageReady]);

  const searched = React.useMemo(() => {
    const q = activeQuery.trim().toLowerCase();
    if (!q || !search) return rows;
    return rows.filter((row) => search.text(row).toLowerCase().includes(q));
  }, [rows, activeQuery, search]);

  const sorted = React.useMemo(() => {
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...searched].sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [searched, sort, sortValue]);

  const windowRows = sorted.slice(0, visible);
  const clientHasMore = visible < sorted.length;
  const showLoadMore = hasMore !== undefined ? hasMore || clientHasMore : clientHasMore;

  const lastRightColumn = [...columns].reverse().find((c) => c.align === "right");
  const primaryFor = (row: T) =>
    mobilePrimary ? mobilePrimary(row) : lastRightColumn?.render?.(row) ?? null;

  const activate = (row: T) => {
    if (onRowActivate) onRowActivate(row);
    else setDetailKey(rowKey(row));
  };

  const toggleSort = (key: string) =>
    setSort((prev) => (prev.key === key
      ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
      : { key, direction: "desc" }));

  const updateQuery = (value: string) => {
    if (search?.value === undefined) setQuery(value);
    search?.onChange?.(value);
  };

  const toneClass = (tone?: RecordLeading["tone"]) =>
    tone === "up" ? "bg-up/10 text-up"
      : tone === "down" ? "bg-down/10 text-down"
      : tone === "brand" ? "bg-primary/10 text-primary"
      : tone === "warn" ? "bg-(--term-warning-bg) text-(--term-warning-fg)"
      : "bg-muted text-muted-foreground";
  const TitleIcon = RECORD_TITLE_ICONS[title] ?? List;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground">
              <TitleIcon size={16} strokeWidth={1.8} aria-hidden />
            </span>
            <CardTitle className="truncate">{title}</CardTitle>
          </div>
          {count != null && (
            <Badge variant="secondary" className="shrink-0 rounded-md px-2.5 py-1 text-xs font-medium tabular-nums">
              {count}
            </Badge>
          )}
        </div>
        {description != null && <CardDescription>{description}</CardDescription>}
        {(search || filters || toolbarEnd) && (
          <div className="space-y-2.5 pt-2">
            {(search || toolbarEnd) && (
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                {search && (
                  <RecordSearchInput<T>
                    ariaLabel={search.placeholder}
                    placeholder={search.placeholder}
                    value={activeQuery}
                    onChange={updateQuery}
                    rows={rows}
                    text={search.text}
                    suggestions={search.suggestions}
                    className="sm:max-w-sm sm:flex-1"
                  />
                )}
                {toolbarEnd && (
                  <div className="flex min-w-0 items-center justify-end sm:ml-auto">
                    {toolbarEnd}
                  </div>
                )}
              </div>
            )}
            {filters && (
              <ResponsiveFilters className="flex min-w-0 flex-col gap-2 rounded-xl bg-muted/30 py-2 px-4 md:flex-row md:items-center md:gap-3">
                <div className="hidden shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground md:flex">
                  <SlidersHorizontal size={16} strokeWidth={2} aria-hidden />
                </div>
                <div className="flex min-w-0 flex-col items-stretch gap-2 *:min-w-0 *:w-full **:data-[slot=input]:h-8 **:data-[slot=input]:rounded-lg **:data-[slot=input]:bg-background/70 **:data-[slot=input]:text-xs **:data-[slot=select-trigger]:h-8 **:data-[slot=select-trigger]:rounded-lg **:data-[slot=select-trigger]:bg-background/70 **:data-[slot=select-trigger]:px-2.5 **:data-[slot=select-trigger]:text-xs [&_button:not([aria-pressed])]:h-8 [&_button:not([aria-pressed])]:rounded-lg [&_button:not([aria-pressed])]:px-2.5 [&_button:not([aria-pressed])]:text-xs md:flex-row md:flex-wrap md:items-center md:gap-1.5 md:*:w-auto">
                  {filters}
                </div>
              </ResponsiveFilters>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {loading ? (
          <div className="space-y-3 px-6 py-5" role="status" aria-label={`Loading ${ariaLabel.toLowerCase()}s`}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-2.5 w-56" />
                </div>
                <Skeleton className="h-3.5 w-16" />
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              {emptyIcon ?? <Inbox size={18} strokeWidth={1.75} aria-hidden />}
            </div>
            <p className="text-sm font-medium">{emptyTitle}</p>
            {emptyHint && <p className="text-xs text-muted-foreground">{emptyHint}</p>}
          </div>
        ) : (
          <>
          {/* Desktop: full sortable table */}
          <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-55 pl-6">{ariaLabel}</TableHead>
                {columns.map((column) => (
                  <TableHead key={column.key} className={column.align === "right" ? "text-right" : undefined}>
                    {column.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        aria-label={`Sort by ${column.label}${sort.key === column.key ? `, currently ${sort.direction === "asc" ? "ascending" : "descending"}` : ""}`}
                        className={cn(
                          "inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-foreground",
                          sort.key === column.key && "text-foreground",
                        )}
                      >
                        {column.label}
                        {column.sortable && (sort.key === column.key
                          ? (sort.direction === "asc"
                            ? <ArrowUp size={11} strokeWidth={2} aria-hidden className="text-primary" />
                            : <ArrowDown size={11} strokeWidth={2} aria-hidden className="text-primary" />)
                          : <ArrowUpDown size={11} strokeWidth={2} aria-hidden className="opacity-50" />)}
                      </button>
                    ) : column.label}
                  </TableHead>
                ))}
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {windowRows.map((row) => {
                const lead = leading(row);
                return (
                  <TableRow
                    key={rowKey(row)}
                    onClick={(event) => {
                      if (
                        event.target instanceof HTMLElement &&
                        event.target !== event.currentTarget &&
                        event.target.closest("a, button, input, select, textarea, [role='button'], [role='link'], [role='checkbox']")
                      ) {
                        return;
                      }
                      activate(row);
                    }}
                    className="cursor-pointer"
                  >
                    <TableCell className="max-w-75 pl-6 pr-4">
                      <div className="flex items-center gap-3">
                        {lead.icon != null && (
                          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", toneClass(lead.tone))}>
                            {lead.icon}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-foreground">{lead.title}</div>
                          {lead.secondary != null && (
                            <div className="truncate text-xs text-muted-foreground">{lead.secondary}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    {columns.map((column) => (
                      <TableCell
                        key={column.key}
                        className={cn(column.align === "right" && "text-right", column.className)}
                      >
                        {column.render ? column.render(row) : String(sortValue(row, column.key))}
                      </TableCell>
                    ))}
                    <TableCell className="pr-4 text-muted-foreground">
                      <button
                        type="button"
                        aria-label={`Open ${ariaLabel.toLowerCase()} details`}
                        onClick={(event) => {
                          event.stopPropagation();
                          activate(row);
                        }}
                        className="inline-flex size-8 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <ChevronRight size={14} strokeWidth={2} aria-hidden className="opacity-60" />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>

          {/* Mobile: concise summary rows — leading identity + primary
              metric, aligned with the desktop leading cell and slide-over. */}
          <ul className="space-y-2 p-3 md:hidden">
            {windowRows.map((row) => {
              const lead = leading(row);
              return (
                <li key={rowKey(row)}>
                  <button
                    type="button"
                    onClick={() => activate(row)}
                    className="flex w-full items-center gap-3 rounded-xl bg-muted/40 px-3.5 py-3 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    {lead.icon != null && (
                      <IdentityTile tone={lead.tone}>{lead.icon}</IdentityTile>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">{lead.title}</div>
                      {lead.secondary != null && (
                        <div className="truncate text-xs text-muted-foreground">{lead.secondary}</div>
                      )}
                    </div>
                    <div className="shrink-0 text-right text-sm font-semibold tabular-nums">
                      {primaryFor(row)}
                    </div>
                    <ChevronRight size={14} strokeWidth={2} aria-hidden className="shrink-0 text-muted-foreground opacity-60" />
                  </button>
                </li>
              );
            })}
          </ul>
          </>
        )}
        {showLoadMore && sorted.length > 0 && (
          <div className="flex items-center justify-center gap-3 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={loadingMore}
              onClick={() => {
                if (hasMore !== undefined && clientHasMore === false) onLoadMore?.();
                else setVisible((v) => v + pageSize);
              }}
            >
              <ChevronDown size={13} strokeWidth={2} aria-hidden /> Load more
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">
              Showing {windowRows.length} of {hasMore !== undefined && !clientHasMore ? `${sorted.length}+` : sorted.length}
            </span>
          </div>
        )}
      </CardContent>

      {/* Master–detail side slide */}
      <Sheet open={detail != null} onOpenChange={(open) => { if (!open) setDetailKey(null); }}>
        <SheetContent side="right" className={cn("flex w-full flex-col gap-0 overflow-y-auto p-0", sheetWidth)}>
          <SheetHeader className="space-y-1 pb-2">
            <SheetTitle>{detailTitle}</SheetTitle>
            <SheetDescription>Full record details.</SheetDescription>
          </SheetHeader>
          {detail != null && (
            <div className="space-y-5 px-4 pb-6">
              {renderDetailHero?.(detail)}
              <dl className="space-y-3">
                {(renderDetailMeta?.(detail) ?? []).map((meta) => (
                  <div key={meta.label} className="flex items-center justify-between gap-4 text-sm">
                    <dt className="shrink-0 text-muted-foreground">{meta.label}</dt>
                    <dd className="min-w-0 text-right font-medium tabular-nums text-foreground">{meta.value}</dd>
                  </div>
                ))}
              </dl>
              {renderDetailExtra?.(detail)}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </Card>
  );
}

/** Small helper for detail meta values that are status pills. */
export function RecordStatusChip({ children, tone = "muted" }: { children: React.ReactNode; tone?: "up" | "down" | "brand" | "muted" | "warn" }) {
  const tones: Record<string, string> = {
    up: "bg-(--term-success-bg) text-(--term-success-fg)",
    down: "bg-(--term-danger-bg) text-(--term-danger-fg)",
    warn: "bg-(--term-warning-bg) text-(--term-warning-fg)",
    brand: "bg-primary/10 text-primary",
    muted: "bg-muted text-muted-foreground",
  };
  return <Badge variant="secondary" className={tones[tone]}>{children}</Badge>;
}
