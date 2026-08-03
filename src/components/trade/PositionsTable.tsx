"use client";

import { useCallback, useEffect, useState } from "react";
import { useForexStore } from "@/lib/store";
import { closePosition } from "@/hooks/useOpenPosition";
import { fmtPrice, fmtNum } from "@/lib/format";
import type { InstrumentView, PositionView } from "@/lib/types";

interface Props {
  instruments: InstrumentView[];
}

type Tab = "open" | "history";

/**
 * Bottom dock — tabbed positions panel matching the reference design (copy.png).
 *
 * Two tabs:
 *   - "Open Positions" — live open positions with close button + floating P/L.
 *   - "Trade History" — closed positions (persisted from DB).
 *
 * Compact column set: Time, Type, Asset, Volume, Open Rate, Current Rate,
 * S/L, T/P, Swap, Commission, Profit, Close.
 */
export function PositionsTable({ instruments }: Props) {
  const positions = useForexStore((s) => s.positions);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("open");

  const digitsFor = (symbol: string) => instruments.find((i) => i.symbol === symbol)?.digits ?? 5;
  const totalFloating = positions.reduce((s, p) => s + p.netProfit, 0);

  return (
    <div className="flex flex-col h-full bg-canvas border-t border-border">
      {/* Header: tabs + floating P/L */}
      <div className="flex items-center h-8 px-2 border-b border-border bg-panel-2 shrink-0 gap-1">
        <div className="flex items-center gap-0.5">
          <TabButton active={tab === "open"} onClick={() => setTab("open")}>
            Open Positions
            {positions.length > 0 && (
              <span className="ml-1 text-[9px] bg-brand text-white rounded-full px-1.5 py-px font-medium">
                {positions.length}
              </span>
            )}
          </TabButton>
          <TabButton active={tab === "history"} onClick={() => setTab("history")}>
            Trade History
          </TabButton>
        </div>
        {tab === "open" && positions.length > 0 && (
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-text-faint uppercase">Floating P/L</span>
              <span className={`text-[12px] font-bold tnum ${totalFloating >= 0 ? "text-up" : "text-down"}`}>
                {totalFloating >= 0 ? "+" : ""}{totalFloating.toFixed(2)} USD
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Table body */}
      <div className="flex-1 min-h-0 overflow-auto">
        {tab === "open" ? (
          <OpenPositionsTable
            positions={positions}
            digitsFor={digitsFor}
            busy={busy}
            setBusy={setBusy}
          />
        ) : (
          <HistoryTable digitsFor={digitsFor} />
        )}
      </div>
    </div>
  );
}

/** Open positions tab — live data from WS store. */
function OpenPositionsTable({
  positions,
  digitsFor,
  busy,
  setBusy,
}: {
  positions: PositionView[];
  digitsFor: (s: string) => number;
  busy: string | null;
  setBusy: (v: string | null) => void;
}) {
  if (positions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-faint gap-2 py-6">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-40">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M9 21V9" />
        </svg>
        <span className="text-xs">No open positions</span>
        <span className="text-[10px] text-text-faint">Use the trade panel to open a position</span>
      </div>
    );
  }

  return (
    <table className="w-full">
      <thead className="sticky top-0 bg-panel-2 z-10">
        <tr>
          <Th>Time</Th>
          <Th>Type</Th>
          <Th>Asset</Th>
          <Th className="text-right">Volume</Th>
          <Th className="text-right">Open Rate</Th>
          <Th className="text-right">S/L</Th>
          <Th className="text-right">T/P</Th>
          <Th className="text-right">Swap</Th>
          <Th className="text-right">Commission</Th>
          <Th className="text-right">Current</Th>
          <Th className="text-right">Profit</Th>
          <Th></Th>
        </tr>
      </thead>
      <tbody>
        {positions.map((p, idx) => {
          const digits = digitsFor(p.symbol);
          const up = p.netProfit >= 0;
          return (
            <tr key={p.id} className={`border-t border-border-soft hover:bg-panel-2/50 transition-colors ${idx % 2 === 1 ? "bg-panel/30" : ""}`}>
              <Td className="text-text-muted tnum">{fmtTime(p.openedAt)}</Td>
              <Td>
                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                  p.side === "BUY" ? "bg-up/10 text-up" : "bg-down/10 text-down"
                }`}>
                  {p.side === "BUY" ? "▲" : "▼"} {p.type === "STRIKE" ? "STRIKE" : "CFD"} {p.side}
                </span>
              </Td>
              <Td className="font-semibold">{p.symbol}</Td>
              <Td className="text-right tnum">{fmtNum(p.volume, 2)}</Td>
              <Td className="text-right tnum">{fmtPrice(p.openRate, digits)}</Td>
              <Td className="text-right tnum text-text-muted">{p.stopLoss != null ? fmtPrice(p.stopLoss, digits) : "—"}</Td>
              <Td className="text-right tnum text-text-muted">{p.takeProfit != null ? fmtPrice(p.takeProfit, digits) : "—"}</Td>
              <Td className="text-right tnum text-text-muted">{fmtNum(p.swap, 2)}</Td>
              <Td className="text-right tnum text-text-muted">{fmtNum(p.commission + p.tradingCommission, 2)}</Td>
              <Td className="text-right tnum">{fmtPrice(p.currentRate, digits)}</Td>
              <Td className={`text-right tnum font-bold ${up ? "text-up" : "text-down"}`}>
                {up ? "+" : ""}{fmtNum(p.netProfit, 2)}
              </Td>
              <Td>
                <button
                  disabled={busy === p.id}
                  onClick={async () => {
                    setBusy(p.id);
                    await closePosition(p.id);
                    setBusy(null);
                  }}
                  className="text-[10px] px-2 py-0.5 rounded border border-border text-text-muted hover:text-down hover:border-down/50 disabled:opacity-50 transition-colors"
                >
                  {busy === p.id ? "…" : "✕"}
                </button>
              </Td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Trade history tab — fetches closed positions from the API. */
function HistoryTable({ digitsFor }: { digitsFor: (s: string) => number }) {
  const [history, setHistory] = useState<PositionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async (cursor?: string, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ status: "CLOSED", limit: "25" });
      if (cursor) params.set("cursor", cursor);
      const response = await fetch(`/api/positions?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`History request failed with status ${response.status}`);
      const data = (await response.json()) as { positions?: PositionView[]; nextCursor?: string | null };
      const rows = data.positions ?? [];
      setHistory((current) => (append ? [...current, ...rows] : rows));
      setNextCursor(data.nextCursor ?? null);
    } catch {
      setError("Trade history could not be loaded.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  // Auto-sync: poll every 30s so newly closed positions appear without manual refresh.
  useEffect(() => {
    const timer = window.setInterval(() => void loadHistory().catch(() => undefined), 30_000);
    return () => window.clearInterval(timer);
  }, [loadHistory]);

  if (loading) {
    return <div role="status" className="flex items-center justify-center h-full text-text-faint text-xs">Loading trade history…</div>;
  }
  if (error) {
    return (
      <div role="alert" className="flex flex-col items-center justify-center h-full gap-2 py-6 text-xs text-down">
        <span>{error}</span>
        <button type="button" onClick={() => void loadHistory()} className="rounded border border-border px-3 py-1 text-text hover:border-brand">Retry</button>
      </div>
    );
  }
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-faint gap-2 py-6">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-40" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" strokeLinecap="round" />
        </svg>
        <span className="text-xs">No trade history yet</span>
      </div>
    );
  }

  return (
    <div className="min-w-max">
      <table className="w-full">
        <thead className="sticky top-0 bg-panel-2 z-10">
          <tr>
            <Th>Closed Time</Th>
            <Th>Type</Th>
            <Th>Asset</Th>
            <Th className="text-right">Volume</Th>
            <Th className="text-right">Open Rate</Th>
            <Th className="text-right">Close Rate</Th>
            <Th className="text-right">Swap</Th>
            <Th className="text-right">Commission</Th>
            <Th className="text-right">Result</Th>
          </tr>
        </thead>
        <tbody>
          {history.map((p, idx) => {
            const digits = digitsFor(p.symbol);
            const up = p.netProfit >= 0;
            return (
              <tr key={p.id} className={`border-t border-border-soft ${idx % 2 === 1 ? "bg-panel/30" : ""}`}>
                <Td className="text-text-muted tnum">{fmtTime(p.closedAt ?? p.openedAt)}</Td>
                <Td><span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${p.side === "BUY" ? "bg-up/10 text-up" : "bg-down/10 text-down"}`}>{p.side === "BUY" ? "▲" : "▼"} {p.side}</span></Td>
                <Td className="font-semibold">{p.symbol}</Td>
                <Td className="text-right tnum">{fmtNum(p.volume, 2)}</Td>
                <Td className="text-right tnum">{fmtPrice(p.openRate, digits)}</Td>
                <Td className="text-right tnum">{fmtPrice(p.currentRate, digits)}</Td>
                <Td className="text-right tnum text-text-muted">{fmtNum(p.swap, 2)}</Td>
                <Td className="text-right tnum text-text-muted">{fmtNum(p.commission + p.tradingCommission, 2)}</Td>
                <Td className={`text-right tnum font-bold ${up ? "text-up" : "text-down"}`}>{up ? "+" : ""}{fmtNum(p.netProfit, 2)}</Td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {nextCursor ? (
        <div className="sticky left-0 flex justify-center border-t border-border bg-panel-2 p-2">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void loadHistory(nextCursor, true)}
            className="rounded border border-border bg-canvas px-4 py-1.5 text-[10px] font-medium hover:border-brand disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : "Load 25 more"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
        active ? "bg-canvas text-text shadow-sm border border-border" : "text-text-muted hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`text-left font-medium text-text-faint text-[9px] uppercase tracking-wide px-2 py-1.5 whitespace-nowrap ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-2 py-1 text-[11px] whitespace-nowrap ${className}`}>{children}</td>;
}

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export type { PositionView };
