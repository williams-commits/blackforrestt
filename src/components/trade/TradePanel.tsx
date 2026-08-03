"use client";

import { useEffect, useId, useState } from "react";
import { useForexStore } from "@/lib/store";
import { useOpenPosition } from "@/hooks/useOpenPosition";
import { fmtPrice, fmtNum } from "@/lib/format";
import type { InstrumentView, PositionSide } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { isExecutableQuote, quoteAgeMs } from "@/lib/marketFreshness";

interface Props {
  instrument: InstrumentView;
}

/**
 * Trade panel — enterprise-grade order ticket for placing forex/CFD trades.
 *
 * Two modes:
 *   - Market (CFD): open at current rate, hold, close manually. SL/TP optional.
 *   - Strike: open at a strike rate, settle after expiry.
 *
 * Shows live bid/ask, volume with quick-select, margin/commission preview,
 * and prominent Sell/Buy buttons with the dealing rate.
 */
export function TradePanel({ instrument }: Props) {
  const [type, setType] = useState<"CFD" | "STRIKE">("CFD");
  const [volume, setVolume] = useState("0.10");
  const [strikeRate, setStrikeRate] = useState("");
  const [expiryMinutes, setExpiryMinutes] = useState("5");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [showSLTP, setShowSLTP] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const { openPosition, loading, error, clearError, status, lastAcceptedAt } = useOpenPosition();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  const volumeId = useId();
  const strikeId = useId();
  const stopLossId = useId();
  const takeProfitId = useId();

  function clearMessages(): void {
    setValidationError(null);
    clearError();
  }

  const quote = useForexStore((s) => s.quote);
  const account = useForexStore((s) => s.account);
  const quoteMatches = quote?.symbol === instrument.symbol;
  const bid = quoteMatches ? quote.bid : instrument.bid;
  const ask = quoteMatches ? quote.ask : instrument.ask;
  const currentQuoteAgeMs = quoteMatches ? quoteAgeMs(quote, now) : null;
  const hasFreshQuote = isExecutableQuote(quote, instrument.symbol, now);
  const spread = ask - bid;

  const vol = Number(volume);
  const margin = Number.isFinite(vol) ? vol * instrument.marginPerLot : 0;
  const commission = Number.isFinite(vol) ? vol * instrument.commissionPerLot : 0;
  const pipValue = Number.isFinite(vol) ? vol * instrument.pipValue : 0;
  const requiredCash = margin + commission;
  const freeMargin = account?.free ?? 0;
  const hasValidVolume = Number.isFinite(vol) && vol >= 0.01 && vol <= 100;
  const hasFunds = account != null && freeMargin + 1e-8 >= requiredCash;

  async function submit(side: PositionSide): Promise<void> {
    clearMessages();
    if (!hasFreshQuote) {
      setValidationError("A fresh executable quote is required. Wait for the live connection to recover before submitting an order.");
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

    const ok = await openPosition({
      symbol: instrument.symbol,
      side,
      volume: vol,
      type,
      strikeRate: type === "STRIKE" ? parsedStrike : null,
      expiryMinutes: type === "STRIKE" ? Number(expiryMinutes) : null,
      stopLoss: type === "CFD" ? parsedStopLoss : null,
      takeProfit: type === "CFD" ? parsedTakeProfit : null,
    });
    if (ok) {
      setStopLoss("");
      setTakeProfit("");
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* ── Instrument header ──────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight">{instrument.symbol}</h2>
              <span className="text-[8px] font-semibold uppercase px-1.5 py-0.5 rounded bg-brand-soft text-brand">
                {instrument.category}
              </span>
            </div>
            <p className="text-[10px] text-text-faint mt-0.5">{instrument.name}</p>
          </div>
        </div>

        {/* Trade type toggle */}
        <div className="flex gap-1 mt-3 bg-panel-2 rounded-lg p-1">
          {(["CFD", "STRIKE"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={type === t}
              onClick={() => { setType(t); clearMessages(); }}
              className={`flex-1 py-1.5 text-[11px] font-medium rounded-md transition-all ${
                type === t
                  ? "bg-canvas text-text shadow-sm"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {t === "CFD" ? "Market" : "Strike"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Bid / Ask ──────────────────────────────────────────────────────── */}
      <div className="px-4 py-3">
        <div className="grid grid-cols-2 gap-2">
          {/* Sell / Bid */}
          <div className="flex flex-col items-center justify-center bg-down/5 border border-down/20 rounded-lg py-2.5">
            <span className="text-[9px] font-semibold uppercase text-down tracking-wide">Sell</span>
            <span className="text-lg font-bold tnum text-down leading-tight mt-0.5">
              {fmtPrice(bid, instrument.digits)}
            </span>
          </div>
          {/* Buy / Ask */}
          <div className="flex flex-col items-center justify-center bg-up/5 border border-up/20 rounded-lg py-2.5">
            <span className="text-[9px] font-semibold uppercase text-up tracking-wide">Buy</span>
            <span className="text-lg font-bold tnum text-up leading-tight mt-0.5">
              {fmtPrice(ask, instrument.digits)}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-center gap-3 mt-2 text-[9px] text-text-faint">
          <span>Spread <span className="tnum text-text-muted font-medium">{fmtPrice(spread, instrument.digits)}</span></span>
          <span className="w-px h-3 bg-border" />
          <span>Pip <span className="tnum text-text-muted font-medium">{instrument.pipSize}</span></span>
        </div>
      </div>

      {/* ── Volume ─────────────────────────────────────────────────────────── */}
      <div className="px-4 pb-3">
        <label htmlFor={volumeId} className="text-[10px] font-medium text-text-muted uppercase tracking-wide">Volume (lots)</label>
        <div className="relative mt-1">
          <input
            id={volumeId}
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            max="100"
            value={volume}
            onChange={(e) => { setVolume(e.target.value); clearMessages(); }}
            className="w-full h-10 bg-canvas border border-border rounded-lg px-3 text-sm tnum font-semibold outline-none focus:border-brand transition-colors"
          />
        </div>
        <div className="grid grid-cols-4 gap-1 mt-1.5">
          {[0.01, 0.1, 0.5, 1].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => { setVolume(v.toFixed(2)); clearMessages(); }}
              className={`h-7 text-[10px] rounded-md font-medium transition-colors ${
                volume === v.toFixed(2)
                  ? "bg-brand text-white"
                  : "bg-panel-2 text-text-muted hover:text-text hover:bg-panel-3"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* ── STRIKE fields ──────────────────────────────────────────────────── */}
      {type === "STRIKE" && (
        <div className="px-4 pb-3 space-y-2">
          <div>
            <label htmlFor={strikeId} className="text-[10px] font-medium text-text-muted uppercase tracking-wide">Strike Rate</label>
            <input
              id={strikeId}
              type="number"
              inputMode="decimal"
              value={strikeRate}
              onChange={(e) => { setStrikeRate(e.target.value); clearMessages(); }}
              placeholder={`Market: ${fmtPrice(ask, instrument.digits)}`}
              className="w-full h-10 bg-canvas border border-border rounded-lg px-3 text-sm tnum outline-none focus:border-brand placeholder:text-text-faint transition-colors mt-1"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-text-muted uppercase tracking-wide">Expiry</label>
            <div className="grid grid-cols-4 gap-1 mt-1">
              {[1, 5, 15, 30].map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={expiryMinutes === String(m)}
                  onClick={() => { setExpiryMinutes(String(m)); clearMessages(); }}
                  className={`h-8 text-[10px] rounded-md font-medium transition-colors ${
                    expiryMinutes === String(m)
                      ? "bg-brand text-white"
                      : "bg-panel-2 text-text-muted hover:text-text hover:bg-panel-3"
                  }`}
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SL / TP (CFD only) ─────────────────────────────────────────────── */}
      {type === "CFD" && (
        <div className="px-4 pb-3">
          <button
            type="button"
            aria-expanded={showSLTP}
            aria-controls="risk-controls"
            onClick={() => setShowSLTP((v) => !v)}
            className="flex items-center justify-between w-full text-[10px] font-medium text-text-muted uppercase tracking-wide hover:text-text transition-colors py-1"
          >
            <span>Stop Loss / Take Profit</span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className={`transition-transform ${showSLTP ? "rotate-180" : ""}`}
            >
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {showSLTP && (
            <div id="risk-controls" className="grid grid-cols-2 gap-2 mt-1.5">
              <div>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] font-semibold text-down">SL</span>
                  <label htmlFor={stopLossId} className="sr-only">Stop-loss rate</label>
                  <input
                    id={stopLossId}
                    type="number"
                    inputMode="decimal"
                    value={stopLoss}
                    onChange={(e) => { setStopLoss(e.target.value); clearMessages(); }}
                    placeholder="—"
                    className="w-full h-9 bg-canvas border border-border rounded-lg pl-7 pr-2 text-xs tnum outline-none focus:border-brand placeholder:text-text-faint transition-colors"
                  />
                </div>
              </div>
              <div>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] font-semibold text-up">TP</span>
                  <label htmlFor={takeProfitId} className="sr-only">Take-profit rate</label>
                  <input
                    id={takeProfitId}
                    type="number"
                    inputMode="decimal"
                    value={takeProfit}
                    onChange={(e) => { setTakeProfit(e.target.value); clearMessages(); }}
                    placeholder="—"
                    className="w-full h-9 bg-canvas border border-border rounded-lg pl-7 pr-2 text-xs tnum outline-none focus:border-brand placeholder:text-text-faint transition-colors"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Order summary ──────────────────────────────────────────────────── */}
      <div className="mx-4 mb-3 bg-panel-2/60 rounded-lg p-3 space-y-1.5 border border-border-soft">
        <SummaryRow label="Margin Required" value={`${fmtNum(margin, 2)} USD`} />
        <SummaryRow label="Commission" value={`${fmtNum(commission, 2)} USD`} />
        <SummaryRow label="Pip Value" value={`${fmtNum(pipValue, 2)} USD`} />
        <SummaryRow
          label="Quote Freshness"
          value={currentQuoteAgeMs == null ? "Waiting" : `${(currentQuoteAgeMs / 1_000).toFixed(1)}s${hasFreshQuote ? "" : " · stale"}`}
          valueClass={hasFreshQuote ? "text-up font-semibold" : "text-down font-semibold"}
        />
        <div className="border-t border-border-soft pt-1.5 mt-1.5">
          <SummaryRow label="Free Margin" value={`${fmtNum(freeMargin, 2)} USD`} valueClass={!hasFunds ? "text-down font-semibold" : "font-semibold"} />
        </div>
      </div>

      <div className="mx-4 mb-2 rounded-lg border border-border-soft bg-panel-2/60 px-3 py-2 text-[10px]" role="status" aria-live="polite">
        <span className="font-semibold text-text">Order lifecycle: </span>
        {status === "submitting" && <span className="text-brand">Pending provider acceptance</span>}
        {status === "accepted" && <span className="text-up">Accepted and open{lastAcceptedAt ? ` at ${new Date(lastAcceptedAt).toLocaleTimeString()}` : ""}</span>}
        {status === "failed" && <span className="text-down">Rejected or failed</span>}
        {status === "idle" && <span className="text-text-muted">Ready for submission</span>}
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {(validationError || error) && (
        <div role="alert" className="mx-4 mb-2 text-[11px] text-down bg-down/10 border border-down/30 rounded-lg px-3 py-2">
          {validationError ?? error}
        </div>
      )}

      {/* ── Sell / Buy buttons ─────────────────────────────────────────────── */}
      <div className="px-4 pb-4 mt-auto pt-1">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="sell" size="md" loading={loading} disabled={!hasFreshQuote || !hasValidVolume || !hasFunds} loadingLabel="Submitting sell order" onClick={() => submit("SELL")} className="h-16 rounded-lg">
            <span className="flex flex-col items-center leading-tight">
              <span className="text-sm font-bold uppercase tracking-wide">Sell</span>
              <span className="text-[11px] font-normal opacity-90 tnum">{fmtPrice(bid, instrument.digits)}</span>
            </span>
          </Button>
          <Button variant="buy" size="md" loading={loading} disabled={!hasFreshQuote || !hasValidVolume || !hasFunds} loadingLabel="Submitting buy order" onClick={() => submit("BUY")} className="h-16 rounded-lg">
            <span className="flex flex-col items-center leading-tight">
              <span className="text-sm font-bold uppercase tracking-wide">Buy</span>
              <span className="text-[11px] font-normal opacity-90 tnum">{fmtPrice(ask, instrument.digits)}</span>
            </span>
          </Button>
        </div>
        <p className="text-center text-[9px] text-text-faint mt-2">
          {!hasFreshQuote ? "Orders disabled — waiting for a fresh quote" : type === "CFD" ? "Market order — accepted at the displayed executable rate" : `Strike order — settles in ${expiryMinutes} min`}
        </p>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, valueClass = "" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-text-muted">{label}</span>
      <span className={`text-[11px] tnum text-text ${valueClass}`}>{value}</span>
    </div>
  );
}
