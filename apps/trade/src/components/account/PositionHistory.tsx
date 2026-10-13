"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { InstrumentView } from "@/lib/types";
import { Pagination } from "@/components/ui/Pagination";
import { RecordShell, RecordSortButton, RecordLabel, MobileSortSelect, type SortDirection } from "@/components/ui/RecordList";
import { FilterChip } from "@/components/ui/DataTable";
import { CsvExportButton } from "@/components/ui/CsvExport";
import { Tooltip } from "@/components/ui/Tooltip";
import { rowNavigate, SymbolLink } from "@/components/trade/SymbolLink";
import { fmtDateTime } from "@/lib/dates";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

type PositionRow = {
  id: string;
  symbol: string;
  type: "CFD" | "STRIKE";
  side: "BUY" | "SELL";
  volume: number;
  openRate: number;
  strikeRate: number | null;
  currentRate: number;
  netProfit: number;
  status: "OPEN" | "CLOSED";
  openedAt: Date;
  closedAt: Date | null;
};

interface Props {
  open: PositionRow[];
  closed: PositionRow[];
  instruments: Record<string, InstrumentView>;
  /** Server fetch cap disclosure: the page loads at most this many rows. */
  fetchCap?: number;
}

const PAGE_SIZE = 20;

type SortKey = "openedAt" | "symbol" | "volume" | "netProfit";

const SORT_OPTIONS: Array<{ key: SortKey; direction: SortDirection; label: string }> = [
  { key: "openedAt", direction: "desc", label: "Newest first" },
  { key: "openedAt", direction: "asc", label: "Oldest first" },
  { key: "symbol", direction: "asc", label: "Symbol A→Z" },
  { key: "symbol", direction: "desc", label: "Symbol Z→A" },
  { key: "volume", direction: "desc", label: "Volume high→low" },
  { key: "volume", direction: "asc", label: "Volume low→high" },
  { key: "netProfit", direction: "desc", label: "Profit high→low" },
  { key: "netProfit", direction: "asc", label: "Profit low→high" },
];

/** Sortable, filterable position history as record rows (grid columns on
 *  desktop, stacked cards on phones) with totals and CSV export. */
export function PositionHistory({ open, closed, instruments, fetchCap }: Props) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "CLOSED">("ALL");
  const [symbolFilter, setSymbolFilter] = useState<string>("ALL");
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({ key: "openedAt", direction: "desc" });

  const allRows = useMemo(
    () => [...open, ...closed].sort((left, right) => right.openedAt.getTime() - left.openedAt.getTime()),
    [open, closed],
  );
  const symbols = useMemo(() => [...new Set(allRows.map((r) => r.symbol))].sort(), [allRows]);

  const rows = useMemo(() => {
    const filtered = allRows.filter(
      (r) =>
        (statusFilter === "ALL" || r.status === statusFilter) &&
        (symbolFilter === "ALL" || r.symbol === symbolFilter),
    );
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sort.key) {
        case "symbol": return a.symbol.localeCompare(b.symbol) * dir;
        case "volume": return (a.volume - b.volume) * dir;
        case "netProfit": return (a.netProfit - b.netProfit) * dir;
        default: return (a.openedAt.getTime() - b.openedAt.getTime()) * dir;
      }
    });
  }, [allRows, statusFilter, symbolFilter, sort]);

  // Reset to the first page whenever filters change.
  useEffect(() => { setPage(1); }, [statusFilter, symbolFilter]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const digits = (symbol: string) => instruments[symbol]?.digits ?? 5;

  const onSort = (key: string) => {
    setSort((prev) =>
      prev.key === key
        ? { key: prev.key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key: key as SortKey, direction: "desc" },
    );
  };

  const pageProfit = visibleRows.reduce((sum, r) => sum + r.netProfit, 0);
  const pageVolume = visibleRows.reduce((sum, r) => sum + r.volume, 0);
  const allFilteredProfit = rows.reduce((sum, r) => sum + r.netProfit, 0);
  const capped = fetchCap != null && allRows.length >= fetchCap;

  const csvRows = rows.map((r) => [
    r.symbol, r.type, r.side, r.volume.toFixed(2),
    r.openRate.toFixed(digits(r.symbol)), r.currentRate.toFixed(digits(r.symbol)),
    r.netProfit.toFixed(2), r.status, fmtDateTime(r.openedAt), r.closedAt ? fmtDateTime(r.closedAt) : "",
  ]);

  return (
    <RecordShell
      ariaLabel="Position history"
      footer={<Pagination page={safePage} pageSize={PAGE_SIZE} totalItems={rows.length} onPageChange={setPage} label="positions" />}
      toolbar={
        <>
          <h2 className="text-sm font-semibold">Position History</h2>
          <div className="flex flex-wrap items-center gap-1.5">
            {(["ALL", "OPEN", "CLOSED"] as const).map((value) => (
              <FilterChip key={value} active={statusFilter === value} onClick={() => setStatusFilter(value)}>
                {value === "ALL" ? "All" : value === "OPEN" ? "Open" : "Closed"}
              </FilterChip>
            ))}
          </div>
          <NativeSelect
            value={symbolFilter}
            onChange={(e) => setSymbolFilter(e.target.value)}
            aria-label="Filter by symbol"
            className="h-8"
          >
            <option value="ALL">All symbols</option>
            {symbols.map((symbol) => <option key={symbol} value={symbol}>{symbol}</option>)}
          </NativeSelect>
          <MobileSortSelect
            value={`${sort.key}:${sort.direction}`}
            onChange={(next) => setSort(next as { key: SortKey; direction: SortDirection })}
            options={SORT_OPTIONS}
          />
          <span className="ml-auto text-(length:--term-text-2xs) text-text-faint tnum">
            {rows.length} shown · Net P/L {allFilteredProfit >= 0 ? "+" : ""}{allFilteredProfit.toFixed(2)}
            {capped && (
              <Tooltip text="The server loads the most recent positions first.">
                <span className="ml-1.5 text-brand">· showing latest {fetchCap}</span>
              </Tooltip>
            )}
          </span>
          <CsvExportButton filename="positions" columns={["Symbol", "Type", "Side", "Volume", "Open Rate", "Current/Close", "Net Profit", "Status", "Opened", "Closed"]} rows={csvRows} disabled={rows.length === 0} />
        </>
      }
    >
      {/* Column header — desktop only; phones sort via the toolbar selector */}
      <div className="hidden md:grid md:grid-cols-[minmax(0,1.5fr)_1fr_0.8fr_1fr_1fr_1fr_0.9fr_1.3fr] md:items-center md:gap-3 border-b border-border-soft bg-panel-2/50 px-3 py-2 text-(length:--term-text-2xs) font-medium uppercase tracking-wide text-text-faint" aria-hidden="true">
        <RecordSortButton label="Symbol" sortKey="symbol" sort={sort} onSort={onSort} />
        <RecordLabel>Type · Side</RecordLabel>
        <RecordSortButton label="Volume" sortKey="volume" sort={sort} onSort={onSort} align="right" />
        <RecordLabel align="right">Open</RecordLabel>
        <RecordLabel align="right">Current/Close</RecordLabel>
        <RecordSortButton label="Net Profit" sortKey="netProfit" sort={sort} onSort={onSort} align="right" />
        <RecordLabel>Status</RecordLabel>
        <RecordSortButton label="Opened" sortKey="openedAt" sort={sort} onSort={onSort} />
      </div>

      <ul>
        {visibleRows.map((position) => {
          const profitable = position.netProfit >= 0;
          const plClass = profitable ? "text-up" : "text-down";
          return (
            <li
              key={position.id}
              onClick={rowNavigate(router, position.symbol)}
              className="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-border-soft px-3 py-3 transition-colors last:border-b-0 hover:bg-panel-2 md:grid-cols-[minmax(0,1.5fr)_1fr_0.8fr_1fr_1fr_1fr_0.9fr_1.3fr] md:gap-3 md:py-2.5"
            >
              {/* Identity — col 1 on both layouts */}
              <div className="min-w-0 md:col-start-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold"><SymbolLink symbol={position.symbol} /></span>
                  <span className={`text-(length:--term-text-xs) font-semibold ${position.side === "BUY" ? "text-up" : "text-down"}`}>{position.side}</span>
                  <span className="text-(length:--term-text-xs) text-text-faint">{position.type}</span>
                </div>
                <div className="mt-0.5 text-(length:--term-text-xs) tnum text-text-muted md:hidden">
                  {position.volume.toFixed(2)} lots · {fmt(position.openRate, digits(position.symbol))} → {fmt(position.currentRate, digits(position.symbol))}
                </div>
                <div className="mt-0.5 text-(length:--term-text-2xs) text-text-faint md:hidden">{fmtDateTime(position.openedAt)}</div>
              </div>

              {/* Net P/L — mobile anchor (col 2); desktop col 6 under its header */}
              <div className={`text-right text-sm font-semibold tnum md:col-start-6 md:text-(length:--term-text-sm) ${plClass}`}>
                {profitable ? "+" : ""}{position.netProfit.toFixed(2)}
                <span className="md:hidden block text-(length:--term-text-2xs) font-normal text-text-faint">net P/L</span>
              </div>

              {/* Desktop-only columns — explicit grid placement */}
              <div className="hidden md:block md:col-start-2 text-(length:--term-text-sm) text-text-muted">{position.type} · <span className={position.side === "BUY" ? "text-up" : "text-down"}>{position.side}</span></div>
              <div className="hidden md:block md:col-start-3 text-right text-(length:--term-text-sm) tnum">{position.volume.toFixed(2)}</div>
              <div className="hidden md:block md:col-start-4 text-right text-(length:--term-text-sm) tnum text-text-muted">{fmt(position.openRate, digits(position.symbol))}</div>
              <div className="hidden md:block md:col-start-5 text-right text-(length:--term-text-sm) tnum text-text-muted">{fmt(position.currentRate, digits(position.symbol))}</div>
              <div className="hidden md:block md:col-start-7">
                <span className={`rounded px-1.5 py-0.5 text-(length:--term-text-2xs) font-medium ${position.status === "OPEN" ? "bg-(--term-warning-bg) text-(--term-warning-fg)" : "bg-panel-3 text-text-muted"}`}>
                  {position.status}
                </span>
              </div>
              <div className="hidden md:block md:col-start-8 text-(length:--term-text-xs) tnum text-text-muted">{fmtDateTime(position.openedAt)}</div>
            </li>
          );
        })}
        {rows.length === 0 && (
          <li className="px-4 py-8">
            <EmptyState compact icon={<Inbox size={18} />} title="No positions match the current filters." />
          </li>
        )}
      </ul>

      {/* Page totals — desktop grid columns; compact line on phones */}
      {rows.length > 0 && (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 bg-panel-2/60 px-3 py-2 tnum md:grid-cols-[minmax(0,1.5fr)_1fr_0.8fr_1fr_1fr_1fr_0.9fr_1.3fr]">
          <span className="text-xs font-medium text-text-muted md:col-start-1">
            Page totals ({visibleRows.length})
            <span className="ml-2 md:hidden font-normal">{pageVolume.toFixed(2)} lots</span>
          </span>
          <span className={`text-right text-sm font-semibold md:col-start-6 ${pageProfit >= 0 ? "text-up" : "text-down"}`}>
            {pageProfit >= 0 ? "+" : ""}{pageProfit.toFixed(2)}
          </span>
          <span className="hidden md:block md:col-start-3 text-right text-(length:--term-text-sm) text-text-muted">{pageVolume.toFixed(2)}</span>
        </div>
      )}
    </RecordShell>
  );
}

function fmt(value: number, digits: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
