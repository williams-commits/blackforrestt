"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { InstrumentView } from "@/lib/types";
import { CsvExportButton } from "@/components/ui/CsvExport";

import { InstrumentIcon } from "@/components/icons/InstrumentIcon";
import { fmtDateTime } from "@/lib/dates";
import { CandlestickChart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { RecordList, RecordStatusChip, type RecordDetailMeta } from "@/components/ui/RecordList";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  swap: number;
  commission: number;
  tradingCommission: number;
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

/** Position history on the enterprise RecordList — filter chips, symbol
 *  select, sortable columns, load-more, and a side-slide detail per trade. */
export function PositionHistory({ open, closed, instruments, fetchCap }: Props) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "CLOSED">("ALL");
  const [symbolFilter, setSymbolFilter] = useState<string>("ALL");

  const allRows = useMemo(
    () => [...open, ...closed].sort((left, right) => right.openedAt.getTime() - left.openedAt.getTime()),
    [open, closed],
  );
  const symbols = useMemo(() => [...new Set(allRows.map((r) => r.symbol))].sort(), [allRows]);

  const rows = useMemo(
    () => allRows.filter(
      (r) =>
        (statusFilter === "ALL" || r.status === statusFilter) &&
        (symbolFilter === "ALL" || r.symbol === symbolFilter),
    ),
    [allRows, statusFilter, symbolFilter],
  );

  const digits = (symbol: string) => instruments[symbol]?.digits ?? 5;
  const fmt = (v: number, symbol: string) => v.toFixed(digits(symbol));
  const profitable = (r: PositionRow) => r.netProfit >= 0;

  const netTotal = rows.reduce((sum, r) => sum + r.netProfit, 0);
  const capped = fetchCap != null && allRows.length >= fetchCap;

  const csvRows = rows.map((r) => [
    r.symbol, r.type, r.side, r.volume.toFixed(2),
    fmt(r.openRate, r.symbol), fmt(r.currentRate, r.symbol),
    r.netProfit.toFixed(2), r.status, fmtDateTime(r.openedAt), r.closedAt ? fmtDateTime(r.closedAt) : "",
  ]);

  return (
    <RecordList<PositionRow>
      ariaLabel="Position"
      title="Position History"
      description={
        <>
          {rows.length} shown · Net P/L{" "}
          <span className={`font-semibold ${netTotal >= 0 ? "text-up" : "text-down"}`}>
            {netTotal >= 0 ? "+" : ""}{netTotal.toFixed(2)}
          </span>
          {capped && <span className="text-muted-foreground"> · showing latest {fetchCap}</span>}
        </>
      }
      rows={rows}
      rowKey={(r) => r.id}
      leading={(r) => ({
        icon: <InstrumentIcon symbol={r.symbol} size={20} />,
        tone: r.side === "BUY" ? "up" : "down",
        title: r.symbol,
        secondary: <span>{r.type} · <span className={r.side === "BUY" ? "text-up" : "text-down"}>{r.side}</span> · {r.volume.toFixed(2)} lots</span>,
      })}
      columns={[
        { key: "openRate", label: "Open", align: "right", render: (r) => fmt(r.openRate, r.symbol) },
        { key: "currentRate", label: "Current/Close", align: "right", render: (r) => fmt(r.currentRate, r.symbol) },
        { key: "netProfit", label: "Net P/L", sortable: true, align: "right", render: (r) => (
          <span className={`font-semibold tabular-nums ${profitable(r) ? "text-up" : "text-down"}`}>
            {profitable(r) ? "+" : ""}{r.netProfit.toFixed(2)}
          </span>
        ) },
        { key: "status", label: "Status", render: (r) => (
          <RecordStatusChip tone={r.status === "OPEN" ? "warn" : "muted"}>{r.status}</RecordStatusChip>
        ) },
        { key: "openedAt", label: "Opened", sortable: true, align: "right", render: (r) => (
          <span className="text-xs text-muted-foreground tabular-nums">{fmtDateTime(r.openedAt)}</span>
        ) },
      ]}
      sortValue={(r, key) => {
        switch (key) {
          case "netProfit": return r.netProfit;
          case "openedAt": return r.openedAt.getTime();
          default: return String((r as unknown as Record<string, unknown>)[key] ?? "");
        }
      }}
      initialSort={{ key: "openedAt", direction: "desc" }}
      filters={
        <>
          <ChipGroup
            ariaLabel="Filter positions by status" className="flex-wrap"
            value={statusFilter}
            onChange={(value) => setStatusFilter(value)}
            options={[
              { value: "ALL", label: "All" },
              { value: "OPEN", label: "Open" },
              { value: "CLOSED", label: "Closed" },
            ]}
          />
          <Select value={symbolFilter} onValueChange={setSymbolFilter}>
            <SelectTrigger size="sm" className="w-37.5" aria-label="Filter by symbol">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All symbols</SelectItem>
              {symbols.map((symbol) => <SelectItem key={symbol} value={symbol}>{symbol}</SelectItem>)}
            </SelectContent>
          </Select>
        </>
      }
      toolbarEnd={
        <CsvExportButton filename="positions" columns={["Symbol", "Type", "Side", "Volume", "Open Rate", "Current/Close", "Net Profit", "Status", "Opened", "Closed"]} rows={csvRows} disabled={rows.length === 0} />
      }
      detailTitle="Position Detail"
      renderDetailHero={(r) => (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 px-4 py-6 text-center">
          <span className={`flex size-14 items-center justify-center rounded-full ${r.side === "BUY" ? "bg-up/10" : "bg-down/10"}`}>
            <InstrumentIcon symbol={r.symbol} size={32} />
          </span>
          <div className="text-sm font-medium">{r.symbol} · {r.side}</div>
          <div className={`text-2xl font-semibold tabular-nums ${profitable(r) ? "text-up" : "text-down"}`}>
            {profitable(r) ? "+" : ""}{r.netProfit.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">USD</span>
          </div>
        </div>
      )}
      renderDetailMeta={(r): RecordDetailMeta[] => [
        { label: "Status", value: <RecordStatusChip tone={r.status === "OPEN" ? "warn" : "muted"}>{r.status}</RecordStatusChip> },
        { label: "Volume", value: `${r.volume.toFixed(2)} lots` },
        { label: "Open rate", value: fmt(r.openRate, r.symbol) },
        { label: r.status === "OPEN" ? "Current rate" : "Close rate", value: fmt(r.currentRate, r.symbol) },
        { label: "Swap", value: r.swap.toFixed(2) },
        { label: "Commission", value: (r.commission + r.tradingCommission).toFixed(2) },
        { label: "Opened", value: fmtDateTime(r.openedAt) },
        ...(r.closedAt ? [{ label: "Closed", value: fmtDateTime(r.closedAt) }] : []),
      ]}
      renderDetailExtra={(r) => (
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => router.push(`/trade/${r.symbol}`)}>
          <CandlestickChart size={14} strokeWidth={2} aria-hidden /> Open in terminal
        </Button>
      )}
      mobilePrimary={(r) => (
        <span className={profitable(r) ? "text-up" : "text-down"}>
          {profitable(r) ? "+" : ""}{r.netProfit.toFixed(2)}
        </span>
      )}
      emptyTitle="No positions match the current filters."
      emptyHint="Adjust the status or symbol filters to see more."
    />
  );
}
