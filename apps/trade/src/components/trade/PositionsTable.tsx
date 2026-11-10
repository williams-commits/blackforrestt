"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ChartCandlestick,
  Clock3,
  History,
  PanelBottomClose,
  PanelBottomOpen,
  Pencil,
  Save,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { useForexStore } from "@/lib/store";
import { closePosition, updatePositionProtection } from "@/hooks/useOpenPosition";
import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { TerminalTable } from "@/components/trade/TerminalTable";
import { toast } from "@/lib/toast";
import { SimpleTabs as Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SimpleDialog } from "@/components/ui/Dialog";
import { fmtPrice, fmtNum } from "@/lib/format";
import { rowNavigate, SymbolLink } from "@/components/trade/SymbolLink";
import type { InstrumentView, PositionView } from "@/lib/types";
import { formatNextMarketOpen } from "@/lib/marketHours";

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
  const [editingPosition, setEditingPosition] = useState<PositionView | null>(null);
  const dockRef = useRef<HTMLDivElement>(null);

  const marketHoursFor = useCallback(
    (symbol: string) => instruments.find((instrument) => instrument.symbol === symbol)?.marketHours,
    [instruments],
  );
  const digitsFor = (symbol: string) => instruments.find((i) => i.symbol === symbol)?.digits ?? 5;
  // Match AccountBar's floatingPl: profit + swap (excludes commission, which is
  // already booked into balance at order-open to avoid double-counting in equity).
  const totalFloating = positions.reduce((s, p) => s + p.profit + p.swap, 0);

  return (
    <div ref={dockRef} className="flex h-full flex-col bg-panel">
      <div className={`grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 bg-panel-2 px-2 md:flex md:gap-3 md:px-3 md:py-1 mb-0.5 ${collapsed ? "py-0" : "gap-y-1.5 py-1.5"}`}>
        <div className="col-start-1 row-start-1 min-w-0 md:flex-none">
          <Tabs
            variant="segmented"
            label="Positions dock"
            className="grid h-auto w-full grid-cols-2 p-0 md:flex md:w-fit md:p-0.75"
            triggerClassName={`h-8 min-h-8 px-2 text-xs md:px-3 ${collapsed ? "" : "h-10 min-h-10 md:h-8 md:min-h-8"}`}
            tabs={[
              {
                key: "open",
                label: (
                  <>
                    <ChartCandlestick size={14} aria-hidden />
                    <span>Positions</span>
                    {positions.length > 0 && (
                      <span className="ml-0.5 rounded-full bg-canvas/25 px-1.5 py-px text-(length:--term-text-2xs) font-semibold tabular-nums">
                        {positions.length}
                      </span>
                    )}
                  </>
                ),
              },
              {
                key: "history",
                label: (
                  <>
                    <History size={14} aria-hidden />
                    <span>History</span>
                  </>
                ),
              },
            ]}
            active={tab}
            onChange={(key) => {
              const nextTab = key as Tab;
              setTab(nextTab);
              if (nextTab === "history" && window.matchMedia("(max-width: 767px)").matches) {
                requestAnimationFrame(() => {
                  dockRef.current
                    ?.closest<HTMLElement>("[data-activity-dock]")
                    ?.scrollIntoView({ block: "end", behavior: "smooth" });
                });
              }
            }}
          />
        </div>
        {onToggleCollapsed && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand activity dock" : "Collapse activity dock"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand dock" : "Collapse dock"}
            className={`col-start-2 row-start-1 ml-auto size-9 rounded-md bg-canvas/50 text-text-muted transition-colors hover:bg-panel-3 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand md:order-3 md:size-8 ${tab === "open" && positions.length > 0 ? "md:ml-0" : "md:ml-auto"}`}
          >
            {collapsed ? <PanelBottomOpen size={16} strokeWidth={2} aria-hidden /> : <PanelBottomClose size={16} strokeWidth={2} aria-hidden />}
          </Button>
        )}
        {tab === "open" && positions.length > 0 && (
          <div
            className={`col-span-2 row-start-2 flex items-center justify-between rounded-lg border border-white/5 bg-linear-to-r from-canvas/55 via-canvas/40 to-canvas/30 px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:order-2 md:ml-auto md:flex md:w-auto md:justify-start md:gap-2 md:rounded-md md:border-transparent md:bg-transparent md:px-2 md:py-1 ${collapsed ? "hidden md:flex" : ""}`}
          >
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="text-(length:--term-text-2xs) font-medium uppercase tracking-[0.14em] text-text-faint">P/L</span>
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-full ${
                  totalFloating >= 0 ? "bg-up/12 text-up" : "bg-down/12 text-down"
                }`}
                aria-hidden="true"
              >
                {totalFloating >= 0 ? <TrendingUp size={12} strokeWidth={2.4} /> : <TrendingDown size={12} strokeWidth={2.4} />}
              </div>
            </div>
            <span className={`text-(length:--term-text-sm) font-bold tabular-nums tracking-tight ${totalFloating >= 0 ? "text-up" : "text-down"}`}>
              {totalFloating >= 0 ? "+" : ""}{fmtNum(totalFloating, 2)} USD
            </span>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="flex-1 min-h-0 overflow-auto">
          {tab === "open" ? (
            <>
              <div className="md:hidden">
                <OpenPositionCards
                  positions={positions}
                  digitsFor={digitsFor}
                  marketHoursFor={marketHoursFor}
                  busy={busy}
                  setBusy={setBusy}
                  onEditProtection={setEditingPosition}
                />
              </div>
              <div className="hidden md:block">
                <OpenPositionsTable
                  positions={positions}
                  digitsFor={digitsFor}
                  marketHoursFor={marketHoursFor}
                  busy={busy}
                  setBusy={setBusy}
                  onEditProtection={setEditingPosition}
                />
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
      {editingPosition && (
        <ProtectionDialog
          key={editingPosition.id}
          position={editingPosition}
          digits={digitsFor(editingPosition.symbol)}
          onClose={() => setEditingPosition(null)}
        />
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
      toast.error(
        result.error ? `${position.symbol}: ${result.error}` : `Failed to close ${position.symbol}. Try again or contact support.`,
      );
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

function marketExecutionStatus(marketHours: InstrumentView["marketHours"] | undefined): string | null {
  if (!marketHours) return "Market status unavailable";
  if (marketHours.canTrade) return null;
  if (marketHours.isOpen) return "Waiting for quote";
  return "Market closed";
}

function marketExecutionTitle(marketHours: InstrumentView["marketHours"] | undefined): string {
  if (!marketHours) return "Market status unavailable";
  if (marketHours.canTrade) return "Market open · executable quote available";
  if (marketHours.isOpen) return "Market open · waiting for a fresh quote";
  const nextOpenLabel = formatNextMarketOpen(marketHours);
  return nextOpenLabel ? `Market closed · opens ${nextOpenLabel}` : "Market closed";
}

/**
 * Phone layout for open positions. Each position is a full-width card: the
 * thumb-sized Close button sits at the right edge of every card so closing a
 * trade never requires scrolling — horizontally to reveal a table column or
 * vertically past the floating Trade button. The dock's mobile safe-area
 * padding keeps the final card clear of the fixed tab bar.
 */
function OpenPositionCards({
  positions,
  digitsFor,
  marketHoursFor,
  busy,
  setBusy,
  onEditProtection,
}: {
  positions: PositionView[];
  digitsFor: (s: string) => number;
  marketHoursFor: (s: string) => InstrumentView["marketHours"] | undefined;
  busy: string | null;
  setBusy: (v: string | null) => void;
  onEditProtection: (position: PositionView) => void;
}) {
  const router = useRouter();
  const close = makeCloseHandler(busy, setBusy);
  if (positions.length === 0) {
    return <EmptyState title="No open positions" hint="Use the trade panel to open a position" />;
  }

  return (
    <ul>
      {positions.map((p, index) => {
        const digits = digitsFor(p.symbol);
        const up = p.netProfit >= 0;
        const closing = busy === p.id;
        const marketHours = marketHoursFor(p.symbol);
        const canClose = marketHours?.canTrade ?? false;
        const marketStatus = marketExecutionStatus(marketHours);
        return (
          <li
            key={p.id}
            onClick={rowNavigate(router, p.symbol)}
            className={`grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-3 transition-colors active:bg-panel-2 ${index % 2 === 1 ? "bg-panel-2/40" : ""}`}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <SideBadge side={p.side} type={p.type} />
                <span className="text-sm font-bold">{p.symbol}</span>
                <span className="text-(length:--term-text-xs) text-text-faint tnum">{fmtNum(p.volume, 2)}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-(length:--term-text-2xs) tnum text-text-faint">
                <span className="whitespace-nowrap">
                  {fmtPrice(p.openRate, digits)} <span aria-hidden>→</span>{" "}
                  <span className="font-medium text-text-muted">{fmtPrice(p.currentRate, digits)}</span>
                </span>
                <span className="whitespace-nowrap">{fmtTime(p.openedAt)}</span>
              </div>
              {marketStatus && (
                <span
                  title={marketExecutionTitle(marketHours)}
                  className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-(length:--term-text-2xs) font-medium leading-tight text-text-faint"
                >
                  <Clock3 size={10} strokeWidth={1.8} aria-hidden />
                  {marketStatus}
                </span>
              )}
              {p.type === "CFD" && (
                <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-(length:--term-text-2xs) tnum text-text-faint">
                  <span>S/L {p.stopLoss != null ? fmtPrice(p.stopLoss, digits) : "—"}</span>
                  <span>T/P {p.takeProfit != null ? fmtPrice(p.takeProfit, digits) : "—"}</span>
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2 leading-tight">
              <div className="flex flex-col items-end">
                <span className={`text-sm font-bold tnum ${up ? "text-up" : "text-down"}`}>
                  {up ? "+" : ""}{fmtNum(p.netProfit, 2)}
                </span>
                <span className="text-(length:--term-text-2xs) uppercase tracking-wide text-text-faint">P/L USD</span>
              </div>
              <div className="flex items-center gap-1">
                {p.type === "CFD" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit stop-loss and take-profit for ${p.symbol}`}
                    title="Edit S/L and T/P"
                    onClick={(event) => { event.stopPropagation(); onEditProtection(p); }}
                  >
                    <Pencil aria-hidden />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={closing || !canClose}
                  aria-label={`Close ${p.symbol} position`}
                  title={marketExecutionTitle(marketHours)}
                  onClick={(event) => { event.stopPropagation(); void close(p); }}
                  className="h-11 px-2.5 text-xs"
                >
                  <X aria-hidden />
                  {closing ? "Closing" : "Close"}
                </Button>
              </div>
            </div>
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
  marketHoursFor,
  busy,
  setBusy,
  onEditProtection,
}: {
  positions: PositionView[];
  digitsFor: (s: string) => number;
  marketHoursFor: (s: string) => InstrumentView["marketHours"] | undefined;
  busy: string | null;
  setBusy: (v: string | null) => void;
  onEditProtection: (position: PositionView) => void;
}) {
  const router = useRouter();
  const close = makeCloseHandler(busy, setBusy);

  const columns = useMemo<ColumnDef<PositionView, unknown>[]>(
    () => [
      { accessorKey: "openedAt", header: "Time", meta: { cellClass: "hidden sm:table-cell", headerClass: "hidden sm:table-cell" }, cell: (info) => <span className="tnum text-text-muted">{fmtTime(info.getValue() as number)}</span> },
      { id: "type", header: "Type", cell: (info) => { const p = info.row.original; return <SideBadge side={p.side} type={p.type} />; } },
      { accessorKey: "symbol", header: "Asset", cell: (info) => {
        const symbol = info.getValue() as string;
        const marketStatus = marketExecutionStatus(marketHoursFor(symbol));
        return (
          <div className="flex flex-col items-start">
            <span className="font-semibold"><SymbolLink symbol={symbol} /></span>
            {marketStatus && (
              <span
                title={marketExecutionTitle(marketHoursFor(symbol))}
                className="inline-flex max-w-28 items-center gap-1 truncate text-(length:--term-text-2xs) font-medium leading-tight text-text-faint"
              >
                <Clock3 size={10} strokeWidth={1.8} aria-hidden />
                {marketStatus}
              </span>
            )}
          </div>
        );
      } },
      { accessorKey: "volume", header: "Volume", meta: { cellClass: "text-right", headerClass: "text-right" }, cell: (info) => <span className="tnum">{fmtNum(info.getValue() as number, 2)}</span> },
      { accessorKey: "openRate", header: "Open Rate", meta: { cellClass: "text-right", headerClass: "text-right" }, cell: (info) => <span className="tnum">{fmtPrice(info.getValue() as number, digitsFor(info.row.original.symbol))}</span> },
      { id: "stopLoss", header: "S/L", meta: { cellClass: "text-right hidden md:table-cell", headerClass: "text-right hidden md:table-cell" }, cell: (info) => { const p = info.row.original; return <span className="tnum text-text-muted">{p.stopLoss != null ? fmtPrice(p.stopLoss, digitsFor(p.symbol)) : "—"}</span>; } },
      { id: "takeProfit", header: "T/P", meta: { cellClass: "text-right hidden md:table-cell", headerClass: "text-right hidden md:table-cell" }, cell: (info) => { const p = info.row.original; return <span className="tnum text-text-muted">{p.takeProfit != null ? fmtPrice(p.takeProfit, digitsFor(p.symbol)) : "—"}</span>; } },
      { accessorKey: "swap", header: "Swap", meta: { cellClass: "text-right hidden lg:table-cell", headerClass: "text-right hidden lg:table-cell" }, cell: (info) => <span className="tnum text-text-muted">{fmtNum(info.getValue() as number, 2)}</span> },
      { id: "commission", header: "Commission", meta: { cellClass: "text-right hidden lg:table-cell", headerClass: "text-right hidden lg:table-cell" }, cell: (info) => <span className="tnum text-text-muted">{fmtNum((info.row.original as PositionView).commission + (info.row.original as PositionView).tradingCommission, 2)}</span> },
      { accessorKey: "currentRate", header: "Current", meta: { cellClass: "text-right", headerClass: "text-right" }, cell: (info) => <span className="tnum">{fmtPrice(info.getValue() as number, digitsFor(info.row.original.symbol))}</span> },
      { id: "netProfit", header: "Net P/L", meta: { cellClass: "text-right", headerClass: "text-right" }, cell: (info) => { const p = info.row.original; const up = p.netProfit >= 0; return <span className={`tnum font-bold ${up ? "text-up" : "text-down"}`}>{up ? "+" : ""}{fmtNum(p.netProfit, 2)}</span>; } },
      { id: "editProtection", header: "", cell: (info) => { const p = info.row.original; return p.type === "CFD" ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Edit stop-loss and take-profit for ${p.symbol}`}
          title="Edit S/L and T/P"
          onClick={(event) => { event.stopPropagation(); onEditProtection(p); }}
        >
          <Pencil aria-hidden />
        </Button>
      ) : null; } },
      { id: "close", header: "", cell: (info) => {
        const p = info.row.original;
        const marketHours = marketHoursFor(p.symbol);
        const canClose = marketHours?.canTrade ?? false;
        return (
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={busy === p.id || !canClose}
            aria-label={`Close ${p.symbol} position`}
            title={marketExecutionTitle(marketHours)}
            onClick={(event) => { event.stopPropagation(); void close(p); }}
            className="h-8 w-8 p-0 text-xs text-text-muted hover:bg-down/10 hover:text-down"
          >
            {busy === p.id ? "…" : <X aria-hidden />}
          </Button>
        );
      } },
    ],
    // close/busy are stable per render set; digitsFor identity is stable upstream
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busy, digitsFor, marketHoursFor, onEditProtection],
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

function ProtectionDialog({
  position,
  digits,
  onClose,
}: {
  position: PositionView;
  digits: number;
  onClose: () => void;
}) {
  const [stopLoss, setStopLoss] = useState(position.stopLoss?.toString() ?? "");
  const [takeProfit, setTakeProfit] = useState(position.takeProfit?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parseLevel = (value: string): number | null | undefined => {
      if (!value.trim()) return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
    };
    const parsedStopLoss = parseLevel(stopLoss);
    const parsedTakeProfit = parseLevel(takeProfit);
    if (parsedStopLoss === undefined || parsedTakeProfit === undefined) {
      setError("Enter a positive price for each level, or leave it blank to clear it.");
      return;
    }

    setSaving(true);
    setError(null);
    const result = await updatePositionProtection(position.id, {
      stopLoss: parsedStopLoss,
      takeProfit: parsedTakeProfit,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Unable to update position protection.");
      return;
    }
    toast.success("Protection levels updated", `${position.symbol} entry price was not changed.`);
    onClose();
  };

  return (
    <SimpleDialog
      open
      onClose={onClose}
      icon={<Pencil size={14} strokeWidth={2} aria-hidden />}
      title={`Edit ${position.symbol} protection`}
      description="Adjust the stop-loss or take-profit on this open CFD position."
      className="sm:max-w-md"
    >
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="rounded-lg bg-panel-2 px-3 py-2.5 text-xs">
          <div className="flex items-center justify-between gap-3">
            <span className="text-text-faint">Position</span>
            <span className="font-medium text-text"><SideBadge side={position.side} type={position.type} /></span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <span className="text-text-faint">Entry price — unchanged</span>
            <span className="tnum font-semibold text-text">{fmtPrice(position.openRate, digits)}</span>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label htmlFor="position-stop-loss" className="flex flex-col gap-1.5 text-xs font-medium text-text-muted">
            Stop-loss
            <Input
              id="position-stop-loss"
              type="number"
              inputMode="decimal"
              min="0"
              step={Math.pow(10, -digits)}
              value={stopLoss}
              onChange={(event) => setStopLoss(event.target.value)}
              placeholder="Not set"
              aria-describedby="position-protection-hint"
            />
          </label>
          <label htmlFor="position-take-profit" className="flex flex-col gap-1.5 text-xs font-medium text-text-muted">
            Take-profit
            <Input
              id="position-take-profit"
              type="number"
              inputMode="decimal"
              min="0"
              step={Math.pow(10, -digits)}
              value={takeProfit}
              onChange={(event) => setTakeProfit(event.target.value)}
              placeholder="Not set"
              aria-describedby="position-protection-hint"
            />
          </label>
        </div>
        <p id="position-protection-hint" className="text-xs text-text-faint">
          Levels must remain on the protective side of the current market price. Leave a field blank to remove that level.
        </p>
        {error && <p role="alert" className="text-xs font-medium text-down">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="brand" size="sm" loading={saving} loadingLabel="Saving…">
            <Save aria-hidden />
            Save levels
          </Button>
        </div>
      </form>
    </SimpleDialog>
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
    return (
      <div role="status" className="flex min-h-32 w-full items-center justify-center gap-3 px-4 text-xs text-text-faint">
        <svg className="h-4 w-4 shrink-0 animate-spin text-text-muted" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-75" d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <span>Loading trade history…</span>
      </div>
    );
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
    <div>
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
