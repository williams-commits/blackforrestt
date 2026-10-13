"use client";

import { useMemo } from "react";
import { Gauge } from "lucide-react";
import { useForexStore } from "@/lib/store";
import { fmtPrice } from "@/lib/format";
import type { InstrumentView } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Highlight thresholds — a marker is flagged as significant when it crosses
 *  these; values below still render, just quieter. */
const CHANGE_ALERT_PCT = 0.5;
const VOLUME_SPIKE_MULTIPLE = 2;

/**
 * Market markers — live market context above the order ticket. Everything
 * shown is REAL data: the 24h quote fields come straight from the live feed,
 * and the volume/move markers are computed from the loaded candle history.
 * No synthetic or simulated values, ever.
 */
export function MarketMarkers({ instrument }: { instrument: InstrumentView }) {
  const quote = useForexStore((s) => s.quote);
  const candles = useForexStore((s) => s.candles);

  const quoteMatches = quote?.symbol === instrument.symbol;

  // Candle-window stats: volume spike vs 20-bar average + largest single-bar
  // move. Computed from the loaded history for the active timeframe.
  const windowStats = useMemo(() => {
    if (candles.length < 2) return null;
    const volumes = candles.slice(-21, -1).map((c) => c.volume);
    const avgVolume = volumes.length > 0 ? volumes.reduce((sum, v) => sum + v, 0) / volumes.length : 0;
    const lastVolume = candles[candles.length - 1]!.volume;
    const volumeMultiple = avgVolume > 0 ? lastVolume / avgVolume : null;

    let bestPips = 0;
    let bestUp = true;
    for (const candle of candles) {
      const pips = Math.abs(candle.close - candle.open) / instrument.pipSize;
      if (pips > bestPips) {
        bestPips = pips;
        bestUp = candle.close >= candle.open;
      }
    }
    return { avgVolume, lastVolume, volumeMultiple, biggest: { pips: bestPips, up: bestUp } };
  }, [candles, instrument.pipSize]);

  const waiting = !quoteMatches && candles.length === 0;

  return (
    <section
      aria-label="Market markers"
      className="shrink-0 border-b border-border bg-panel-2/60 px-4 py-3"
    >
      <div className="flex items-center gap-1.5">
        <Gauge size={12} strokeWidth={2} aria-hidden className="text-text-faint" />
        <h2 className="text-(length:--term-text-2xs) font-semibold uppercase tracking-wide text-text-faint">
          Market Markers
        </h2>
      </div>

      {waiting ? (
        <p className="mt-2 text-(length:--term-text-xs) text-text-faint" role="status">
          Waiting for live market data…
        </p>
      ) : (
        <div className="mt-2 space-y-2">
          {/* 24h change — the feed's own session change, highlighted when significant */}
          {quoteMatches && quote!.changePct !== 0 && (
            <MarkerChip
              label="24h change"
              value={`${quote!.changePct > 0 ? "▲" : "▼"} ${Math.abs(quote!.changePct).toFixed(2)}%`}
              tone={quote!.changePct > 0 ? "up" : "down"}
              significant={Math.abs(quote!.changePct) >= CHANGE_ALERT_PCT}
            />
          )}

          {/* 24h high / low + current position in the range (live feed fields) */}
          {quoteMatches && quote!.high24h > 0 && quote!.low24h > 0 && quote!.high24h > quote!.low24h && (
            <div>
              <div className="flex items-baseline justify-between gap-2 text-(length:--term-text-xs) tnum">
                <span className="text-text-muted">
                  24h High <span className="font-medium text-text">{fmtPrice(quote!.high24h, instrument.digits)}</span>
                </span>
                <span className="text-text-muted">
                  <span className="font-medium text-text">{fmtPrice(quote!.low24h, instrument.digits)}</span> Low
                </span>
              </div>
              <div className="relative mt-1 h-1.5 rounded-full bg-panel-3" aria-hidden="true">
                {(() => {
                  const range = quote!.high24h - quote!.low24h;
                  const pos = Math.min(100, Math.max(0, ((quote!.mid - quote!.low24h) / range) * 100));
                  return (
                    <span
                      className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-brand shadow-sm"
                      style={{ left: `calc(${pos}% - 5px)` }}
                    />
                  );
                })()}
              </div>
              <div className="mt-0.5 flex justify-between text-(length:--term-text-2xs) tnum text-text-faint">
                <span>Range {((quote!.high24h - quote!.low24h) / instrument.pipSize).toFixed(1)} pips</span>
                <span>Live {fmtPrice(quote!.mid, instrument.digits)}</span>
              </div>
            </div>
          )}

          {/* Volume — real bar volume vs the 20-bar average; flagged as a spike */}
          {windowStats && windowStats.volumeMultiple != null && (
            <MarkerChip
              label="Volume (last bar)"
              value={`×${windowStats.volumeMultiple.toFixed(1)} 20-bar avg`}
              tone={windowStats.volumeMultiple >= VOLUME_SPIKE_MULTIPLE ? "brand" : "muted"}
              significant={windowStats.volumeMultiple >= VOLUME_SPIKE_MULTIPLE}
              sub={`${Math.round(windowStats.lastVolume).toLocaleString("en-US")} · avg ${Math.round(windowStats.avgVolume).toLocaleString("en-US")}`}
            />
          )}

          {/* Biggest single-bar move in the loaded window (pips, direction) */}
          {windowStats && windowStats.biggest.pips > 0 && (
            <MarkerChip
              label={`Biggest bar move (${windowStats.biggest.up ? "up" : "down"})`}
              value={`${windowStats.biggest.up ? "▲" : "▼"} ${windowStats.biggest.pips.toFixed(1)} pips`}
              tone={windowStats.biggest.up ? "up" : "down"}
              significant={false}
            />
          )}
        </div>
      )}
    </section>
  );
}

function MarkerChip({
  label,
  value,
  tone,
  significant,
  sub,
}: {
  label: string;
  value: string;
  tone: "up" | "down" | "brand" | "muted";
  significant: boolean;
  sub?: string;
}) {
  const toneClass =
    tone === "up" ? "text-up" : tone === "down" ? "text-down" : tone === "brand" ? "text-brand" : "text-text-muted";
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-md px-2 py-1.5",
        significant && (tone === "up" ? "bg-up/10" : tone === "down" ? "bg-down/10" : "bg-brand-soft"),
      )}
    >
      <div className="min-w-0">
        <div className="truncate text-(length:--term-text-2xs) uppercase tracking-wide text-text-faint">{label}</div>
        {sub && <div className="truncate text-(length:--term-text-2xs) tnum text-text-faint">{sub}</div>}
      </div>
      <span className={cn("shrink-0 text-(length:--term-text-xs) tnum font-semibold", toneClass)}>{value}</span>
    </div>
  );
}
