"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Inbox, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/Input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Skeleton";

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

export interface RecordLeading {
  /** Tinted identity tile (icon, initials, instrument mark). */
  icon?: React.ReactNode;
  tone?: "default" | "up" | "down" | "brand" | "warn" | "muted";
  title: React.ReactNode;
  secondary?: React.ReactNode;
}

export function RecordList<T>({
  ariaLabel,
  title,
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
  emptyTitle = "Nothing here yet",
  emptyHint,
  emptyIcon,
  onRowActivate,
  className,
}: {
  ariaLabel: string;
  title: string;
  description?: React.ReactNode;
  rows: T[];
  rowKey: (row: T) => string;
  /** Leading two-line identity cell. */
  leading: (row: T) => RecordLeading;
  columns: RecordColumn<T>[];
  /** Comparable extractor for sorting (numbers compare numerically). */
  sortValue: (row: T, key: string) => string | number;
  initialSort?: { key: string; direction: "asc" | "desc" };
  /** When provided, renders the search pill filtering via this text extractor. */
  search?: { placeholder: string; text: (row: T) => string };
  /** Caller-composed chip groups / selects — rendered after the search pill. */
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
  emptyTitle?: string;
  emptyHint?: string;
  emptyIcon?: React.ReactNode;
  /** Optional override instead of the slide-over detail. */
  onRowActivate?: (row: T) => void;
  className?: string;
}) {
  const [sort, setSort] = React.useState<{ key: string; direction: "asc" | "desc" }>(
    initialSort ?? { key: columns[0]?.key ?? "", direction: "desc" },
  );
  const [query, setQuery] = React.useState("");
  const [visible, setVisible] = React.useState(pageSize);
  const [detail, setDetail] = React.useState<T | null>(null);

  React.useEffect(() => setVisible(pageSize), [pageSize, query, sort]);

  const searched = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !search) return rows;
    return rows.filter((row) => search.text(row).toLowerCase().includes(q));
  }, [rows, query, search]);

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

  const activate = (row: T) => {
    if (onRowActivate) onRowActivate(row);
    else setDetail(row);
  };

  const toggleSort = (key: string) =>
    setSort((prev) => (prev.key === key
      ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
      : { key, direction: "desc" }));

  const toneClass = (tone?: RecordLeading["tone"]) =>
    tone === "up" ? "bg-up/10 text-up"
      : tone === "down" ? "bg-down/10 text-down"
      : tone === "brand" ? "bg-primary/10 text-primary"
      : tone === "warn" ? "bg-(--term-warning-bg) text-(--term-warning-fg)"
      : "bg-muted text-muted-foreground";

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description != null && <CardDescription>{description}</CardDescription>}
        {(search || filters || toolbarEnd) && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {search && (
              <div className="relative w-full sm:w-64">
                <Search size={14} strokeWidth={2} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={search.placeholder}
                  aria-label={search.placeholder}
                  className="h-8 pl-8"
                />
              </div>
            )}
            {filters}
            {toolbarEnd && <div className="ml-auto">{toolbarEnd}</div>}
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[220px] pl-6">{ariaLabel}</TableHead>
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
                    onClick={() => activate(row)}
                    className="cursor-pointer"
                  >
                    <TableCell className="max-w-[300px] pl-6">
                      <div className="flex items-center gap-3">
                        {lead.icon != null && (
                          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", toneClass(lead.tone))}>
                            {lead.icon}
                          </span>
                        )}
                        <div className="min-w-0">
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
                      <ChevronRight size={14} strokeWidth={2} aria-hidden className="opacity-60" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
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
              Load more
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">
              Showing {windowRows.length} of {hasMore !== undefined && !clientHasMore ? `${sorted.length}+` : sorted.length}
            </span>
          </div>
        )}
      </CardContent>

      {/* Master–detail side slide */}
      <Sheet open={detail != null} onOpenChange={(open) => { if (!open) setDetail(null); }}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
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
