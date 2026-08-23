"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForexStore } from "@/lib/store";
import { closePosition } from "@/hooks/useOpenPosition";
import { toast } from "@/lib/toast";
import { fmtPrice, fmtNum } from "@/lib/format";
import { rowNavigate, SymbolLink } from "@/components/trade/SymbolLink";
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
  // Match AccountBar's floatingPl: profit + swap (excludes commission, which is
  // already booked into balance at order-open to avoid double-counting in equity).
  const totalFloating = positions.reduce((s, p) => s + p.profit + p.swap, 0);

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
                {totalFloating >= 0 ? "+" : ""}{fmtNum(totalFloating, 2)} USD
              </span>
            </div>
          </div>
        )}
      </div>

  {/* Table body — phones get full-width position cards (the close action is
      always visible without horizontal scrolling); md+ keeps the dense table. */}
  <div className="flex-1 min-h-0 overflow-auto">
    {tab === "open" ? (
      <>
        <div className="md:hidden">
          <OpenPositionCards positions={positions} digitsFor={digitsFor} busy={busy} setBusy={setBusy} />
        </div>
        <div className="hidden md:block">
          <OpenPositionsTable positions={positions} digitsFor={digitsFor} busy={busy} setBusy={setBusy} />
        </div>
      </>
    ) : (
      <>
        <div className="md:hidden">
          <HistoryCards digitsFor={digitsFor} />
        </div>
        <div className="hidden md:block">
          <HistoryTable digitsFor={digitsFor} />
        </div>
      </>
    )}
  </div>
</div>
);
}

/** Shared close action for a position: instant toast with the realized result,
 *  inline failure feedback. */
function makeCloseHandler(busy: string | null, setBusy: (v: string | null) => void) {
  return async (position: { id: string; symbol: string }) => {
    if (busy) return;
    setBusy(position.id);
    const result = await closePosition(position.id);
    setBusy(null);
    if (result.ok) {
      // The DB notification for the manual close arrives separately (history +
      // other sessions); the acting user gets this immediate confirmation.
      const profit = result.netProfit ?? 0;
      toast.success(
        `${result.symbol ?? position.symbol} closed`,
        `Position closed at market. Realized P/L ${profit >= 0 ? "+" : "−"}${Math.abs(profit).toFixed(2)} USD.`,
      );
    } else {
      const ev = new CustomEvent("blckforest:toast", { detail: { type: "error", message: `Failed to close ${position.symbol}. Try again or contact support.` } });
      window.dispatchEvent(ev);
    }
  };
}

function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-text-faint gap-2 py-6">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-40" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
      <span className="text-xs">{title}</span>
      {hint && <span className="text-[10px] text-text-faint">{hint}</span>}
    </div>
  );
}

function SideBadge({ side, type }: { side: "BUY" | "SELL"; type: "CFD" | "STRIKE" }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
      side === "BUY" ? "bg-up/10 text-up" : "bg-down/10 text-down"
    }`}>
      {side === "BUY" ? "▲" : "▼"} {type === "STRIKE" ? "STRIKE" : "CFD"} {side}
    </span>
  );
}

/**
 * Phone layout for open positions. Each position is a full-width card: the
 * thumb-sized Close button sits at the right edge of every card so closing a
 * trade never requires scrolling — horizontally to reveal a table column or
 * vertically past the floating Trade button. The bottom padding keeps the last
 * card's Close clear of the fixed Trade FAB.
 */
function OpenPositionCards({
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
  const router = useRouter();
  const close = makeCloseHandler(busy, setBusy);
  if (positions.length === 0) {
    return <EmptyState title="No open positions" hint="Use the trade panel to open a position" />;
  }

  return (
    <ul className="divide-y divide-border-soft pb-24">
      {positions.map((p) => {
        const digits = digitsFor(p.symbol);
        const up = p.netProfit >= 0;
        const closing = busy === p.id;
        return (
          <li
            key={p.id}
            onClick={rowNavigate(router, p.symbol)}
            className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors active:bg-panel-2"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <SideBadge side={p.side} type={p.type} />
                <span className="text-sm font-bold">{p.symbol}</span>
                <span className="text-[11px] text-text-faint tnum">{fmtNum(p.volume, 2)}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[10px] tnum text-text-faint">
                <span>{fmtPrice(p.openRate, digits)}</span>
                <span aria-hidden>→</span>
                <span className="font-medium text-text-muted">{fmtPrice(p.currentRate, digits)}</span>
                <span aria-hidden>·</span>
                <span>{fmtTime(p.openedAt)}</span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end leading-tight">
              <span className={`text-sm font-bold tnum ${up ? "text-up" : "text-down"}`}>
                {up ? "+" : ""}{fmtNum(p.netProfit, 2)}
              </span>
              <span className="text-[9px] uppercase tracking-wide text-text-faint">P/L USD</span>
            </div>
            <button
              type="button"
              disabled={closing}
              aria-label={`Close ${p.symbol} position`}
              onClick={(event) => { event.stopPropagation(); void close(p); }}
              className="flex h-11 shrink-0 items-center justify-center gap-1 rounded-lg border border-down/40 bg-down/10 px-3 text-xs font-semibold text-down transition active:scale-95 disabled:opacity-50"
            >
              {closing ? "…" : "✕ Close"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Open positions tab (md+) — live data from WS store. */
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
  const router = useRouter();
  const close = makeCloseHandler(busy, setBusy);
  if (positions.length === 0) {
    return <EmptyState title="No open positions" hint="Use the trade panel to open a position" />;
  }

  return (
    <div className="min-w-max">
    <table className="w-full">
      <thead className="sticky top-0 bg-panel-2 z-10">
        <tr>
          <Th className="hidden sm:table-cell">Time</Th>
          <Th>Type</Th>
          <Th>Asset</Th>
          <Th className="text-right">Volume</Th>
          <Th className="text-right">Open Rate</Th>
          <Th className="text-right hidden md:table-cell">S/L</Th>
          <Th className="text-right hidden md:table-cell">T/P</Th>
          <Th className="text-right hidden lg:table-cell">Swap</Th>
          <Th className="text-right hidden lg:table-cell">Commission</Th>
          <Th className="text-right">Current</Th>
          <Th className="text-right">Net P/L</Th>
          <Th></Th>
        </tr>
      </thead>
      <tbody>
        {positions.map((p, idx) => {
          const digits = digitsFor(p.symbol);
          const up = p.netProfit >= 0;
          return (
            <tr
              key={p.id}
              onClick={rowNavigate(router, p.symbol)}
              className={`cursor-pointer border-t border-border-soft hover:bg-panel-2/50 transition-colors ${idx % 2 === 1 ? "bg-panel/30" : ""}`}
            >
              <Td className="text-text-muted tnum hidden sm:table-cell">{fmtTime(p.openedAt)}</Td>
              <Td><SideBadge side={p.side} type={p.type} /></Td>
              <Td className="font-semibold"><SymbolLink symbol={p.symbol} /></Td>
              <Td className="text-right tnum">{fmtNum(p.volume, 2)}</Td>
              <Td className="text-right tnum">{fmtPrice(p.openRate, digits)}</Td>
              <Td className="text-right tnum text-text-muted hidden md:table-cell">{p.stopLoss != null ? fmtPrice(p.stopLoss, digits) : "—"}</Td>
              <Td className="text-right tnum text-text-muted hidden md:table-cell">{p.takeProfit != null ? fmtPrice(p.takeProfit, digits) : "—"}</Td>
              <Td className="text-right tnum text-text-muted hidden lg:table-cell">{fmtNum(p.swap, 2)}</Td>
              <Td className="text-right tnum text-text-muted hidden lg:table-cell">{fmtNum(p.commission + p.tradingCommission, 2)}</Td>
              <Td className="text-right tnum">{fmtPrice(p.currentRate, digits)}</Td>
              <Td className={`text-right tnum font-bold ${up ? "text-up" : "text-down"}`}>
                {up ? "+" : ""}{fmtNum(p.netProfit, 2)}
              </Td>
              <Td>
                <button
                  disabled={busy === p.id}
                  aria-label={`Close ${p.symbol} position`}
                  onClick={() => void close(p)}
                  className="flex h-8 w-8 items-center justify-center rounded border border-border text-text-muted hover:text-down hover:border-down/50 hover:bg-down/10 disabled:opacity-50 transition-colors text-xs"
                >
                  {busy === p.id ? "…" : "✕"}
                </button>
              </Td>
            </tr>
          );
        })}
      </tbody>
    </table>
    </div>
  );
}

/** Trade-history data loading — shared by the phone cards and the md+ table. */
function useHistoryData() {
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

  return { history, loading, loadingMore, nextCursor, error, loadHistory };
}

function HistoryEmptyState({ loading, error, retry }: { loading: boolean; error: string | null; retry: () => void }) {
  if (loading) {
    return <div role="status" className="flex items-center justify-center h-full text-text-faint text-xs">Loading trade history…</div>;
  }
  if (error) {
    return (
      <div role="alert" className="flex flex-col items-center justify-center h-full gap-2 py-6 text-xs text-down">
        <span>{error}</span>
        <button type="button" onClick={retry} className="rounded border border-border px-3 py-1 text-text hover:border-brand">Retry</button>
      </div>
    );
  }
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

/** Phone layout for trade history — stacked cards, no horizontal scrolling. */
function HistoryCards({ digitsFor }: { digitsFor: (s: string) => number }) {
  const router = useRouter();
  const { history, loading, loadingMore, nextCursor, error, loadHistory } = useHistoryData();

  if (loading || error || history.length === 0) {
    return <HistoryEmptyState loading={loading} error={error} retry={() => void loadHistory()} />;
  }

  return (
    <div className="pb-24">
      <ul className="divide-y divide-border-soft">
        {history.map((p) => {
          const digits = digitsFor(p.symbol);
          const up = p.netProfit >= 0;
          return (
            <li
              key={p.id}
              onClick={rowNavigate(router, p.symbol)}
              className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors active:bg-panel-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <SideBadge side={p.side} type={p.type} />
                  <span className="text-sm font-bold">{p.symbol}</span>
                  <span className="text-[11px] text-text-faint tnum">{fmtNum(p.volume, 2)}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[10px] tnum text-text-faint">
                  <span>{fmtTime(p.closedAt ?? p.openedAt)}</span>
                  <span aria-hidden>·</span>
                  <span>{fmtPrice(p.openRate, digits)}</span>
                  <span aria-hidden>→</span>
                  <span className="font-medium text-text-muted">{fmtPrice(p.currentRate, digits)}</span>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end leading-tight">
                <span className={`text-sm font-bold tnum ${up ? "text-up" : "text-down"}`}>
                  {up ? "+" : ""}{fmtNum(p.netProfit, 2)}
                </span>
                <span className="text-[9px] uppercase tracking-wide text-text-faint">USD</span>
              </div>
            </li>
          );
        })}
      </ul>
      {nextCursor ? (
        <div className="flex justify-center p-2">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void loadHistory(nextCursor, true)}
            className="rounded border border-border bg-canvas px-4 py-2 text-[11px] font-medium hover:border-brand disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : "Load 25 more"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Trade history tab (md+) — fetches closed positions from the API. */
function HistoryTable({ digitsFor }: { digitsFor: (s: string) => number }) {
  const router = useRouter();
  const { history, loading, loadingMore, nextCursor, error, loadHistory } = useHistoryData();

  if (loading || error || history.length === 0) {
    return <HistoryEmptyState loading={loading} error={error} retry={() => void loadHistory()} />;
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
              <tr
                key={p.id}
                onClick={rowNavigate(router, p.symbol)}
                className={`cursor-pointer border-t border-border-soft hover:bg-panel-2/50 transition-colors ${idx % 2 === 1 ? "bg-panel/30" : ""}`}
              >
                <Td className="text-text-muted tnum">{fmtTime(p.closedAt ?? p.openedAt)}</Td>
                <Td><span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${p.side === "BUY" ? "bg-up/10 text-up" : "bg-down/10 text-down"}`}>{p.side === "BUY" ? "▲" : "▼"} {p.side}</span></Td>
                <Td className="font-semibold"><SymbolLink symbol={p.symbol} /></Td>
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
