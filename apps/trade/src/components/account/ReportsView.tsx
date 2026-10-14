"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { InstrumentIcon } from "@/components/icons/InstrumentIcon";
import { CsvExportButton } from "@/components/ui/CsvExport";
import { SymbolLink } from "@/components/trade/SymbolLink";
import { fmtDateTime } from "@/lib/dates";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/card";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { RecordList, type RecordDetailMeta } from "@/components/ui/RecordList";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface ReportRow {
  id: string;
  symbol: string;
  type: "CFD" | "STRIKE";
  side: "BUY" | "SELL";
  volume: number;
  netProfit: number;
  swap: number;
  commission: number;
  openedAt: string;
  closedAt: string;
}

export interface ReportSummary {
  net: number;
  winRate: number;
  profitFactor: number | null;
  totalSwap: number;
  totalComm: number;
  trades: number;
  best: ReportRow | null;
  worst: ReportRow | null;
}

export interface ReportServerState {
  summary: ReportSummary;
  symbols: string[];
  filters: { symbol: string; side: string; from?: string | null; to?: string | null };
  pagination: { page: number; pageCount: number; total: number; pageSize: number };
}

/** Trade reports on the enterprise RecordList: summary stat cards, best/worst
 *  cards, filters, and a side-slide detail per closed trade. */
export function ReportsView({ rows, server }: { rows: ReportRow[]; server?: ReportServerState }) {
  const [localSymbol, setLocalSymbol] = useState<string>("ALL");
  const [localSide, setLocalSide] = useState<string>("ALL");
  const [fromDate, setFromDate] = useState(server?.filters.from ?? "");
  const [toDate, setToDate] = useState(server?.filters.to ?? "");

  const localSymbols = useMemo(() => Array.from(new Set(rows.map((r) => r.symbol))).sort(), [rows]);
  const symbol = server?.filters.symbol ?? localSymbol;
  const side = server?.filters.side ?? localSide;
  const symbols = server?.symbols ?? localSymbols;

  const filtered = useMemo(() => {
    // Server mode: symbol/side/date filters were already applied server-side
    // (same predicate drives the summary and pagination) — no re-filtering.
    if (server) return rows;
    const from = fromDate ? new Date(fromDate).getTime() : null;
    const to = toDate ? new Date(toDate).getTime() + 86_399_999 : null;
    return rows.filter((r) => {
      if (symbol !== "ALL" && r.symbol !== symbol) return false;
      if (side !== "ALL" && r.side !== side) return false;
      const closed = new Date(r.closedAt).getTime();
      if (from != null && closed < from) return false;
      if (to != null && closed > to) return false;
      return true;
    });
  }, [rows, server, side, symbol, fromDate, toDate]);

  const localStats = useMemo(() => calculateStats(filtered), [filtered]);
  const stats = server?.summary ?? localStats;
  const up = (r: ReportRow) => r.netProfit >= 0;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard label="Net P&L" value={fmtSigned(stats.net)} valueClass={stats.net >= 0 ? "text-up" : "text-down"} />
        <SummaryCard label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} sub={`${stats.trades} trades`} />
        <SummaryCard
          label="Profit Factor"
          value={stats.profitFactor == null ? "∞" : stats.profitFactor.toFixed(2)}
          sub={(stats.profitFactor ?? Number.POSITIVE_INFINITY) >= 1 ? "Profitable" : "Unprofitable"}
        />
        <SummaryCard label="Swap / Commission" value={`${fmtSigned(stats.totalSwap)} / ${fmtSigned(-stats.totalComm)}`} valueClass="text-muted-foreground" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ExtremCard title="Best Trade" row={stats.best} positive emptyLabel="No winning trades" />
        <ExtremCard title="Worst Trade" row={stats.worst} positive={false} emptyLabel="No losing trades" />
      </div>

      <RecordList<ReportRow>
        ariaLabel="Trade"
        title="Closed Trades"
        description={`${filtered.length} shown${server ? ` of ${server.pagination.total}` : ""}`}
        rows={filtered}
        rowKey={(r) => r.id}
        leading={(r) => ({
          icon: <span className="text-xs font-bold">{r.symbol.slice(0, 2)}</span>,
          tone: r.side === "BUY" ? "up" : "down",
          title: <SymbolLink symbol={r.symbol} />,
          secondary: `${r.type} · ${r.side} · ${r.volume.toFixed(2)} lots`,
        })}
        columns={[
          { key: "volume", label: "Volume", sortable: true, align: "right", render: (r) => r.volume.toFixed(2) },
          { key: "swap", label: "Swap", align: "right", render: (r) => <span className="text-muted-foreground tabular-nums">{fmtSigned(r.swap)}</span> },
          { key: "commission", label: "Commission", align: "right", render: (r) => <span className="text-muted-foreground tabular-nums">{fmtSigned(-r.commission)}</span> },
          { key: "netProfit", label: "Net P&L", sortable: true, align: "right", render: (r) => (
            <span className={`font-semibold tabular-nums ${up(r) ? "text-up" : "text-down"}`}>{fmtSigned(r.netProfit)}</span>
          ) },
          { key: "closedAt", label: "Closed", sortable: true, align: "right", render: (r) => (
            <span className="text-xs text-muted-foreground tabular-nums">{fmtDateTime(r.closedAt)}</span>
          ) },
        ]}
        sortValue={(r, key) => {
          switch (key) {
            case "volume": return r.volume;
            case "netProfit": return r.netProfit;
            case "closedAt": return new Date(r.closedAt).getTime();
            default: return String((r as unknown as Record<string, unknown>)[key] ?? "");
          }
        }}
        initialSort={{ key: "closedAt", direction: "desc" }}
        filters={
          <>
            {/* Server mode: dates are submitted with the filter form and applied
                to the list, pagination, and summary alike. Local mode: live filtering. */}
            <div className="flex items-center gap-1.5">
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} aria-label="Closed after" className="h-8 w-35" />
              <span className="text-xs text-muted-foreground">→</span>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} aria-label="Closed before" className="h-8 w-35" />
            </div>
            {server ? (
              <form action="/reports" method="get" className="flex flex-wrap items-center gap-2">
                {fromDate && <input type="hidden" name="from" value={fromDate} />}
                {toDate && <input type="hidden" name="to" value={toDate} />}
                <Select name="symbol" defaultValue={symbol}>
                  <SelectTrigger size="sm" className="w-35" aria-label="Filter by symbol">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All symbols</SelectItem>
                    {symbols.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select name="side" defaultValue={side}>
                  <SelectTrigger size="sm" className="w-30" aria-label="Filter by side">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All sides</SelectItem>
                    <SelectItem value="BUY">BUY</SelectItem>
                    <SelectItem value="SELL">SELL</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="submit" size="sm" variant="outline">Apply filters</Button>
              </form>
            ) : (
              <>
                <Select value={symbol} onValueChange={setLocalSymbol}>
                  <SelectTrigger size="sm" className="w-35" aria-label="Filter by symbol">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All symbols</SelectItem>
                    {symbols.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                  </SelectContent>
                </Select>
                <ChipGroup
                  ariaLabel="Filter by side"
                  value={side}
                  onChange={setLocalSide}
                  options={[
                    { value: "ALL", label: "All" },
                    { value: "BUY", label: "Buy" },
                    { value: "SELL", label: "Sell" },
                  ]}
                />
              </>
            )}
          </>
        }
        toolbarEnd={
          <CsvExportButton
            filename="trade-report"
            columns={["Symbol", "Type", "Side", "Volume", "Swap", "Commission", "Net P&L", "Closed"]}
            rows={filtered.map((r) => [r.symbol, r.type, r.side, r.volume.toFixed(2), r.swap.toFixed(2), r.commission.toFixed(2), r.netProfit.toFixed(2), fmtDateTime(r.closedAt)])}
            disabled={filtered.length === 0}
          />
        }
        detailTitle="Trade Detail"
        renderDetailHero={(r) => (
          <div className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 px-4 py-6 text-center">
            <InstrumentIcon symbol={r.symbol} size={44} />
            <div className="text-sm font-medium">{r.symbol} · {r.side}</div>
            <div className={`text-2xl font-semibold tabular-nums ${up(r) ? "text-up" : "text-down"}`}>
              {fmtSigned(r.netProfit)} <span className="text-sm font-normal text-muted-foreground">USD</span>
            </div>
          </div>
        )}
        renderDetailMeta={(r): RecordDetailMeta[] => [
          { label: "Volume", value: `${r.volume.toFixed(2)} lots` },
          { label: "Swap", value: fmtSigned(r.swap) },
          { label: "Commission", value: fmtSigned(-r.commission) },
          { label: "Opened", value: fmtDateTime(r.openedAt) },
          { label: "Closed", value: fmtDateTime(r.closedAt) },
        ]}
        emptyTitle="No closed trades match these filters."
      />

      {server && server.pagination.pageCount > 1 && (
        <nav aria-label="Trade report pages" className="flex items-center justify-between gap-3 text-sm">
          <ReportPageLink server={server} page={server.pagination.page - 1} disabled={server.pagination.page <= 1}>Previous</ReportPageLink>
          <span className="text-muted-foreground">Page {server.pagination.page} of {server.pagination.pageCount}</span>
          <ReportPageLink server={server} page={server.pagination.page + 1} disabled={server.pagination.page >= server.pagination.pageCount}>Next</ReportPageLink>
        </nav>
      )}
    </div>
  );
}

function calculateStats(rows: ReportRow[]): ReportSummary {
  const wins = rows.filter((row) => row.netProfit > 0);
  const losses = rows.filter((row) => row.netProfit < 0);
  const grossWin = wins.reduce((sum, row) => sum + row.netProfit, 0);
  const grossLoss = Math.abs(losses.reduce((sum, row) => sum + row.netProfit, 0));
  // Best features a winning trade, worst a losing one — when no such trade
  // exists the card shows its empty state instead of a misleading extreme.
  const bestRow = rows.reduce((best, row) => row.netProfit > (best?.netProfit ?? -Infinity) ? row : best, null as ReportRow | null);
  const worstRow = rows.reduce((worst, row) => row.netProfit < (worst?.netProfit ?? Infinity) ? row : worst, null as ReportRow | null);
  return {
    net: rows.reduce((sum, row) => sum + row.netProfit, 0),
    winRate: rows.length ? (wins.length / rows.length) * 100 : 0,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? null : 0,
    totalSwap: rows.reduce((sum, row) => sum + row.swap, 0),
    totalComm: rows.reduce((sum, row) => sum + row.commission, 0),
    trades: rows.length,
    best: bestRow && bestRow.netProfit > 0 ? bestRow : null,
    worst: worstRow && worstRow.netProfit < 0 ? worstRow : null,
  };
}

function ReportPageLink({ server, page, disabled, children }: { server: ReportServerState; page: number; disabled: boolean; children: React.ReactNode }) {
  const params = new URLSearchParams();
  if (server.filters.symbol !== "ALL") params.set("symbol", server.filters.symbol);
  if (server.filters.side !== "ALL") params.set("side", server.filters.side);
  if (server.filters.from) params.set("from", server.filters.from);
  if (server.filters.to) params.set("to", server.filters.to);
  params.set("page", String(page));
  if (disabled) return <Button variant="outline" size="sm" disabled>{children}</Button>;
  return (
    <Button variant="outline" size="sm" asChild>
      <Link href={`/reports?${params.toString()}`}>{children}</Link>
    </Button>
  );
}

function SummaryCard({ label, value, valueClass = "", sub }: { label: string; value: string; valueClass?: string; sub?: string }) {
  return (
    <Card className="py-5">
      <CardContent className="grid gap-1.5 px-5">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className={`text-xl font-semibold tabular-nums ${valueClass}`}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function ExtremCard({ title, row, positive, emptyLabel = "—" }: { title: string; row: ReportRow | null; positive: boolean; emptyLabel?: string }) {
  return (
    <Card className="py-5">
      <CardContent className="grid gap-1.5 px-5">
        <div className="text-sm font-medium text-muted-foreground">{title}</div>
        {row ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <InstrumentIcon symbol={row.symbol} size={20} />
              <div className="min-w-0">
                <div className="text-sm font-medium"><SymbolLink symbol={row.symbol} /></div>
                <div className="text-xs text-muted-foreground">{row.side} · {row.volume.toFixed(2)} lots</div>
              </div>
            </div>
            <div className={`text-lg font-semibold tabular-nums ${positive ? "text-up" : "text-down"}`}>{fmtSigned(row.netProfit)}</div>
          </div>
        ) : (
          <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
            {positive ? <TrendingUp size={16} aria-hidden /> : <TrendingDown size={16} aria-hidden />}
            {emptyLabel}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function fmtSigned(value: number): string { return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`; }
