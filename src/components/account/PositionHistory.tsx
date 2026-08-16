"use client";

import { useEffect, useMemo, useState } from "react";
import type { InstrumentView } from "@/lib/types";
import { Pagination } from "@/components/ui/Pagination";
import { InstrumentIcon } from "@/components/icons/InstrumentIcon";
import { TableShell, Th, Td, EmptyRow, TotalsRow, FilterChip, type SortDirection } from "@/components/ui/DataTable";
import { CsvExportButton } from "@/components/ui/CsvExport";
import { fmtDateTime } from "@/lib/dates";

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

/** Sortable, filterable position history with totals and CSV export. */
export function PositionHistory({ open, closed, instruments, fetchCap }: Props) {
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
    <>
    <TableShell
      minWidth={900}
      footer={<Pagination page={safePage} pageSize={PAGE_SIZE} totalItems={rows.length} onPageChange={setPage} label="positions" />}
      toolbar={
        <>
          <h3 className="text-xs font-medium uppercase text-text-muted">Position History</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            {(["ALL", "OPEN", "CLOSED"] as const).map((value) => (
              <FilterChip key={value} active={statusFilter === value} onClick={() => setStatusFilter(value)}>
                {value === "ALL" ? "All" : value === "OPEN" ? "Open" : "Closed"}
              </FilterChip>
            ))}
          </div>
          <select
            value={symbolFilter}
            onChange={(e) => setSymbolFilter(e.target.value)}
            aria-label="Filter by symbol"
            className="h-8 rounded border border-border bg-canvas px-2 text-xs outline-none focus:border-brand"
          >
            <option value="ALL">All symbols</option>
            {symbols.map((symbol) => <option key={symbol} value={symbol}>{symbol}</option>)}
          </select>
          <span className="ml-auto text-[10px] text-text-faint tnum">
            {rows.length} shown · Net P/L {allFilteredProfit >= 0 ? "+" : ""}{allFilteredProfit.toFixed(2)}
            {capped && <span className="ml-1.5 text-brand" title="The server loads the most recent positions first.">· showing latest {fetchCap}</span>}
          </span>
          <CsvExportButton filename="positions" columns={["Symbol", "Type", "Side", "Volume", "Open Rate", "Current/Close", "Net Profit", "Status", "Opened", "Closed"]} rows={csvRows} disabled={rows.length === 0} />
        </>
      }
    >
      <thead className="border-b border-border-soft bg-panel-2">
        <tr>
          <Th sortKey="symbol" sort={sort} onSort={onSort}>Symbol</Th>
          <Th>Type</Th><Th>Side</Th>
          <Th sortKey="volume" sort={sort} onSort={onSort} align="right">Volume</Th>
          <Th align="right">Open Rate</Th><Th align="right">Current/Close</Th>
          <Th sortKey="netProfit" sort={sort} onSort={onSort} align="right">Net Profit</Th>
          <Th>Status</Th>
          <Th sortKey="openedAt" sort={sort} onSort={onSort}>Opened</Th>
        </tr>
      </thead>
      <tbody>
        {visibleRows.map((position) => {
          const profitable = position.netProfit >= 0;
          return (
            <tr key={position.id} className="border-b border-border-soft last:border-b-0 hover:bg-panel-2">
              <Td className="font-medium"><span className="flex items-center gap-1.5"><InstrumentIcon symbol={position.symbol} size={14} />{position.symbol}</span></Td>
              <Td className="text-text-muted">{position.type}</Td>
              <Td><span className={position.side === "BUY" ? "text-up" : "text-down"}>{position.side}</span></Td>
              <Td align="right">{position.volume.toFixed(2)}</Td>
              <Td align="right">{fmt(position.openRate, digits(position.symbol))}</Td>
              <Td align="right">{fmt(position.currentRate, digits(position.symbol))}</Td>
              <Td align="right" className={profitable ? "text-up" : "text-down"} >
                <span className={`font-medium ${profitable ? "text-up" : "text-down"}`}>
                  {profitable ? "+" : ""}{position.netProfit.toFixed(2)}
                </span>
              </Td>
              <Td>
                <span className={`rounded px-1.5 py-0.5 text-[10px] ${position.status === "OPEN" ? "bg-brand-soft text-brand" : "bg-panel-3 text-text-muted"}`}>
                  {position.status}
                </span>
              </Td>
              <Td className="text-[11px] text-text-muted">{fmtDateTime(position.openedAt)}</Td>
            </tr>
          );
        })}
        {rows.length === 0 && <EmptyRow colSpan={9} label="No positions match the current filters." />}
        {rows.length > 0 && (
          <TotalsRow
            cells={[
              { label: `Page totals (${visibleRows.length})`, colSpan: 3 },
              { label: pageVolume.toFixed(2), align: "right" },
              { colSpan: 2, label: "" },
              { label: `${pageProfit >= 0 ? "+" : ""}${pageProfit.toFixed(2)}`, align: "right", className: pageProfit >= 0 ? "text-up" : "text-down" },
              { label: "", colSpan: 3 },
            ]}
          />
        )}
      </tbody>
    </TableShell>
    </>
  );
}

function fmt(value: number, digits: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
