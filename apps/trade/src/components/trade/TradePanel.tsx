"use client";

import { useEffect, useId, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, ChevronDown, Clock3, Radio, RotateCcw } from "lucide-react";
import { useForexStore } from "@/lib/store";
import type { OpenPositionController } from "@/hooks/useOpenPosition";
import { toast } from "@/lib/toast";
import { fmtPrice, fmtNum } from "@/lib/format";
import type { InstrumentView, PositionSide } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { SimpleTabs as Tabs } from "@/components/ui/Tabs";
import { InstrumentIcon } from "@/components/icons/InstrumentIcon";
import { formatQuoteAge, isExecutableQuote, quoteAgeMs } from "@/lib/marketFreshness";
import { formatNextMarketOpen, marketHoursForSymbol } from "@/lib/marketHours";
import { Input } from "@/components/ui/Input";
import { Slider } from "@/components/ui/slider";
import { Alert } from "@/components/ui/Alert";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  instrument: InstrumentView;
  orderController: OpenPositionController;
  marketDataConnected: boolean;
  initialSide?: PositionSide | null;
  /** Opens the instrument switcher slide-out (the ticket's selector button). */
  onSwitchInstrument?: () => void;
}

interface InstrumentLeverage {
  enabled: boolean;
  default: number | null;
  maximum: number | null;
  selected: number | null;
  preference: number | null;
  contractSize: number | null;
  quoteToAccountRate: number | null;
  conversionAvailable: boolean;
}

async function loadInstrumentLeverage(symbol: string): Promise<InstrumentLeverage> {
  const response = await fetch(`/api/leverage?symbol=${encodeURIComponent(symbol)}`, { cache: "no-store" });
  const data = await response.json().catch(() => ({})) as InstrumentLeverage & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Unable to load leverage settings.");
  return data;
}

/**
 * Trade panel — enterprise-grade order ticket for placing forex/CFD trades.
 *
 * Two modes:
 *   - CFD: open at the current market rate, hold, close manually. SL/TP optional.
 *   - Strike: open at a strike rate, settle after expiry.
 *
 * Shows live bid/ask, volume with quick-select, margin/commission preview,
 * and prominent Sell/Buy buttons with the dealing rate.
 */
export function TradePanel({
  instrument,
  orderController,
  marketDataConnected,
  initialSide = null,
  onSwitchInstrument,
}: Props) {
  const [type, setType] = useState<"CFD" | "STRIKE">("CFD");
  const [volume, setVolume] = useState("0.10");
  // Quick order entry: remember the last-used size across visits so a
  // returning trader is one tap away from a familiar ticket.
  useEffect(() => {
    const saved = window.localStorage.getItem("blckforest:quick-volume");
    if (saved) setVolume(saved);
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem("blckforest:quick-volume", volume);
    } catch { /* storage unavailable */ }
  }, [volume]);
  // Armed side: tapping a live rate card focuses that side of the ticket —
  // the matching submit button is emphasized. Arming never submits.
  const [armed, setArmed] = useState<PositionSide | null>(initialSide);
  const [strikeRate, setStrikeRate] = useState("");
  const [expiryMinutes, setExpiryMinutes] = useState("5");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [showSLTP, setShowSLTP] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [stalePriceAcknowledged, setStalePriceAcknowledged] = useState(false);
  const [leverage, setLeverage] = useState<InstrumentLeverage | null>(null);
  const [leverageDraft, setLeverageDraft] = useState<number | null>(null);
  const [leverageSaving, setLeverageSaving] = useState(false);
  const [leverageStatus, setLeverageStatus] = useState<"loading" | "ready" | "error">("loading");
  const [leverageError, setLeverageError] = useState<string | null>(null);
  const { openPosition, loading, error, clearError, status, lastAcceptedAt } = orderController;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let active = true;
    setLeverage(null);
    setLeverageDraft(null);
    setLeverageStatus("loading");
    setLeverageError(null);
    void loadInstrumentLeverage(instrument.symbol)
      .then((data) => {
        if (!active) return;
        setLeverage(data);
        setLeverageDraft(data.selected);
        setLeverageStatus("ready");
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setLeverageError(cause instanceof Error ? cause.message : "Unable to load leverage settings.");
        setLeverageStatus("error");
      });
    return () => { active = false; };
  }, [instrument.symbol]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    setArmed(initialSide);
  }, [initialSide]);
  const volumeId = useId();
  const strikeId = useId();
  const stopLossId = useId();
  const takeProfitId = useId();
  const riskControlsId = useId();
  const stalePriceAcknowledgementId = useId();

  function clearMessages(): void {
    setValidationError(null);
    clearError();
  }

  const quote = useForexStore((s) => s.quote);
  const account = useForexStore((s) => s.account);
  const currentQuote = quote?.symbol === instrument.symbol ? quote : null;
  const quoteMatches = currentQuote !== null;
  const bid = currentQuote?.bid ?? instrument.bid;
  const ask = currentQuote?.ask ?? instrument.ask;
  const currentQuoteAgeMs = quoteAgeMs(currentQuote, now);
  const currentMarketHours = marketHoursForSymbol(instrument.symbol, now, currentQuote?.time ?? 0);
  const hasFreshQuote = isExecutableQuote(currentQuote, instrument.symbol, now);
  const quoteReady = marketDataConnected && hasFreshQuote && currentMarketHours.canTrade;
  const staleQuoteAvailable = Boolean(
    quoteMatches &&
    currentQuote?.time &&
    currentQuote.time > 0 &&
    currentQuote.time <= now + 5_000 &&
    currentMarketHours.isOpen &&
    !currentMarketHours.canTrade,
  );
  const quotePriceAvailable = quoteReady || staleQuoteAvailable;
  const canSubmit = (quoteReady || (staleQuoteAvailable && stalePriceAcknowledged)) &&
    leverageStatus === "ready" &&
    !leverageSaving &&
    (type !== "CFD" || leverage?.conversionAvailable !== false) &&
    (type !== "CFD" || !leverage?.enabled || leverageDraft === leverage.selected);
  const nextOpenLabel = formatNextMarketOpen(currentMarketHours);
  const sessionLabel = currentMarketHours.isOpen ? "Open" : "Closed";
  const quoteStateLabel = !currentMarketHours.isOpen
    ? "Session closed"
    : quoteReady
      ? "Live quote"
      : staleQuoteAvailable
        ? "Stale quote · acknowledgment required"
        : !marketDataConnected
          ? "Data offline"
          : "Waiting for quote";
  const changePct = currentQuote?.changePct ?? instrument.changePct;
  const changeIsPositive = changePct >= 0;
  const spread = ask - bid;

  const vol = Number(volume);
  const sliderVolume = Number.isFinite(vol) ? Math.min(100, Math.max(0.01, vol)) : 0.1;
  const sliderValue = Math.round((Math.log(sliderVolume / 0.01) / Math.log(100 / 0.01)) * 1_000);
  const leverageMaximum = Math.max(1, leverage?.maximum ?? 1);
  const leverageTicks = [...new Set(
    Array.from({ length: 5 }, (_, index) => index === 0
      ? 1
      : Math.round((leverageMaximum * index) / 4 * 100) / 100),
  )];
  const selectedLeverage = Math.min(
    leverageMaximum,
    Math.max(1, leverageDraft ?? leverage?.selected ?? 1),
  );
  const marginEntryRate = Math.max(ask, bid);
  const quoteToAccountRate = currentQuote?.quoteToAccountRate
    ?? instrument.quoteToAccountRate
    ?? leverage?.quoteToAccountRate
    ?? null;
  const contractSize = leverage?.contractSize ?? instrument.contractSize;
  const leveragedMargin = leverage?.enabled &&
    type === "CFD" &&
    leverageDraft != null &&
    contractSize > 0 &&
    quoteToAccountRate != null &&
    quoteToAccountRate > 0
    ? vol * marginEntryRate * contractSize * quoteToAccountRate / leverageDraft
    : null;
  const margin = Number.isFinite(vol)
    ? leveragedMargin != null && Number.isFinite(leveragedMargin)
      ? leveragedMargin
      : vol * instrument.marginPerLot
    : 0;
  const commission = Number.isFinite(vol) ? vol * instrument.commissionPerLot : 0;
  const pipValue = Number.isFinite(vol)
    ? contractSize > 0 && quoteToAccountRate != null && quoteToAccountRate > 0
      ? vol * instrument.pipSize * contractSize * quoteToAccountRate
      : vol * instrument.pipValue
    : 0;
  const requiredCash = margin + commission;
  // Advances are included in ledger available funds; the Credit metric is
  // informational and must not be added to or subtracted from this pool.
  const freeMargin = account?.available ?? 0;
  const hasValidVolume = Number.isFinite(vol) && vol >= 0.01 && vol <= 100;
  const hasFunds = account != null && freeMargin + 1e-8 >= requiredCash;

  async function saveLeveragePreference(nextValue: number | null): Promise<void> {
    if (!leverage?.enabled || leverageSaving) return;
    if (nextValue === null && leverage.preference === null) return;
    if (nextValue !== null && nextValue === leverage.selected && nextValue === leverage.preference) return;

    setLeverageSaving(true);
    setLeverageError(null);
    let preferenceSaved = false;
    try {
      const response = await fetch("/api/leverage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scopeKey: `asset:${instrument.symbol}`, leverage: nextValue }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to save leverage preference.");
      preferenceSaved = true;

      const updated = await loadInstrumentLeverage(instrument.symbol);
      setLeverage(updated);
      setLeverageDraft(updated.selected);
      toast.success(
        nextValue === null ? "Leverage preference reset" : "Leverage preference saved",
        `${instrument.symbol} leverage applies to new positions only.`,
      );
    } catch (cause) {
      setLeverageDraft(leverage.selected);
      setLeverageError(cause instanceof Error ? cause.message : "Unable to save leverage preference.");
      if (preferenceSaved) setLeverageStatus("error");
    } finally {
      setLeverageSaving(false);
    }
  }

  useEffect(() => {
    setStalePriceAcknowledged(false);
  }, [instrument.symbol, currentMarketHours.isOpen, currentMarketHours.canTrade]);

  async function submit(side: PositionSide): Promise<void> {
    clearMessages();
    if (leverageStatus !== "ready") {
      setValidationError(leverageError ?? "Leverage settings are still loading. Retry when they are available.");
      return;
    }
    if (leverageSaving || (type === "CFD" && leverage?.enabled && leverageDraft !== leverage.selected)) {
      setValidationError("Wait for the leverage preference to finish saving before placing this order.");
      return;
    }
    if (!currentMarketHours.isOpen) {
      setValidationError(`The ${instrument.symbol} market is closed.${nextOpenLabel ? ` It reopens ${nextOpenLabel}.` : ""}`);
      return;
    }
    if (staleQuoteAvailable && !stalePriceAcknowledged) {
      setValidationError("Review and acknowledge the stale-price warning before placing this order.");
      return;
    }
    if (!quoteReady && !staleQuoteAvailable) {
      setValidationError(marketDataConnected
        ? "No valid quote is available. Wait for market data to recover before submitting an order."
        : "Market data is disconnected. Reconnect before submitting an order.");
      return;
    }
    if (!hasValidVolume) {
      setValidationError("Volume must be between 0.01 and 100 lots.");
      return;
    }
    if (!hasFunds) {
      setValidationError("Insufficient free margin for margin and commission.");
      return;
    }

    const entryRate = side === "BUY" ? ask : bid;
    const parsedStrike = strikeRate ? Number(strikeRate) : null;
    const parsedStopLoss = stopLoss ? Number(stopLoss) : null;
    const parsedTakeProfit = takeProfit ? Number(takeProfit) : null;
    if (type === "STRIKE" && parsedStrike != null && (!Number.isFinite(parsedStrike) || parsedStrike <= 0)) {
      setValidationError("Enter a valid strike rate or leave it blank to use the market rate.");
      return;
    }
    // Mirror of the server's hard gate (hub.validateOpenInput →
    // strikeRateAllowed, env STRIKE_MAX_DISTANCE_PERCENT, default 5%): a
    // strike's payoff is strike→market, so far-from-market strikes are
    // rejected server-side — fail fast with the same rule here.
    if (type === "STRIKE" && parsedStrike != null && entryRate > 0) {
      const distancePercent = (Math.abs(parsedStrike - entryRate) / entryRate) * 100;
      if (distancePercent > 5) {
        setValidationError("Strike rate must be within 5% of the live market rate.");
        return;
      }
    }
    if (type === "CFD") {
      if (parsedStopLoss != null && (!Number.isFinite(parsedStopLoss) || parsedStopLoss <= 0)) {
        setValidationError("Enter a valid stop-loss rate.");
        return;
      }
      if (parsedTakeProfit != null && (!Number.isFinite(parsedTakeProfit) || parsedTakeProfit <= 0)) {
        setValidationError("Enter a valid take-profit rate.");
        return;
      }
      if (side === "BUY" && parsedStopLoss != null && parsedStopLoss >= entryRate) {
        setValidationError("A buy stop loss must be below the entry rate.");
        return;
      }
      if (side === "BUY" && parsedTakeProfit != null && parsedTakeProfit <= entryRate) {
        setValidationError("A buy take profit must be above the entry rate.");
        return;
      }
      if (side === "SELL" && parsedStopLoss != null && parsedStopLoss <= entryRate) {
        setValidationError("A sell stop loss must be above the entry rate.");
        return;
      }
      if (side === "SELL" && parsedTakeProfit != null && parsedTakeProfit >= entryRate) {
        setValidationError("A sell take profit must be below the entry rate.");
        return;
      }
    }

    const result = await openPosition({
      symbol: instrument.symbol,
      side,
      volume: vol,
      type,
      strikeRate: type === "STRIKE" ? parsedStrike : null,
      expiryMinutes: type === "STRIKE" ? Number(expiryMinutes) : null,
      stopLoss: type === "CFD" ? parsedStopLoss : null,
      takeProfit: type === "CFD" ? parsedTakeProfit : null,
      acknowledgeStalePrice: staleQuoteAvailable && stalePriceAcknowledged,
      ...(type === "CFD" && leverage?.enabled && leverageDraft != null
        ? { leverage: leverageDraft }
        : {}),
    });
    if (result.ok) {
      // Immediate local confirmation — the DB notification follows separately
      // for history and other sessions.
      toast.success(
        result.replayed ? "Order confirmed" : "Order opened",
        result.replayed
          ? "This order was already accepted; no additional position was created."
          : `${side === "BUY" ? "Buy" : "Sell"} ${vol.toFixed(2)} ${instrument.symbol} at ${entryRate.toFixed(instrument.digits)}${staleQuoteAvailable ? " after stale-price acknowledgment." : "."}`,
      );
      setStopLoss("");
      setTakeProfit("");
      if (staleQuoteAvailable) setStalePriceAcknowledged(false);
    }
  }

  return (
    <div className="glass-noise flex min-h-0 min-w-0 w-full flex-1 flex-col">
      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
      {/* ── Instrument header — the ticket's asset selector ──────────────── */}
      <div className="bg-panel-2/60 px-4 py-3">
        {onSwitchInstrument ? (
          <button
            type="button"
            onClick={onSwitchInstrument}
            aria-haspopup="dialog"
            title="Switch instrument"
            className="flex w-full items-center gap-2 rounded-lg bg-canvas px-3 py-2.5 text-left transition-colors hover:bg-panel-2 focus-visible:outline-2 focus-visible:outline-brand"
          >
            <InstrumentIcon symbol={instrument.symbol} size={24} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight">{instrument.symbol}</span>
                <span className="text-(length:--term-text-2xs) font-semibold uppercase px-1.5 py-0.5 rounded bg-brand-soft text-brand">
                  {instrument.category}
                </span>
              </span>
              <span className="block truncate text-(length:--term-text-2xs) text-text-faint">{instrument.name}</span>
            </span>
            <ArrowRight size={14} strokeWidth={2} aria-hidden className="shrink-0 text-text-faint" />
          </button>
        ) : (
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <InstrumentIcon symbol={instrument.symbol} size={24} />
                <h2 className="text-base font-bold tracking-tight">{instrument.symbol}</h2>
                <span className="text-(length:--term-text-2xs) font-semibold uppercase px-1.5 py-0.5 rounded bg-brand-soft text-brand">
                  {instrument.category}
                </span>
              </div>
              <p className="text-(length:--term-text-2xs) text-text-faint mt-0.5">{instrument.name}</p>
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-2 px-1">
          <span className={`inline-flex min-w-0 items-center gap-1 text-(length:--term-text-2xs) font-medium ${quoteReady ? "text-up" : "text-text-faint"}`}>
            <Radio size={11} strokeWidth={2} aria-hidden />
            <span className="truncate">{quoteStateLabel}</span>
          </span>
          <span className={`shrink-0 text-(length:--term-text-2xs) font-medium tabular-nums ${changeIsPositive ? "text-up" : "text-down"}`}>
            {changeIsPositive ? "+" : ""}{changePct.toFixed(2)}% 24h
          </span>
        </div>

        {!currentMarketHours.isOpen && (
          <div
            role="status"
            className="mx-1 mt-2 flex min-w-0 items-start gap-2 rounded-xl bg-panel/75 px-3 py-2.5 shadow-card ring-1 ring-border-soft backdrop-blur-xl"
          >
            <Clock3 size={15} strokeWidth={1.8} aria-hidden className="mt-0.5 shrink-0 text-brand" />
            <div className="min-w-0 space-y-0.5">
              <p className="text-(length:--term-text-xs) font-semibold text-text">Session closed</p>
              <p className="wrap-break-words text-(length:--term-text-2xs) leading-relaxed text-text-muted">
                {currentMarketHours.venue === "Schedule unavailable"
                  ? "Trading hours are not configured for this market."
                  : `Outside regular trading hours for ${currentMarketHours.venue}.`}
              </p>
              <p className="wrap-break-words text-(length:--term-text-2xs) font-medium leading-relaxed text-brand">
                {nextOpenLabel ? `Opens ${nextOpenLabel}` : "Next opening time is unavailable."}
              </p>
            </div>
          </div>
        )}

        {currentMarketHours.isOpen && !currentMarketHours.canTrade && (
          <Alert
            tone={staleQuoteAvailable ? "info" : "err"}
            role="alert"
            className={`mx-1 mt-2 ${staleQuoteAvailable ? "border border-(--term-warning-border) bg-(--term-warning-bg) text-(--term-warning-fg)" : ""}`}
            icon={<Radio aria-hidden />}
          >
            {staleQuoteAvailable ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">Stale market data</p>
                    <p className="text-(length:--term-text-2xs)">
                      Last received {formatQuoteAge(currentQuoteAgeMs)} ago
                    </p>
                  </div>
                  <span className="rounded-full bg-background/60 px-2 py-1 text-[10px] font-semibold tracking-wide">
                    ACKNOWLEDGMENT REQUIRED
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md bg-background/50 px-3 py-2">
                    <p className="text-(length:--term-text-2xs)">Last bid</p>
                    <p className="tabular-nums font-semibold">{fmtPrice(bid, instrument.digits)}</p>
                  </div>
                  <div className="rounded-md bg-background/50 px-3 py-2">
                    <p className="text-(length:--term-text-2xs)">Last ask</p>
                    <p className="tabular-nums font-semibold">{fmtPrice(ask, instrument.digits)}</p>
                  </div>
                </div>
                <p className="text-(length:--term-text-2xs)">
                  If the feed is still stale when submitted, this order will use the last recorded quote, subject to applicable spread and commission. A fresh quote arriving first takes precedence; actual execution and P/L may differ.
                </p>
                <label htmlFor={stalePriceAcknowledgementId} className="flex cursor-pointer items-start gap-2 rounded-md bg-background/50 p-3 text-(length:--term-text-2xs) font-medium">
                  <Checkbox
                    id={stalePriceAcknowledgementId}
                    checked={stalePriceAcknowledged}
                    onCheckedChange={(checked) => setStalePriceAcknowledged(checked === true)}
                    className="mt-0.5"
                  />
                  <span>
                    I understand the pricing risk and choose to submit this order.
                    <span className="mt-0.5 block font-normal opacity-80">This acknowledgment applies only to this order.</span>
                  </span>
                </label>
              </div>
            ) : (
              <div>
                <p className="font-semibold">No valid prior quote is available</p>
                <p className="mt-0.5 text-(length:--term-text-2xs)">
                  Wait for market data to recover. Orders cannot be placed without a recorded quote.
                </p>
              </div>
            )}
          </Alert>
        )}

        {/* Trade type toggle — Radix Tabs (segmented): roving focus, arrow keys. */}
        <Tabs
          variant="segmented"
          label="Order type"
          className="mt-3 w-full rounded-lg bg-panel-2 p-1"
          triggerClassName="flex-1 py-2.5"
          tabs={[
            { key: "CFD", label: "CFD" },
            { key: "STRIKE", label: "STRIKE" },
          ]}
          active={type}
          onChange={(key) => { setType(key as "CFD" | "STRIKE"); clearMessages(); }}
        />
      </div>

      {/* ── Bid / Ask — quick entry: tap a side to arm it ────────────────── */}
      <div className="px-4 py-3">
        <div className="grid grid-cols-2 gap-2.5">
          {/* Sell / Bid */}
          <button
            type="button"
            aria-pressed={armed === "SELL"}
            disabled={!quotePriceAvailable}
            onClick={() => setArmed((current) => (current === "SELL" ? null : "SELL"))}
            className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg bg-down/10 px-2 py-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-brand ${
              armed === "SELL" ? "ring-2 ring-down" : "hover:bg-down/15"
            }`}
          >
            <span className="text-(length:--term-text-2xs) font-semibold uppercase text-down tracking-wide">Sell · Bid{armed === "SELL" ? " · armed" : ""}</span>
            <span className="text-lg font-bold leading-tight tabular-nums text-down">
              {quotePriceAvailable ? fmtPrice(bid, instrument.digits) : "—"}
            </span>
          </button>
          {/* Buy / Ask */}
          <button
            type="button"
            aria-pressed={armed === "BUY"}
            disabled={!quotePriceAvailable}
            onClick={() => setArmed((current) => (current === "BUY" ? null : "BUY"))}
            className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg bg-up/10 px-2 py-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-brand ${
              armed === "BUY" ? "ring-2 ring-up" : "hover:bg-up/15"
            }`}
          >
            <span className="text-(length:--term-text-2xs) font-semibold uppercase text-up tracking-wide">Buy · Ask{armed === "BUY" ? " · armed" : ""}</span>
            <span className="text-lg font-bold leading-tight tabular-nums text-up">
              {quotePriceAvailable ? fmtPrice(ask, instrument.digits) : "—"}
            </span>
          </button>
        </div>
        <div className="mt-2 flex items-center justify-center gap-3 text-(length:--term-text-2xs) text-text-faint">
          <span>Spread <span className="tnum text-text-muted font-medium">{quotePriceAvailable ? fmtPrice(spread, instrument.digits) : "—"}</span></span>
          <span className="w-px h-3 bg-panel-3" />
          <span>Pip <span className="tnum text-text-muted font-medium">{instrument.pipSize}</span></span>
        </div>
      </div>

      {/* ── Volume ─────────────────────────────────────────────────────────── */}
      <div className="space-y-3 px-4 pb-4">
        <div className="space-y-1.5">
          <label htmlFor={volumeId} className="text-(length:--term-text-2xs) font-medium uppercase tracking-wide text-text-muted">Volume (lots)</label>
          <Input
            id={volumeId}
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            max="100"
            value={volume}
            onChange={(e) => { setVolume(e.target.value); clearMessages(); }}
            className="h-10 rounded-lg px-3 font-semibold tabular-nums transition-colors"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-(length:--term-text-2xs)">
            <span className="text-text-muted">Order size</span>
            <span className="font-semibold tabular-nums text-text">{sliderVolume.toFixed(2)} lots</span>
          </div>
          <Slider
            aria-label="Order volume in lots"
            aria-valuetext={`${sliderVolume.toFixed(2)} lots`}
            className="h-5"
            trackClassName="h-1 bg-panel-2"
            rangeClassName="bg-panel-2"
            thumbClassName="size-3 border-2 border-panel-2 bg-brand shadow-none"
            markers={
              <div aria-hidden className="pointer-events-none absolute inset-x-1 top-1/2 z-10 flex -translate-y-1/2 justify-between">
                {Array.from({ length: 5 }, (_, index) => (
                  <span key={index} className="size-1.5 rounded-full bg-panel-3" />
                ))}
              </div>
            }
            min={0}
            max={1_000}
            step={1}
            value={[sliderValue]}
            onValueChange={(value) => {
              if (value[0] != null) {
                const nextVolume = 0.01 * (100 / 0.01) ** (value[0] / 1_000);
                setVolume(nextVolume.toFixed(2));
                clearMessages();
              }
            }}
          />
          <div className="flex justify-between text-(length:--term-text-2xs) tabular-nums text-text-faint">
            <span>0.01 min</span>
            <span>100 max</span>
          </div>
          <ChipGroup
            ariaLabel="Quick volume select"
            className="grid grid-cols-4 gap-1.5"
            chipClassName="w-full"
            size="sm"
            value={volume}
            onChange={(v) => { setVolume(v); clearMessages(); }}
            options={[0.01, 0.1, 0.5, 1].map((v) => ({ value: v.toFixed(2), label: v }))}
          />
        </div>
      </div>

      {/* ── CFD leverage ──────────────────────────────────────────────────── */}
      {type === "CFD" && (
        <div className="space-y-2 px-4 pb-4" aria-label="Leverage">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-(length:--term-text-2xs) font-medium uppercase tracking-wide text-text-muted">Leverage</p>
              <p className="text-(length:--term-text-2xs) text-text-faint">{instrument.symbol}</p>
            </div>
            {leverageStatus === "ready" && leverage?.enabled && (
              <div className="flex items-center gap-2">
                <span className="font-semibold tabular-nums text-text">{Number(selectedLeverage.toFixed(2))}x</span>
                {leverage.preference != null && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-(length:--term-text-2xs)"
                    disabled={leverageSaving}
                    onClick={() => void saveLeveragePreference(null)}
                  >
                    <RotateCcw data-icon="inline-start" aria-hidden /> Reset
                  </Button>
                )}
              </div>
            )}
          </div>
          {leverageStatus === "loading" && (
            <p className="text-(length:--term-text-2xs) text-text-faint">Loading leverage settings…</p>
          )}
          {leverageStatus === "error" && (
            <Alert tone="err">{leverageError ?? "Unable to load leverage settings."}</Alert>
          )}
          {leverageStatus === "ready" && leverage?.enabled && (
            <>
              <Slider
                aria-label={`${instrument.symbol} leverage`}
                aria-valuetext={`${Number(selectedLeverage.toFixed(2))}x`}
                className="h-5"
                trackClassName="h-1.5 bg-panel-3"
                rangeClassName="bg-gradient-to-r from-up via-brand to-down"
                thumbClassName="size-5 border-2 border-panel-2 bg-brand shadow-none ring-1 ring-brand/70"
                markers={
                  <div aria-hidden className="pointer-events-none absolute inset-x-1 top-1/2 z-10 flex -translate-y-1/2 justify-between">
                    {leverageTicks.map((tick) => (
                      <span
                        key={tick}
                        className={`size-2 rounded-full ring-1 ring-panel-2 ${
                          tick < selectedLeverage ? "bg-brand" : "bg-panel-2"
                        }`}
                      />
                    ))}
                  </div>
                }
                min={1}
                max={leverageMaximum}
                step={0.01}
                value={[selectedLeverage]}
                disabled={leverageSaving || leverageMaximum === 1}
                onValueChange={(value) => {
                  if (value[0] != null) {
                    setLeverageDraft(value[0]);
                    setLeverageError(null);
                    clearMessages();
                  }
                }}
                onValueCommit={(value) => {
                  if (value[0] != null) void saveLeveragePreference(value[0]);
                }}
              />
              <div className="flex justify-between text-(length:--term-text-2xs) tabular-nums text-text-faint">
                {leverageTicks.map((tick) => <span key={tick}>{Number(tick.toFixed(2))}x</span>)}
              </div>
              <div className="flex items-center justify-between gap-2 text-(length:--term-text-2xs) text-text-faint">
                <span>Max {leverageMaximum}x · saved per instrument</span>
                <span>{leverageSaving ? "Saving…" : "New positions only"}</span>
              </div>
              {leverageError && <Alert tone="err">{leverageError}</Alert>}
            </>
          )}
          {leverageStatus === "ready" && !leverage?.enabled && leverage?.conversionAvailable !== false && (
            <Alert tone="info">
              Leverage is disabled for this instrument. The fixed margin preset applies.
            </Alert>
          )}
        </div>
      )}

      {/* ── STRIKE fields ──────────────────────────────────────────────────── */}
      {type === "STRIKE" && (
        <div className="space-y-3 px-4 pb-4">
          <div>
            <label htmlFor={strikeId} className="text-(length:--term-text-2xs) font-medium text-text-muted uppercase tracking-wide">Strike Rate</label>
            <Input
              id={strikeId}
              type="number"
              inputMode="decimal"
              value={strikeRate}
              onChange={(e) => { setStrikeRate(e.target.value); clearMessages(); }}
              placeholder={quotePriceAvailable ? `Market: ${fmtPrice(ask, instrument.digits)}` : "Waiting for quote"}
              className="mt-1.5 h-10 rounded-lg px-3 transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-(length:--term-text-2xs) font-medium uppercase tracking-wide text-text-muted">Expiry</label>
            <ChipGroup
              ariaLabel="Strike expiry"
              className="grid grid-cols-4"
              chipClassName="w-full"
              size="md"
              value={expiryMinutes}
              onChange={(m) => { setExpiryMinutes(String(m)); clearMessages(); }}
              options={[1, 5, 15, 30].map((m) => ({ value: String(m), label: `${m}m` }))}
            />
          </div>
        </div>
      )}

      {/* ── SL / TP (CFD only) ─────────────────────────────────────────────── */}
      {type === "CFD" && (
        <div className="px-4 pb-4">
          <button
            type="button"
            aria-expanded={showSLTP}
            aria-controls={riskControlsId}
            onClick={() => setShowSLTP((v) => !v)}
            className="flex min-h-9 w-full items-center justify-between gap-3 rounded-md text-left text-(length:--term-text-2xs) font-medium uppercase tracking-wide text-text-muted transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-brand"
          >
            <span>Stop Loss / Take Profit</span>
            <ChevronDown size={15} strokeWidth={2} aria-hidden className={`shrink-0 transition-transform ${showSLTP ? "rotate-180" : ""}`} />
          </button>
          {showSLTP && (
            <div id={riskControlsId} className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-(length:--term-text-2xs) font-semibold text-down">SL</span>
                  <label htmlFor={stopLossId} className="sr-only">Stop-loss rate</label>
                  <Input
                    id={stopLossId}
                    type="number"
                    inputMode="decimal"
                    value={stopLoss}
                    onChange={(e) => { setStopLoss(e.target.value); clearMessages(); }}
                    placeholder="—"
                    className="h-11 rounded-lg pl-7 pr-2 text-xs transition-colors"
                  />
                </div>
              </div>
              <div>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-(length:--term-text-2xs) font-semibold text-up">TP</span>
                  <label htmlFor={takeProfitId} className="sr-only">Take-profit rate</label>
                  <Input
                    id={takeProfitId}
                    type="number"
                    inputMode="decimal"
                    value={takeProfit}
                    onChange={(e) => { setTakeProfit(e.target.value); clearMessages(); }}
                    placeholder="—"
                    className="h-11 rounded-lg pl-7 pr-2 text-xs transition-colors"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Order summary ──────────────────────────────────────────────────── */}
      <div className="mx-4 mb-4 space-y-3 rounded-lg bg-panel-2 p-3">
        <section aria-label="Order estimate" className="space-y-2">
          <h3 className="text-(length:--term-text-2xs) font-semibold uppercase tracking-wide text-text-faint">Order estimate</h3>
          <div className="space-y-1.5">
            <SummaryRow
              label="Leverage"
              value={type !== "CFD" ? "Not applied to Strike" : leverage?.enabled ? `${Number(selectedLeverage.toFixed(2))}x` : "Legacy margin preset"}
            />
            <SummaryRow label="Margin required" value={`${fmtNum(margin, 2)} USD`} />
            <SummaryRow label="Commission" value={`${fmtNum(commission, 2)} USD`} />
            <SummaryRow label="Required to open" value={`${fmtNum(requiredCash, 2)} USD`} valueClass="font-semibold" />
          </div>
          {leverageStatus === "error" && <Alert tone="err">{leverageError ?? "Unable to load leverage settings."}</Alert>}
          {leverageStatus === "loading" && <p className="text-xs text-text-muted">Loading leverage settings…</p>}
          {type === "CFD" && leverage?.conversionAvailable === false && (
            <Alert tone="err">Quote-currency conversion to USD is unavailable. Wait for fresh conversion-market data before trading.</Alert>
          )}
        </section>
        <div className="h-px bg-panel-3" aria-hidden />
        <section aria-label="Account impact" className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-(length:--term-text-2xs) font-semibold uppercase tracking-wide text-text-faint">Account impact</h3>
            <span className="shrink-0 text-(length:--term-text-2xs) tabular-nums text-text-faint">
              Pip {fmtNum(pipValue, 2)} USD
            </span>
          </div>
          <div className="space-y-1.5">
            <SummaryRow
              label="Session"
              value={sessionLabel}
              valueClass={currentMarketHours.isOpen ? "text-up font-semibold" : "text-down font-semibold"}
            />
            <SummaryRow
              label="Quote freshness"
              value={currentQuoteAgeMs == null ? "Waiting" : `${formatQuoteAge(currentQuoteAgeMs)}${hasFreshQuote ? "" : " · stale"}`}
              valueClass={quoteReady ? "text-up font-semibold" : staleQuoteAvailable ? "text-down font-semibold" : "text-text-muted font-semibold"}
            />
            <SummaryRow label="Free margin" value={`${fmtNum(freeMargin, 2)} USD`} valueClass={!hasFunds ? "text-down font-semibold" : "font-semibold"} />
            <SummaryRow
              label="Remaining free margin"
              value={`${fmtNum(freeMargin - requiredCash, 2)} USD`}
              valueClass={!hasFunds ? "text-down font-semibold" : "text-up font-medium"}
            />
          </div>
        </section>
      </div>

      <div className="mx-4 mb-3 rounded-md bg-panel-2 px-3 py-2 text-(length:--term-text-2xs) leading-relaxed" role="status" aria-live="polite">
        <span className="font-semibold text-text">Order status</span>
        <span className="px-1.5 text-text-faint" aria-hidden>·</span>
        {status === "submitting" && <span className="text-brand">Pending provider acceptance</span>}
        {status === "accepted" && <span className="text-up">Accepted and open{lastAcceptedAt ? ` at ${new Date(lastAcceptedAt).toLocaleTimeString()}` : ""}</span>}
        {status === "failed" && <span className="text-down">Rejected or failed</span>}
        {status === "unknown" && <span className="text-down">Confirmation pending — retry the same order</span>}
        {status === "idle" && <span className={quoteReady ? "text-text-muted" : stalePriceAcknowledged && staleQuoteAvailable ? "text-brand" : "text-down"}>{quoteReady ? "Ready for submission" : stalePriceAcknowledged && staleQuoteAvailable ? "Stale price acknowledged · confirm the order below" : quoteStateLabel}</span>}
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {(validationError || error) && (
        <div role="alert" className="mx-4 mb-3 wrap-break-words rounded-md bg-down/10 px-3 py-2 text-(length:--term-text-xs) leading-relaxed text-down">
          {validationError ?? error}
        </div>
      )}

      </div>

      {/* Keep order actions outside the scrolling content so they stay
          reachable without covering volume, risk, or margin controls. */}
      <div className="relative z-10 shrink-0 border-t border-border-soft bg-canvas px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-lift">
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="sell" size="default" loading={loading} disabled={!canSubmit || !hasValidVolume || !hasFunds} loadingLabel="Submitting" onClick={() => submit("SELL")} className={`h-14 w-full min-w-0 rounded-lg px-2 ${armed === "SELL" ? "ring-2 ring-down ring-offset-2 ring-offset-canvas" : ""}`}>
            <span className="flex flex-col items-center gap-0.5 leading-tight">
              <span className="flex items-center gap-1 text-sm font-bold uppercase tracking-wide">
                <ArrowDownRight size={14} strokeWidth={2.25} aria-hidden />
                Sell · Bid
              </span>
              <span className="text-(length:--term-text-xs) font-medium tabular-nums opacity-90">{quotePriceAvailable ? fmtPrice(bid, instrument.digits) : "—"}</span>
            </span>
          </Button>
          <Button variant="buy" size="default" loading={loading} disabled={!canSubmit || !hasValidVolume || !hasFunds} loadingLabel="Submitting" onClick={() => submit("BUY")} className={`h-14 w-full min-w-0 rounded-lg px-2 ${armed === "BUY" ? "ring-2 ring-up ring-offset-2 ring-offset-canvas" : ""}`}>
            <span className="flex flex-col items-center gap-0.5 leading-tight">
              <span className="flex items-center gap-1 text-sm font-bold uppercase tracking-wide">
                <ArrowUpRight size={14} strokeWidth={2.25} aria-hidden />
                Buy · Ask
              </span>
              <span className="text-(length:--term-text-xs) font-medium tabular-nums opacity-90">{quotePriceAvailable ? fmtPrice(ask, instrument.digits) : "—"}</span>
            </span>
          </Button>
        </div>
        <p className="mt-2 wrap-break-words rounded-md bg-panel-2 px-3 py-2 text-center text-(length:--term-text-2xs) leading-relaxed text-text-faint">
          {!currentMarketHours.isOpen
            ? "Orders disabled · session closed"
            : staleQuoteAvailable && !stalePriceAcknowledged
              ? "Acknowledge the stale-price risk to enable order entry"
              : !quoteReady && !staleQuoteAvailable
                ? !marketDataConnected
                  ? "Orders disabled · market data offline"
                  : "Orders disabled · waiting for quote"
                : staleQuoteAvailable
                  ? "Stale price acknowledged · order will use the displayed quote"
                  : armed
                    ? `${armed === "BUY" ? "Buy" : "Sell"} armed · confirm to submit`
                    : type === "CFD"
                      ? "CFD market order · accepted at the displayed rate"
                      : `Strike order · settles in ${expiryMinutes} min`}
        </p>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, valueClass = "" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="min-w-0 text-(length:--term-text-xs) text-text-muted">{label}</span>
      <span className={`min-w-0 wrap-break-words text-right text-(length:--term-text-xs) tabular-nums text-text ${valueClass}`}>{value}</span>
    </div>
  );
}
