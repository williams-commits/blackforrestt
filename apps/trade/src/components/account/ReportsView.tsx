"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { InstrumentIcon } from "@/components/icons/InstrumentIcon";
import { CsvExportButton } from "@/components/ui/CsvExport";
import { rowNavigate, SymbolLink } from "@/components/trade/SymbolLink";
import { fmtDateTime } from "@/lib/dates";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { Input } from "@/components/ui/Input";

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

/** Trade reports: performance summary + filterable closed-trades table. */
export function ReportsView({ rows, server }: { rows: ReportRow[]; server?: ReportServerState }) {
  const router = useRouter();
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

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card label="Net P&L" value={fmtSigned(stats.net)} valueClass={stats.net >= 0 ? "text-up" : "text-down"} />
        <Card label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} sub={`${stats.trades} trades`} />
        <Card
          label="Profit Factor"
          value={stats.profitFactor == null ? "∞" : stats.profitFactor.toFixed(2)}
          sub={(stats.profitFactor ?? Number.POSITIVE_INFINITY) >= 1 ? "Profitable" : "Unprofitable"}
        />
        <Card label="Swap / Commission" value={`${fmtSigned(stats.totalSwap)} / ${fmtSigned(-stats.totalComm)}`} valueClass="text-text-muted" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ExtremCard title="Best Trade" row={stats.best} positive emptyLabel="No winning trades" />
        <ExtremCard title="Worst Trade" row={stats.worst} positive={false} emptyLabel="No losing trades" />
      </div>

      {/* Server mode: dates are submitted with the filter form and applied to
          the table, pagination, and summary alike. Local mode: live filtering. */}
      <div className="flex flex-wrap items-center gap-2 text-(length:--term-text-xs) text-text-muted">
        <label className="flex items-center gap-1">
          From
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} aria-label="Closed after" className="h-8" />
        </label>
        <span className="text-text-faint">→</span>
        <label className="flex items-center gap-1">
          To
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} aria-label="Closed before" className="h-8" />
        </label>
        <CsvExportButton
          filename="trade-report"
          columns={["Symbol", "Type", "Side", "Volume", "Swap", "Commission", "Net P&L", "Closed"]}
          rows={filtered.map((r) => [r.symbol, r.type, r.side, r.volume.toFixed(2), r.swap.toFixed(2), r.commission.toFixed(2), r.netProfit.toFixed(2), fmtDateTime(r.closedAt)])}
          disabled={filtered.length === 0}
        />
      </div>

      {server ? (
        <form action="/reports" method="get" className="flex flex-wrap items-end gap-3">
          {fromDate && <input type="hidden" name="from" value={fromDate} />}
          {toDate && <input type="hidden" name="to" value={toDate} />}
          <label className="grid gap-1 text-(length:--term-text-xs) text-text-muted">
            Symbol
            <NativeSelect name="symbol" defaultValue={symbol}>
              <option value="ALL">All symbols</option>
              {symbols.map((item) => <option key={item} value={item}>{item}</option>)}
            </NativeSelect>
          </label>
          <label className="grid gap-1 text-(length:--term-text-xs) text-text-muted">
            Side
            <NativeSelect name="side" defaultValue={side}>
              <option value="ALL">All sides</option>
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </NativeSelect>
          </label>
          <button type="submit" className="h-9 rounded bg-brand px-4 text-xs font-medium text-white hover:brightness-95">Apply filters</button>
          <span className="ml-auto text-xs text-text-faint">{filtered.length} shown of {server.pagination.total}</span>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <NativeSelect
            value={symbol}
            onChange={(event) => setLocalSymbol(event.target.value)}
          >
            <option value="ALL">All symbols</option>
            {symbols.map((item) => <option key={item} value={item}>{item}</option>)}
          </NativeSelect>
          <div className="inline-flex p-0.5">
            {["ALL", "BUY", "SELL"].map((item) => (
              <button
                type="button"
                key={item}
                onClick={() => setLocalSide(item)}
                className={`rounded px-3 py-1 transition-colors ${side === item ? "bg-panel-3 text-text" : "text-text-muted hover:text-text"}`}
              >
                {item}
              </button>
            ))}
          </div>
          <span className="ml-auto text-xs text-text-faint">{filtered.length} trades</span>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-canvas">
        {/* Column header — desktop only */}
        <div className="hidden md:grid md:grid-cols-[minmax(0,1.5fr)_1fr_0.8fr_1fr_1fr_1.1fr_1.3fr] md:items-center md:gap-3 border-b border-border bg-panel-2 px-3 py-2 text-(length:--term-text-2xs) font-medium uppercase tracking-wide text-text-faint" aria-hidden="true">
          <span>Symbol</span>
          <span>Type · Side</span>
          <span className="text-right">Volume</span>
          <span className="text-right">Swap</span>
          <span className="text-right">Commission</span>
          <span className="text-right">Net P&L</span>
          <span>Closed</span>
        </div>
        <ul>
          {filtered.map((row) => {
            const up = row.netProfit >= 0;
            return (
              <li
                key={row.id}
                onClick={rowNavigate(router, row.symbol)}
                className="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 border-b border-border-soft px-3 py-3 transition-colors last:border-b-0 hover:bg-panel-2 md:grid-cols-[minmax(0,1.5fr)_1fr_0.8fr_1fr_1fr_1.1fr_1.3fr] md:gap-3 md:py-2.5"
              >
                <div className="min-w-0 md:col-start-1">
                  <span className="text-sm font-medium"><SymbolLink symbol={row.symbol} /></span>
                  <div className="mt-0.5 text-(length:--term-text-xs) tnum text-text-muted md:hidden">
                    {row.side} · {row.volume.toFixed(2)} lots · {fmtSigned(row.swap)} swap / {fmtSigned(-row.commission)} comm
                  </div>
                  <div className="mt-0.5 text-(length:--term-text-2xs) text-text-faint md:hidden">{fmtDateTime(row.closedAt)}</div>
                </div>
                <div className={`text-right text-sm font-semibold tnum md:col-start-6 ${up ? "text-up" : "text-down"}`}>
                  {fmtSigned(row.netProfit)}
                  <span className="md:hidden block text-(length:--term-text-2xs) font-normal text-text-faint">net P&L</span>
                </div>
                <div className="hidden md:block md:col-start-2 text-(length:--term-text-sm) text-text-muted">{row.type} · <span className={row.side === "BUY" ? "text-up" : "text-down"}>{row.side}</span></div>
                <div className="hidden md:block md:col-start-3 text-right text-(length:--term-text-sm) tnum">{row.volume.toFixed(2)}</div>
                <div className="hidden md:block md:col-start-4 text-right text-(length:--term-text-sm) tnum text-text-muted">{fmtSigned(row.swap)}</div>
                <div className="hidden md:block md:col-start-5 text-right text-(length:--term-text-sm) tnum text-text-muted">{fmtSigned(-row.commission)}</div>
                <div className="hidden md:block md:col-start-7 text-(length:--term-text-xs) text-text-faint">{fmtDateTime(row.closedAt)}</div>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-4 py-10 text-center text-xs text-text-faint">No closed trades match these filters.</li>
          )}
        </ul>
      </div>

      {server && server.pagination.pageCount > 1 && (
        <nav aria-label="Trade report pages" className="flex items-center justify-between gap-3 text-xs">
          <ReportPageLink server={server} page={server.pagination.page - 1} disabled={server.pagination.page <= 1}>Previous</ReportPageLink>
          <span className="text-text-muted">Page {server.pagination.page} of {server.pagination.pageCount}</span>
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
  if (disabled) return <span aria-disabled="true" className="text-text-faint">{children}</span>;
  const params = new URLSearchParams();
  if (server.filters.symbol !== "ALL") params.set("symbol", server.filters.symbol);
  if (server.filters.side !== "ALL") params.set("side", server.filters.side);
  if (server.filters.from) params.set("from", server.filters.from);
  if (server.filters.to) params.set("to", server.filters.to);
  params.set("page", String(page));
  return <Link href={`/reports?${params.toString()}`} className="hover:border-brand">{children}</Link>;
}

function Card({ label, value, valueClass = "", sub }: { label: string; value: string; valueClass?: string; sub?: string }) {
  return <div className="p-4"><div className="text-(length:--term-text-xs) uppercase text-text-faint">{label}</div><div className={`mt-1 text-xl font-semibold tnum ${valueClass}`}>{value}</div>{sub && <div className="mt-0.5 text-(length:--term-text-xs) text-text-faint">{sub}</div>}</div>;
}
function ExtremCard({ title, row, positive, emptyLabel = "—" }: { title: string; row: ReportRow | null; positive: boolean; emptyLabel?: string }) {
  return <div className="p-4"><div className="mb-2 text-(length:--term-text-xs) uppercase text-text-faint">{title}</div>{row ? <div className="flex items-center justify-between"><div className="flex items-center gap-2"><InstrumentIcon symbol={row.symbol} size={18} /><div><div className="text-sm font-medium">{row.symbol}</div><div className="text-(length:--term-text-xs) text-text-muted">{row.side} · {row.volume.toFixed(2)} lots</div></div></div><div className={`text-lg font-semibold tnum ${positive ? "text-up" : "text-down"}`}>{fmtSigned(row.netProfit)}</div></div> : <EmptyState compact icon={positive ? <TrendingUp size={16} /> : <TrendingDown size={16} />} title={emptyLabel} />}</div>;
}
function fmtSigned(value: number): string { return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`; }
