"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useForexStore } from "@/lib/store";
import { closePosition } from "@/hooks/useOpenPosition";
import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { TerminalTable } from "@/components/trade/TerminalTable";
import { toast } from "@/lib/toast";
import { SimpleTabs as Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { fmtPrice, fmtNum } from "@/lib/format";
import { rowNavigate, SymbolLink } from "@/components/trade/SymbolLink";
import type { InstrumentView, PositionView } from "@/lib/types";

interface Props {
  instruments: InstrumentView[];
  /** Dock collapsed to its tab strip (short-laptop mode) — tables hidden. */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

type Tab = "open" | "history";

/**
 * Bottom dock — tabbed activity panel.
 *
 * Two tabs (the engine exposes no separate working-orders feed — CFD/strike
 * positions only — so no orders tab is fabricated):
 *   - "Open Positions" — live open positions with close button + floating P/L.
 *   - "Trade History" — closed positions (persisted from DB).
 *
 * Compact column set: Time, Type, Asset, Volume, Open Rate, Current Rate,
 * S/L, T/P, Swap, Commission, Profit, Close.
 */
export function PositionsTable({ instruments, collapsed = false, onToggleCollapsed }: Props) {
  const positions = useForexStore((s) => s.positions);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("open");

  const digitsFor = (symbol: string) => instruments.find((i) => i.symbol === symbol)?.digits ?? 5;
  // Match AccountBar's floatingPl: profit + swap (excludes commission, which is
  // already booked into balance at order-open to avoid double-counting in equity).
  const totalFloating = positions.reduce((s, p) => s + p.profit + p.swap, 0);

  return (
    <div className="flex h-full flex-col bg-panel">
      {/* Header: tabs + floating P/L + collapse control */}
      <div className="flex h-8 items-center bg-panel-2 px-2 shrink-0 gap-1">
        <Tabs
          variant="segmented"
          label="Positions dock"
          tabs={[
            {
              key: "open",
              label: (
                <>
                  Open Positions
                  {positions.length > 0 && (
                    <span className="ml-1 text-(length:--term-text-2xs) bg-canvas/25 rounded-full px-1.5 py-px font-medium">
                      {positions.length}
                    </span>
                  )}
                </>
              ),
            },
            { key: "history", label: "Trade History" },
          ]}
          active={tab}
          onChange={(key) => setTab(key as Tab)}
        />
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
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand activity dock" : "Collapse activity dock"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand dock" : "Collapse dock"}
            className={`rounded p-1 text-text-muted transition-colors hover:bg-panel-3 hover:text-text focus-visible:outline-2 focus-visible:outline-brand ${tab !== "open" || positions.length === 0 ? "ml-auto" : ""}`}
          >
            {collapsed ? <ChevronUp size={14} strokeWidth={2} aria-hidden /> : <ChevronDown size={14} strokeWidth={2} aria-hidden />}
          </button>
        )}
      </div>

      {!collapsed && (
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
      )}
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
    <ul className="pb-24">
      {positions.map((p, index) => {
        const digits = digitsFor(p.symbol);
        const up = p.netProfit >= 0;
        const closing = busy === p.id;
        return (
          <li
            key={p.id}
            onClick={rowNavigate(router, p.symbol)}
            className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors active:bg-panel-2 ${index % 2 === 1 ? "bg-panel-2/40" : ""}`}
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
              className="flex h-11 shrink-0 items-center justify-center gap-1 rounded-lg bg-down/15 px-3 text-xs font-semibold text-down transition active:scale-95 disabled:opacity-50"
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
        <Button
          variant="ghost"
          size="sm"
          disabled={busy === p.id}
          aria-label={`Close ${p.symbol} position`}
          onClick={(event) => { event.stopPropagation(); void close(p); }}
          className="h-8 w-8 p-0 text-xs text-text-muted hover:bg-down/10 hover:text-down"
        >
          {busy === p.id ? "…" : "✕"}
        </Button>
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

/** Trade-history data loading — shared by the phone cards and the md+ table.
 *  useInfiniteQuery holds the cursor pages; refetches preserve the loaded
 *  depth, so "Load 25 more" context survives background syncs. */
function useHistoryData() {
  // True once the user pages past the first 25 rows — the auto-sync poll
  // must not run in that state; a refetch would pull every loaded page back
  // to the newest rows and yank the browsed context.
  const pagedRef = useRef(false);

  const { data, isPending, isFetchingNextPage, error: queryError, fetchNextPage, refetch } = useInfiniteQuery({
    queryKey: ["trade-history"],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ status: "CLOSED", limit: "25" });
      if (pageParam) params.set("cursor", pageParam);
      const response = await fetch(`/api/positions?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`History request failed with status ${response.status}`);
      const payload = (await response.json()) as { positions?: PositionView[]; nextCursor?: string | null };
      return { rows: payload.positions ?? [], nextCursor: payload.nextCursor ?? null };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    // Auto-sync so newly closed positions appear without a manual refresh —
    // paused in hidden tabs natively, and off once the user pages back.
    refetchInterval: () => (document.hidden || pagedRef.current ? false : 30_000),
    staleTime: 20_000,
  });

  const history = useMemo(() => data?.pages.flatMap((page) => page.rows) ?? [], [data]);
  const nextCursor = data?.pages.at(-1)?.nextCursor ?? null;
  const loading = isPending;
  const loadingMore = isFetchingNextPage;
  const error = queryError ? "Trade history could not be loaded." : null;

  const loadHistory = useCallback(
    async (cursor?: string, append = false) => {
      pagedRef.current = append;
      if (append || cursor) await fetchNextPage();
      else await refetch();
    },
    [fetchNextPage, refetch],
  );

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
        <Button variant="default" size="sm" onClick={retry}>Retry</Button>
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
      <ul>
        {history.map((p, index) => {
          const digits = digitsFor(p.symbol);
          const up = p.netProfit >= 0;
          return (
            <li
              key={p.id}
              onClick={rowNavigate(router, p.symbol)}
              className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors active:bg-panel-2 ${index % 2 === 1 ? "bg-panel-2/40" : ""}`}
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
          <Button variant="default" size="sm" disabled={loadingMore} onClick={() => void loadHistory(nextCursor, true)}>
            {loadingMore ? "Loading…" : "Load 25 more"}
          </Button>
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
        <div className="flex justify-center bg-panel-2 p-2">
          <Button variant="default" size="sm" disabled={loadingMore} onClick={() => void loadHistory(nextCursor, true)}>
            {loadingMore ? "Loading…" : "Load 25 more"}
          </Button>
        </div>
      ) : undefined}
    />
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
