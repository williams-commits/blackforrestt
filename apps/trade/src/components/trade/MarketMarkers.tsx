"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, BookOpen, CandlestickChart, ChevronDown, Gauge } from "lucide-react";
import { useForexStore } from "@/lib/store";
import { fmtPrice } from "@/lib/format";
import { isExecutableQuote, quoteAgeMs } from "@/lib/marketFreshness";
import type { InstrumentView } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "@/components/ui/Tabs";

const VOLUME_FORMATTER = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/**
 * Historical candle volume profile and the live Level 1 quote. The feed
 * doesn't provide aggregated order sizes or deeper book levels.
 */
export function MarketMarkers({
  instrument,
  marketDataConnected,
}: {
  instrument: InstrumentView;
  marketDataConnected: boolean;
}) {
  const contentId = useId();
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const quote = useForexStore((s) => s.quote);
  const candles = useForexStore((s) => s.candles);
  const quoteMatches = quote?.symbol === instrument.symbol;
  const liveQuote = marketDataConnected && isExecutableQuote(quote, instrument.symbol, now);
  const quoteAge = quoteMatches ? quoteAgeMs(quote, now) : null;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px) and (min-height: 900px)");
    const updateDefault = () => setExpanded(desktop.matches);
    updateDefault();
    desktop.addEventListener("change", updateDefault);
    return () => desktop.removeEventListener("change", updateDefault);
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

  const ageLabel = quoteAge == null
    ? null
    : quoteAge < 1_000
      ? "Updated just now"
      : `Updated ${Math.floor(quoteAge / 1_000)}s ago`;

  return (
    <section
      aria-label="Market depth and order book"
      className="shrink-0 border-b border-border bg-panel-2/60 px-3 py-3"
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-center justify-between text-(length:--term-text-2xs) font-semibold uppercase tracking-wide text-text-faint focus-visible:outline-2 focus-visible:outline-brand"
      >
        <span className="flex items-center gap-1.5">
          <Gauge size={13} strokeWidth={2} aria-hidden />
          Market depth
        </span>
        <ChevronDown
          aria-hidden
          className={cn("size-3.5 transition-transform", expanded && "rotate-180")}
        />
      </button>

      <div id={contentId} className={cn("mt-3", !expanded && "hidden")}>
        <TabsRoot defaultValue="depth" className="gap-3">
          <TabsList aria-label="Market data view" className="h-8 w-full bg-panel-3/70 p-0.5">
            <TabsTrigger value="depth" className="gap-1.5 px-2 text-xs">
              <CandlestickChart size={13} strokeWidth={1.8} aria-hidden />
              Depth
            </TabsTrigger>
            <TabsTrigger value="book" className="gap-1.5 px-2 text-xs">
              <BookOpen size={13} strokeWidth={1.8} aria-hidden />
              Order Book
            </TabsTrigger>
          </TabsList>

          <TabsContent value="depth" className="min-h-0">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-text">Volume profile</p>
                <p className="text-[10px] text-text-faint">Historical candle-volume proxy by close</p>
              </div>
              {profile && (
                <span className="rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-medium text-brand">
                  {candles.length} candles
                </span>
              )}
            </div>

            {profile ? (
              <>
                <div
                  className="space-y-1.5"
                  role="list"
                  aria-label="Historical candle volume by closing-price range"
                >
                  {profile.volumes.map((volume, index) => {
                    const bucketLow = profile.low + index * profile.bucketSize;
                    const bucketHigh = bucketLow + profile.bucketSize;
                    const nearMarket = liveQuote && quote != null &&
                      quote.mid >= bucketLow &&
                      quote.mid < bucketHigh + (index === profile.volumes.length - 1 ? profile.bucketSize / 2 : 0);
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
                <p className="mt-2 text-[10px] leading-relaxed text-text-faint">
                  Candle volume is grouped by closing price; it is not exchange-traded volume at each level.
                </p>
              </>
            ) : (
              <p className="rounded-md bg-panel px-3 py-4 text-center text-xs text-text-faint" role="status">
                Waiting for enough candle history to build a profile.
              </p>
            )}
          </TabsContent>

          <TabsContent value="book" className="min-h-0">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-text">Top of book</p>
                <p className="text-[10px] text-text-faint">Level 1 · {instrument.symbol}</p>
              </div>
              <span className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-medium",
                liveQuote ? "bg-(--term-success-bg) text-(--term-success-fg)" : "bg-muted text-muted-foreground",
              )}>
                {liveQuote ? "Live" : "Unavailable"}
              </span>
            </div>

            {liveQuote && quote ? (
              <>
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_3rem] gap-2 px-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-text-faint">
                  <span>Side</span>
                  <span className="text-right">Price</span>
                  <span className="text-right">Size</span>
                </div>
                <div className="space-y-1" role="list" aria-label={`${instrument.symbol} top of book`}>
                  <div
                    role="listitem"
                    aria-label={`Ask ${fmtPrice(quote.ask, instrument.digits)}, size unavailable`}
                    className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_3rem] items-center gap-2 rounded-md bg-down/5 px-2 py-1.5"
                  >
                    <span className="flex items-center gap-1.5 text-xs font-medium text-down">
                      <ArrowUp size={12} strokeWidth={2} aria-hidden />
                      Ask
                    </span>
                    <span className="text-right text-xs font-semibold tabular-nums text-down">
                      {fmtPrice(quote.ask, instrument.digits)}
                    </span>
                    <span className="text-right text-[10px] tabular-nums text-text-faint">—</span>
                  </div>
                  <div className="flex items-center justify-between rounded-md bg-panel px-2 py-1 text-[10px] text-text-faint">
                    <span>Spread</span>
                    <span className="font-medium tabular-nums text-text-muted">
                      {fmtPrice(quote.ask - quote.bid, instrument.digits)}
                    </span>
                  </div>
                  <div
                    role="listitem"
                    aria-label={`Bid ${fmtPrice(quote.bid, instrument.digits)}, size unavailable`}
                    className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_3rem] items-center gap-2 rounded-md bg-up/5 px-2 py-1.5"
                  >
                    <span className="flex items-center gap-1.5 text-xs font-medium text-up">
                      <ArrowDown size={12} strokeWidth={2} aria-hidden />
                      Bid
                    </span>
                    <span className="text-right text-xs font-semibold tabular-nums text-up">
                      {fmtPrice(quote.bid, instrument.digits)}
                    </span>
                    <span className="text-right text-[10px] tabular-nums text-text-faint">—</span>
                  </div>
                </div>
                <p className="mt-2 flex items-center justify-between gap-2 text-[10px] text-text-faint">
                  <span>Liquidity size and deeper levels aren&apos;t provided by this feed.</span>
                  {ageLabel && <span className="shrink-0 tabular-nums">{ageLabel}</span>}
                </p>
              </>
            ) : (
              <p className="rounded-md bg-panel px-3 py-4 text-center text-xs text-text-faint" role="status">
                {!marketDataConnected
                  ? "Order book unavailable while market data is disconnected."
                  : "Waiting for a fresh quote for this instrument."}
              </p>
            )}
          </TabsContent>
        </TabsRoot>
      </div>
    </section>
  );
}
