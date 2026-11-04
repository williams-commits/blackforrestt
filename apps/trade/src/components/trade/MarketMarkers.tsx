"use client";

import { useId, useMemo, useState } from "react";
import { ChevronDown, Gauge } from "lucide-react";
import { useForexStore } from "@/lib/store";
import { fmtPrice } from "@/lib/format";
import type { InstrumentView } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Historical candle volume by price. The execution engine does not expose a
 * live bid/ask order book, so this panel deliberately avoids implying one.
 */
export function MarketMarkers({ instrument }: { instrument: InstrumentView }) {
  const depthId = useId();
  const [expanded, setExpanded] = useState(false);
  const quote = useForexStore((s) => s.quote);
  const candles = useForexStore((s) => s.candles);
  const quoteMatches = quote?.symbol === instrument.symbol;

  const depth = useMemo(() => {
    if (candles.length < 5) return null;
    let high = -Infinity;
    let low = Infinity;
    for (const candle of candles) {
      if (candle.high > high) high = candle.high;
      if (candle.low < low) low = candle.low;
    }
    const BUCKETS = 8;
    const size = (high - low) / BUCKETS;
    if (!(size > 0)) return null;
    const volumes = new Array<number>(BUCKETS).fill(0);
    for (const candle of candles) {
      const index = Math.min(BUCKETS - 1, Math.max(0, Math.floor((candle.close - low) / size)));
      volumes[index] += candle.volume;
    }
    const max = Math.max(...volumes);
    return { low, size, volumes, max };
  }, [candles]);

  return (
    <section
      aria-label="Market depth"
      className="shrink-0 border-b border-border bg-panel-2/60 px-3 py-3"
    >
      <div className="flex items-center justify-between">
        <h2 className="hidden items-center gap-1.5 text-(length:--term-text-2xs) font-semibold uppercase tracking-wide text-text-faint lg:flex">
          <Gauge size={12} strokeWidth={2} aria-hidden />
          Market depth
        </h2>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={depthId}
          onClick={() => setExpanded((current) => !current)}
          className="flex w-full items-center justify-between text-(length:--term-text-2xs) font-semibold uppercase tracking-wide text-text-faint lg:hidden"
        >
          <span className="flex items-center gap-1.5">
            <Gauge size={12} strokeWidth={2} aria-hidden />
            Market depth
          </span>
          <ChevronDown
            aria-hidden
            className={cn("size-3.5 transition-transform", expanded && "rotate-180")}
          />
        </button>
      </div>
      <p className={cn("mt-1 text-(length:--term-text-2xs) text-text-faint", !expanded && "hidden", "lg:block")}>
        Historical candle volume profile; not a live order book.
      </p>
      {depth ? (
        <div
          id={depthId}
          className={cn("mt-2 space-y-1", !expanded && "hidden", "lg:block")}
          role="list"
          aria-label="Historical candle volume by price"
        >
          {depth.volumes.map((volume, index) => {
            const bucketLow = depth.low + index * depth.size;
            const bucketHigh = bucketLow + depth.size;
            const live = quoteMatches && quote!.mid >= bucketLow &&
              quote!.mid < bucketHigh + (index === depth.volumes.length - 1 ? depth.size / 2 : 0);
            const width = depth.max > 0 ? Math.max(2, (volume / depth.max) * 100) : 2;
            return (
              <div
                key={index}
                role="listitem"
                aria-label={`${fmtPrice(bucketLow, instrument.digits)} price, ${Math.round(volume).toLocaleString("en-US")} volume${live ? ", near current price" : ""}`}
                className="grid grid-cols-[4.5rem_minmax(0,1fr)_3.25rem] items-center gap-2"
              >
                <span className={`text-(length:--term-text-2xs) tnum ${live ? "font-semibold text-brand" : "text-text-muted"}`}>
                  {fmtPrice(bucketLow, instrument.digits)}
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-panel-3" aria-hidden="true">
                  <span
                    className={`block h-full rounded-full ${live ? "bg-brand" : "bg-text-faint/60"}`}
                    style={{ width: `${width}%` }}
                  />
                </span>
                <span className="text-right text-(length:--term-text-2xs) tnum text-text-faint">
                  {Math.round(volume).toLocaleString("en-US")}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className={cn("mt-2 text-(length:--term-text-xs) text-text-faint", !expanded && "hidden", "lg:block")} role="status">
          Waiting for enough candle history.
        </p>
      )}
    </section>
  );
}
