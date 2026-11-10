"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CandlestickChart, CircleHelp, Clock3, Radio } from "lucide-react";
import { useForexStore } from "@/lib/store";
import { fmtPrice } from "@/lib/format";
import { isExecutableQuote, quoteAgeMs } from "@/lib/marketFreshness";
import type { CandleInterval, InstrumentView } from "@/lib/types";
import { cn } from "@/lib/utils";

const VOLUME_FORMATTER = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const INTERVAL_LABELS: Record<CandleInterval, string> = {
  "1m": "1 min",
  "5m": "5 min",
  "15m": "15 min",
  "1h": "1 hour",
  "4h": "4 hours",
  "1d": "1 day",
};

/**
 * Market context and Level 1 quotes. This feed has no aggregated size or
 * deeper levels, so the order book view intentionally shows prices only.
 */
export function MarketMarkers({
  instrument,
  marketDataConnected,
  view,
}: {
  instrument: InstrumentView;
  marketDataConnected: boolean;
  view: "market" | "book";
}) {
  const [now, setNow] = useState(() => Date.now());
  const quote = useForexStore((s) => s.quote);
  const candles = useForexStore((s) => s.candles);
  const interval = useForexStore((s) => s.interval);
  const quoteMatches = quote?.symbol === instrument.symbol;
  const currentQuote = quoteMatches ? quote : null;
  const quoteIsFresh = marketDataConnected && isExecutableQuote(quote, instrument.symbol, now);
  const quoteAge = currentQuote ? quoteAgeMs(currentQuote, now) : null;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const profile = useMemo(() => {
    if (candles.length < 5) return null;
    let high = -Infinity;
    let low = Infinity;
    for (const candle of candles) {
      if (candle.high > high) high = candle.high;
      if (candle.low < low) low = candle.low;
    }

    const bucketCount = 8;
    const bucketSize = (high - low) / bucketCount;
    if (!(bucketSize > 0)) return null;

    const volumes = new Array<number>(bucketCount).fill(0);
    for (const candle of candles) {
      const index = Math.min(bucketCount - 1, Math.max(0, Math.floor((candle.close - low) / bucketSize)));
      volumes[index] += candle.volume;
    }

    return { low, bucketSize, volumes, maxVolume: Math.max(...volumes) };
  }, [candles]);

  const instrumentChange = currentQuote?.changePct ?? instrument.changePct;
  const changeIsPositive = instrumentChange >= 0;
  const isLive = Boolean(currentQuote && quoteIsFresh);
  const updatedLabel = quoteAge == null
    ? "No quote"
    : quoteAge < 1_000
      ? "Updated now"
      : `Updated ${Math.floor(quoteAge / 1_000)}s ago`;

  if (view === "book") {
    return (
      <section aria-label="Order book" className="flex h-full min-h-0 flex-col bg-canvas">
        <PanelHeading
          icon={<Radio size={15} strokeWidth={1.8} aria-hidden />}
          eyebrow="Market"
          title="Order Book"
          detail={instrument.symbol}
          status={isLive ? "Live" : "Unavailable"}
          live={isLive}
        />
        {isLive && currentQuote ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="mb-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-3 px-3 text-[10px] font-semibold uppercase tracking-wide text-text-faint">
              <span>Side</span>
              <span className="text-right">Price</span>
            </div>
            <div className="space-y-2" role="list" aria-label={`${instrument.symbol} top-of-book quotes`}>
              <QuoteLevel
                label="Ask"
                price={currentQuote.ask}
                digits={instrument.digits}
                direction="up"
              />
              <div className="flex items-center justify-between rounded-md bg-panel-2 px-3 py-2 text-xs">
                <span className="text-text-muted">Spread</span>
                <span className="font-semibold tabular-nums text-text">
                  {fmtPrice(currentQuote.ask - currentQuote.bid, instrument.digits)}
                </span>
              </div>
              <QuoteLevel
                label="Bid"
                price={currentQuote.bid}
                digits={instrument.digits}
                direction="down"
              />
            </div>

            <div className="mt-4 rounded-lg bg-panel-2 p-3">
              <div className="flex items-start gap-2">
                <CircleHelp size={14} strokeWidth={1.8} aria-hidden className="mt-0.5 shrink-0 text-text-faint" />
                <p className="text-[11px] leading-relaxed text-text-faint">
                  This feed provides best bid and ask price.
                </p>
              </div>
            </div>
            <p className="mt-3 flex items-center justify-between gap-2 text-[10px] text-text-faint">
              <span>Prices are indicative until a fresh quote is confirmed.</span>
              <span className="shrink-0 tabular-nums">{updatedLabel}</span>
            </p>
          </div>
        ) : (
          <UnavailableState
            message={marketDataConnected
              ? "Waiting for a fresh quote for this instrument."
              : "Order book unavailable while market data is disconnected."}
          />
        )}
      </section>
    );
  }

  return (
    <section aria-label="Market overview" className="flex h-full min-h-0 flex-col bg-canvas">
      <PanelHeading
        icon={<CandlestickChart size={15} strokeWidth={1.8} aria-hidden />}
        eyebrow={instrument.category}
        title={instrument.symbol}
        detail={instrument.name}
        status={isLive ? "Live" : marketDataConnected ? "Waiting" : "Offline"}
        live={isLive}
      />
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <section aria-label="24 hour market summary" className="rounded-lg bg-panel-2 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-text-faint">24h change</p>
              <p className={cn(
                "mt-1 flex items-center gap-1 text-lg font-semibold tabular-nums",
                changeIsPositive ? "text-up" : "text-down",
              )}>
                {changeIsPositive
                  ? <ArrowUp size={14} strokeWidth={2} aria-hidden />
                  : <ArrowDown size={14} strokeWidth={2} aria-hidden />}
                {changeIsPositive ? "+" : ""}{instrumentChange.toFixed(2)}%
              </p>
            </div>
            <span className="max-w-28 truncate text-right text-[10px] text-text-faint">
              {currentQuote && quoteIsFresh ? updatedLabel : "Last available snapshot"}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
            <MarketMetric
              label="Day high"
              value={currentQuote && quoteIsFresh ? fmtPrice(currentQuote.high24h, instrument.digits) : "—"}
            />
            <MarketMetric
              label="Day low"
              value={currentQuote && quoteIsFresh ? fmtPrice(currentQuote.low24h, instrument.digits) : "—"}
            />
            <MarketMetric
              label="Day open"
              value={currentQuote && quoteIsFresh ? fmtPrice(currentQuote.open24h, instrument.digits) : "—"}
            />
            <MarketMetric label="Spread" value={currentQuote && quoteIsFresh
              ? fmtPrice(currentQuote.ask - currentQuote.bid, instrument.digits)
              : "—"} />
          </div>
        </section>

        <section aria-label="Historical volume profile" className="rounded-lg bg-panel-2 p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-xs font-semibold text-text">Volume by Price</h3>
              <p className="mt-0.5 text-[10px] text-text-faint">Estimated from candle closes</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded bg-panel-3 px-1.5 py-1 text-[10px] text-text-muted">
              <Clock3 size={11} strokeWidth={1.8} aria-hidden />
              {candles.length} × {INTERVAL_LABELS[interval]}
            </span>
          </div>

          {profile ? (
            <>
              <div className="mt-3 space-y-2" role="list" aria-label="Historical candle volume by closing-price range">
                {profile.volumes.map((volume, index) => {
                  const bucketLow = profile.low + index * profile.bucketSize;
                  const bucketHigh = bucketLow + profile.bucketSize;
                  const nearMarket = isLive && currentQuote != null &&
                    currentQuote.mid >= bucketLow &&
                    currentQuote.mid < bucketHigh + (index === profile.volumes.length - 1 ? profile.bucketSize / 2 : 0);
                  const pointOfControl = volume === profile.maxVolume && volume > 0;
                  const width = profile.maxVolume > 0 ? (volume / profile.maxVolume) * 100 : 0;
                  return (
                    <div
                      key={index}
                      role="listitem"
                      aria-label={`${fmtPrice(bucketLow, instrument.digits)} to ${fmtPrice(bucketHigh, instrument.digits)}, ${Math.round(volume).toLocaleString("en-US")} candle volume${nearMarket ? ", current price range" : ""}${pointOfControl ? ", highest volume range" : ""}`}
                      className="grid grid-cols-[4.25rem_minmax(0,1fr)_2.75rem] items-center gap-2"
                    >
                      <span className={cn(
                        "truncate text-[10px] tabular-nums",
                        nearMarket ? "font-semibold text-brand" : "text-text-muted",
                      )}>
                        {fmtPrice(bucketLow, instrument.digits)}
                      </span>
                      <span className="relative h-2 overflow-hidden rounded-sm bg-panel-3" aria-hidden="true">
                        <span
                          className={cn(
                            "block h-full rounded-sm transition-[width] duration-300",
                            pointOfControl ? "bg-brand" : nearMarket ? "bg-up/80" : "bg-text-faint/50",
                          )}
                          style={{ width: `${width}%` }}
                        />
                      </span>
                      <span className="text-right text-[10px] tabular-nums text-text-faint">
                        {VOLUME_FORMATTER.format(volume)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-text-faint">
                <span>{fmtPrice(profile.low, instrument.digits)} low</span>
                <span>{fmtPrice(profile.low + profile.bucketSize * profile.volumes.length, instrument.digits)} high</span>
              </div>
            </>
          ) : (
            <p className="mt-3 rounded-md bg-panel px-3 py-4 text-center text-xs text-text-faint" role="status">
              Waiting for enough candle history to build a profile.
            </p>
          )}
        </section>
      </div>
    </section>
  );
}

function PanelHeading({
  icon,
  eyebrow,
  title,
  detail,
  status,
  live,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  detail: string;
  status: string;
  live: boolean;
}) {
  return (
    <header className="shrink-0 border-b border-border-soft bg-panel-2/60 px-4 py-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-text-faint">{eyebrow}</p>
          <h2 className="truncate text-sm font-semibold tracking-tight text-text">{title}</h2>
          <p className="truncate text-[10px] text-text-faint">{detail}</p>
        </div>
        <span className={cn(
          "mt-0.5 shrink-0 rounded px-1.5 py-1 text-[10px] font-medium",
          live ? "bg-(--term-success-bg) text-(--term-success-fg)" : "bg-muted text-muted-foreground",
        )}>
          {status}
        </span>
      </div>
    </header>
  );
}

function QuoteLevel({
  label,
  price,
  digits,
  direction,
}: {
  label: string;
  price: number;
  digits: number;
  direction: "up" | "down";
}) {
  const isAsk = direction === "up";
  return (
    <div
      role="listitem"
      aria-label={`${label} ${fmtPrice(price, digits)}, size unavailable`}
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] items-center gap-3 rounded-md px-3 py-3",
        isAsk ? "bg-down/5" : "bg-up/5",
      )}
    >
      <span className={cn(
        "flex items-center gap-2 text-xs font-medium",
        isAsk ? "text-down" : "text-up",
      )}>
        {isAsk
          ? <ArrowUp size={13} strokeWidth={2} aria-hidden />
          : <ArrowDown size={13} strokeWidth={2} aria-hidden />}
        {label}
      </span>
      <span className={cn(
        "text-right text-base font-semibold tabular-nums",
        isAsk ? "text-down" : "text-up",
      )}>
        {fmtPrice(price, digits)}
      </span>
    </div>
  );
}

function MarketMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] text-text-faint">{label}</p>
      <p className="mt-0.5 truncate text-xs font-medium tabular-nums text-text">{value}</p>
    </div>
  );
}

function UnavailableState({ message }: { message: string }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <p className="max-w-56 rounded-lg bg-panel-2 px-4 py-5 text-center text-xs leading-relaxed text-text-faint" role="status">
        {message}
      </p>
    </div>
  );
}
