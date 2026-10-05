"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForexStore } from "@/lib/store";
import { closePosition } from "@/hooks/useOpenPosition";
import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { TerminalTable } from "@/components/trade/TerminalTable";
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
              <span className="ml-1 text-(length:--term-text-2xs) bg-brand text-white rounded-full px-1.5 py-px font-medium">
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
              <span className="text-(length:--term-text-2xs) text-text-faint uppercase">Floating P/L</span>
              <span className={`text-(length:--term-text-sm) font-bold tnum ${totalFloating >= 0 ? "text-up" : "text-down"}`}>
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
      const ev = new CustomEvent("blckforest:toast", { detail: { type: "error", message: result.error ? `${position.symbol}: ${result.error}` : `Failed to close ${position.symbol}. Try again or contact support.` } });
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
      {hint && <span className="text-(length:--term-text-2xs) text-text-faint">{hint}</span>}
    </div>
  );
}

function SideBadge({ side, type }: { side: "BUY" | "SELL"; type: "CFD" | "STRIKE" }) {
  return (
    <span className={`inline-flex items-center gap-1 text-(length:--term-text-2xs) font-semibold px-1.5 py-0.5 rounded ${
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
                <span className="text-(length:--term-text-xs) text-text-faint tnum">{fmtNum(p.volume, 2)}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-(length:--term-text-2xs) tnum text-text-faint">
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
              <span className="text-(length:--term-text-2xs) uppercase tracking-wide text-text-faint">P/L USD</span>
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

/** Open positions tab (md+) — live WS data on TerminalTable (TanStack core).
 *  Row clicks navigate via the built-in interactive-descendant guard, so the
 *  per-row Close button and SymbolLinks never double-fire. */
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

  const columns = useMemo<ColumnDef<PositionView, unknown>[]>(
    () => [
      { accessorKey: "openedAt", header: "Time", meta: { cellClass: "hidden sm:table-cell", headerClass: "hidden sm:table-cell" }, cell: (info) => <span className="tnum text-text-muted">{fmtTime(info.getValue() as number)}</span> },
      { id: "type", header: "Type", cell: (info) => { const p = info.row.original; return <SideBadge side={p.side} type={p.type} />; } },
      { accessorKey: "symbol", header: "Asset", cell: (info) => <span className="font-semibold"><SymbolLink symbol={info.getValue() as string} /></span> },
      { accessorKey: "volume", header: "Volume", meta: { cellClass: "text-right", headerClass: "text-right" }, cell: (info) => <span className="tnum">{fmtNum(info.getValue() as number, 2)}</span> },
      { accessorKey: "openRate", header: "Open Rate", meta: { cellClass: "text-right", headerClass: "text-right" }, cell: (info) => <span className="tnum">{fmtPrice(info.getValue() as number, digitsFor(info.row.original.symbol))}</span> },
      { id: "stopLoss", header: "S/L", meta: { cellClass: "text-right hidden md:table-cell", headerClass: "text-right hidden md:table-cell" }, cell: (info) => { const p = info.row.original; return <span className="tnum text-text-muted">{p.stopLoss != null ? fmtPrice(p.stopLoss, digitsFor(p.symbol)) : "—"}</span>; } },
      { id: "takeProfit", header: "T/P", meta: { cellClass: "text-right hidden md:table-cell", headerClass: "text-right hidden md:table-cell" }, cell: (info) => { const p = info.row.original; return <span className="tnum text-text-muted">{p.takeProfit != null ? fmtPrice(p.takeProfit, digitsFor(p.symbol)) : "—"}</span>; } },
      { accessorKey: "swap", header: "Swap", meta: { cellClass: "text-right hidden lg:table-cell", headerClass: "text-right hidden lg:table-cell" }, cell: (info) => <span className="tnum text-text-muted">{fmtNum(info.getValue() as number, 2)}</span> },
      { id: "commission", header: "Commission", meta: { cellClass: "text-right hidden lg:table-cell", headerClass: "text-right hidden lg:table-cell" }, cell: (info) => <span className="tnum text-text-muted">{fmtNum((info.row.original as PositionView).commission + (info.row.original as PositionView).tradingCommission, 2)}</span> },
      { accessorKey: "currentRate", header: "Current", meta: { cellClass: "text-right", headerClass: "text-right" }, cell: (info) => <span className="tnum">{fmtPrice(info.getValue() as number, digitsFor(info.row.original.symbol))}</span> },
      { id: "netProfit", header: "Net P/L", meta: { cellClass: "text-right", headerClass: "text-right" }, cell: (info) => { const p = info.row.original; const up = p.netProfit >= 0; return <span className={`tnum font-bold ${up ? "text-up" : "text-down"}`}>{up ? "+" : ""}{fmtNum(p.netProfit, 2)}</span>; } },
      { id: "close", header: "", cell: (info) => { const p = info.row.original; return (
        <button
          disabled={busy === p.id}
          aria-label={`Close ${p.symbol} position`}
          onClick={(event) => { event.stopPropagation(); void close(p); }}
          className="flex h-8 w-8 items-center justify-center rounded border border-border text-text-muted hover:text-down hover:border-down/50 hover:bg-down/10 disabled:opacity-50 transition-colors text-xs"
        >
          {busy === p.id ? "…" : "✕"}
        </button>
      ); } },
    ],
    // close/busy are stable per render set; digitsFor identity is stable upstream
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busy, digitsFor],
  );

  return (
    <TerminalTable
      ariaLabel="Open positions"
      data={positions}
      columns={columns}
      minWidth={980}
      onRowClick={(p) => router.push(`/trade/${p.symbol}`)}
      emptyState={<EmptyState title="No open positions" hint="Use the trade panel to open a position" />}
    />
  );
}

/** Trade-history data loading — shared by the phone cards and the md+ table. */
function useHistoryData() {
  const [history, setHistory] = useState<PositionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // True once the user pages past the first 25 rows ("Load 25 more"). The
  // auto-sync poll below must not run in that state — it fetches page 1 and
  // would yank the browsed list back to the newest 25 rows every 30 seconds.
  const pagedRef = useRef(false);

  const loadHistory = useCallback(async (cursor?: string, append = false) => {
    pagedRef.current = append;
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

  // Auto-sync: poll every 30s so newly closed positions appear without manual
  // refresh. Skipped while hidden or once the user has paged into older
  // history — reloading page 1 there would discard their scrolled context.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.hidden || pagedRef.current) return;
      void loadHistory().catch(() => undefined);
    }, 30_000);
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
                  <span className="text-(length:--term-text-xs) text-text-faint tnum">{fmtNum(p.volume, 2)}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-(length:--term-text-2xs) tnum text-text-faint">
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
                <span className="text-(length:--term-text-2xs) uppercase tracking-wide text-text-faint">USD</span>
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
            className="rounded border border-border bg-canvas px-4 py-2 text-(length:--term-text-xs) font-medium hover:border-brand disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : "Load 25 more"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Trade history tab (md+) — TerminalTable (TanStack core; virtualizes
 *  automatically once history grows past the threshold). */
function HistoryTable({ digitsFor }: { digitsFor: (s: string) => number }) {
  const router = useRouter();
  const { history, loading, loadingMore, nextCursor, error, loadHistory } = useHistoryData();

  const columns = useMemo<ColumnDef<PositionView, unknown>[]>(
    () => [
      { accessorKey: "closedAt", header: "Closed Time", cell: (info) => <span className="tnum text-text-muted">{fmtTime((info.row.original as PositionView).closedAt ?? (info.row.original as PositionView).openedAt)}</span> },
      { id: "type", header: "Type", cell: (info) => { const p = info.row.original; return <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-(length:--term-text-2xs) font-semibold ${p.side === "BUY" ? "bg-up/10 text-up" : "bg-down/10 text-down"}`}>{p.side === "BUY" ? "▲" : "▼"} {p.side}</span>; } },
      { accessorKey: "symbol", header: "Asset", cell: (info) => <SymbolLink symbol={info.getValue() as string} /> },
      { accessorKey: "volume", header: "Volume", meta: { cellClass: "text-right" }, cell: (info) => <span className="tnum">{fmtNum(info.getValue() as number, 2)}</span> },
      { accessorKey: "openRate", header: "Open Rate", meta: { cellClass: "text-right" }, cell: (info) => <span className="tnum">{fmtPrice(info.getValue() as number, digitsFor(info.row.original.symbol))}</span> },
      { accessorKey: "currentRate", header: "Close Rate", meta: { cellClass: "text-right" }, cell: (info) => <span className="tnum">{fmtPrice(info.getValue() as number, digitsFor(info.row.original.symbol))}</span> },
      { accessorKey: "swap", header: "Swap", meta: { cellClass: "text-right" }, cell: (info) => <span className="tnum text-text-muted">{fmtNum(info.getValue() as number, 2)}</span> },
      { id: "commission", header: "Commission", meta: { cellClass: "text-right" }, cell: (info) => <span className="tnum text-text-muted">{fmtNum((info.row.original as PositionView).commission + (info.row.original as PositionView).tradingCommission, 2)}</span> },
      { id: "result", header: "Result", meta: { cellClass: "text-right" }, cell: (info) => { const up = (info.row.original as PositionView).netProfit >= 0; const v = info.row.original.netProfit; return <span className={`tnum font-bold ${up ? "text-up" : "text-down"}`}>{up ? "+" : ""}{fmtNum(v, 2)}</span>; } },
    ],
    [digitsFor],
  );

  return (
    <TerminalTable
      ariaLabel="Trade history"
      data={history}
      columns={columns}
      onRowClick={(p) => rowNavigate(router, p.symbol)({ stopPropagation: () => undefined, target: null, currentTarget: null } as unknown as Parameters<ReturnType<typeof rowNavigate>>[0])}
      emptyState={<HistoryEmptyState loading={loading} error={error} retry={() => void loadHistory()} />}
      footer={nextCursor ? (
        <div className="flex justify-center border-t border-border bg-panel-2 p-2">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void loadHistory(nextCursor, true)}
            className="rounded border border-border bg-canvas px-4 py-1.5 text-(length:--term-text-2xs) font-medium hover:border-brand disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : "Load 25 more"}
          </button>
        </div>
      ) : undefined}
    />
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center px-2.5 py-1 text-(length:--term-text-xs) font-medium rounded transition-colors ${
        active ? "bg-canvas text-text shadow-sm border border-border" : "text-text-muted hover:text-text"
      }`}
    >
      {children}
    </button>
  );
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
