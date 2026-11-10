"use client";

import { useEffect, useState } from "react";
import { useForexStore } from "@/lib/store";
import type { SocketStatus } from "@/lib/ws/client";
import { MAX_EXECUTABLE_QUOTE_AGE_MS, quoteAgeMs } from "@/lib/marketFreshness";
import {Radio, ClockFading} from "lucide-react";

export function MarketStatusBanner({
  marketDataMode,
  wsStatus,
}: {
  marketDataMode: string;
  wsStatus: SocketStatus;
}) {
  const quote = useForexStore((state) => state.quote);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const ageMs = quoteAgeMs(quote, now);
  const stale = ageMs == null || ageMs > MAX_EXECUTABLE_QUOTE_AGE_MS;
  const offline = wsStatus === "closed" || wsStatus === "unauthorized";
  const sourceLabel: Record<string, string> = {
    simulation: "internal price feed",
    finnhub: "Live feed",
    alphavantage: "Alpha Vantage market data",
    tickerlayer: "TickerLayer market data",
    sifting: "Sifting market data",
    lse: "London Strategic Edge market data",
  };
  const source = sourceLabel[marketDataMode] ?? `${marketDataMode} market data`;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex min-h-8 flex-wrap items-center gap-x-5 gap-y-1 px-4 py-0.5 text-(length:--term-text-2xs) border-y border-border-soft bg-canvas`}
    >
      <span className="inline-flex items-center gap-2 font-medium">
        <Radio size={12} className="animate-pulse duration-300 transition-all" />
        <span>{source}</span>
      </span>
      <span className="inline-flex items-center gap-2">
        <ClockFading size={12} />
        <span>
          <span className="sr-only">Connection: </span>
          <span className="font-medium">{offline ? "Offline" : wsStatus}</span>
          <span className="mx-1.5 opacity-50" aria-hidden="true">·</span>
          <span className="sr-only">Quote age: </span>
          {ageMs == null
            ? "Waiting for quote"
            : `${(ageMs / 1_000).toFixed(1)}s old${stale ? " · stale" : ""}`}
        </span>
      </span>
      {(offline || stale) && (
        <span className="inline-flex items-center gap-2 font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
          New orders are blocked until a fresh quote is received.
        </span>
      )}
    </div>
  );
}
