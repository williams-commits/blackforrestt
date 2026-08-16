"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { InstrumentIcon } from "@/components/icons/InstrumentIcon";
import { CsvExportButton } from "@/components/ui/CsvExport";
import { fmtDateTime } from "@/lib/dates";

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
  filters: { symbol: string; side: string };
  pagination: { page: number; pageCount: number; total: number; pageSize: number };
}

/** Trade reports: performance summary + filterable closed-trades table. */
export function ReportsView({ rows, server }: { rows: ReportRow[]; server?: ReportServerState }) {
  const [localSymbol, setLocalSymbol] = useState<string>("ALL");
  const [localSide, setLocalSide] = useState<string>("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const localSymbols = useMemo(() => Array.from(new Set(rows.map((r) => r.symbol))).sort(), [rows]);
  const symbol = server?.filters.symbol ?? localSymbol;
  const side = server?.filters.side ?? localSide;
  const symbols = server?.symbols ?? localSymbols;

  const filtered = useMemo(() => {
    const from = fromDate ? new Date(fromDate).getTime() : null;
    const to = toDate ? new Date(toDate).getTime() + 86_399_999 : null;
    return rows.filter((r) => {
      if (!server) {
        if (symbol !== "ALL" && r.symbol !== symbol) return false;
        if (side !== "ALL" && r.side !== side) return false;
      }
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
        <ExtremCard title="Best Trade" row={stats.best} positive />
        <ExtremCard title="Worst Trade" row={stats.worst} positive={false} />
      </div>

      {/* Date-range applies to both modes (client-side over the fetched page). */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
        <label className="flex items-center gap-1">
          From
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} aria-label="Closed after" className="h-8 rounded border border-border bg-canvas px-2 text-xs outline-none focus:border-brand" />
        </label>
        <span className="text-text-faint">→</span>
        <label className="flex items-center gap-1">
          To
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} aria-label="Closed before" className="h-8 rounded border border-border bg-canvas px-2 text-xs outline-none focus:border-brand" />
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
          <label className="grid gap-1 text-[11px] text-text-muted">
            Symbol
            <select name="symbol" defaultValue={symbol} className="h-9 rounded border border-border bg-canvas px-2 text-sm outline-none focus:border-brand">
              <option value="ALL">All symbols</option>
              {symbols.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-[11px] text-text-muted">
            Side
            <select name="side" defaultValue={side} className="h-9 rounded border border-border bg-canvas px-2 text-sm outline-none focus:border-brand">
              <option value="ALL">All sides</option>
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </label>
          <button type="submit" className="h-9 rounded bg-brand px-4 text-xs font-medium text-white hover:brightness-95">Apply filters</button>
          <span className="ml-auto text-xs text-text-faint">{filtered.length} shown of {server.pagination.total}</span>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={symbol}
            onChange={(event) => setLocalSymbol(event.target.value)}
            className="h-9 rounded border border-border bg-canvas px-2 text-sm outline-none focus:border-brand"
          >
            <option value="ALL">All symbols</option>
            {symbols.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <div className="inline-flex rounded border border-border bg-panel-2 p-0.5 text-xs">
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

      <div className="overflow-hidden overflow-x-auto rounded-lg border border-border bg-canvas">
        <table className="w-full min-w-[820px]">
          <thead className="border-b border-border-soft bg-panel-2">
            <tr>
              <Th>Symbol</Th><Th>Type</Th><Th>Side</Th><Th className="text-right">Volume</Th>
              <Th className="text-right">Swap</Th><Th className="text-right">Commission</Th>
              <Th className="text-right">Net P&L</Th><Th>Closed</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const up = row.netProfit >= 0;
              return (
                <tr key={row.id} className="border-b border-border-soft last:border-b-0 hover:bg-panel-2">
                  <Td className="font-medium"><span className="flex items-center gap-1.5"><InstrumentIcon symbol={row.symbol} size={14} />{row.symbol}</span></Td>
                  <Td className="text-text-muted">{row.type}</Td>
                  <Td><span className={row.side === "BUY" ? "text-up" : "text-down"}>{row.side}</span></Td>
                  <Td className="text-right tnum">{row.volume.toFixed(2)}</Td>
                  <Td className="text-right tnum text-text-muted">{fmtSigned(row.swap)}</Td>
                  <Td className="text-right tnum text-text-muted">{fmtSigned(-row.commission)}</Td>
                  <Td className={`text-right tnum font-medium ${up ? "text-up" : "text-down"}`}>{fmtSigned(row.netProfit)}</Td>
                  <Td className="text-[11px] text-text-faint">{fmtDateTime(row.closedAt)}</Td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-xs text-text-faint">No closed trades match these filters.</td></tr>
            )}
          </tbody>
        </table>
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
  return {
    net: rows.reduce((sum, row) => sum + row.netProfit, 0),
    winRate: rows.length ? (wins.length / rows.length) * 100 : 0,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? null : 0,
    totalSwap: rows.reduce((sum, row) => sum + row.swap, 0),
    totalComm: rows.reduce((sum, row) => sum + row.commission, 0),
    trades: rows.length,
    best: rows.reduce((best, row) => row.netProfit > (best?.netProfit ?? -Infinity) ? row : best, null as ReportRow | null),
    worst: rows.reduce((worst, row) => row.netProfit < (worst?.netProfit ?? Infinity) ? row : worst, null as ReportRow | null),
  };
}

function ReportPageLink({ server, page, disabled, children }: { server: ReportServerState; page: number; disabled: boolean; children: React.ReactNode }) {
  if (disabled) return <span aria-disabled="true" className="rounded border border-border px-3 py-2 text-text-faint">{children}</span>;
  const params = new URLSearchParams();
  if (server.filters.symbol !== "ALL") params.set("symbol", server.filters.symbol);
  if (server.filters.side !== "ALL") params.set("side", server.filters.side);
  params.set("page", String(page));
  return <Link href={`/reports?${params.toString()}`} className="rounded border border-border px-3 py-2 text-text hover:border-brand">{children}</Link>;
}

function Card({ label, value, valueClass = "", sub }: { label: string; value: string; valueClass?: string; sub?: string }) {
  return <div className="rounded-lg border border-border bg-canvas p-4"><div className="text-[11px] uppercase text-text-faint">{label}</div><div className={`mt-1 text-xl font-semibold tnum ${valueClass}`}>{value}</div>{sub && <div className="mt-0.5 text-[11px] text-text-faint">{sub}</div>}</div>;
}
function ExtremCard({ title, row, positive }: { title: string; row: ReportRow | null; positive: boolean }) {
  return <div className="rounded-lg border border-border bg-canvas p-4"><div className="mb-2 text-[11px] uppercase text-text-faint">{title}</div>{row ? <div className="flex items-center justify-between"><div className="flex items-center gap-2"><InstrumentIcon symbol={row.symbol} size={18} /><div><div className="text-sm font-medium">{row.symbol}</div><div className="text-[11px] text-text-muted">{row.side} · {row.volume.toFixed(2)} lots</div></div></div><div className={`text-lg font-semibold tnum ${positive ? "text-up" : "text-down"}`}>{fmtSigned(row.netProfit)}</div></div> : <div className="text-xs text-text-faint">—</div>}</div>;
}
function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) { return <th className={`whitespace-nowrap px-3 py-2 text-left text-[10px] font-medium uppercase text-text-faint ${className}`}>{children}</th>; }
function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) { return <td className={`whitespace-nowrap px-3 py-2 text-xs ${className}`}>{children}</td>; }
function fmtSigned(value: number): string { return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`; }
