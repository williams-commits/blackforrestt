"use client";

import { useEffect, useState } from "react";
import { useForexStore } from "@/lib/store";
import type { SocketStatus } from "@/lib/ws/client";
import { MAX_EXECUTABLE_QUOTE_AGE_MS, quoteAgeMs } from "@/lib/marketFreshness";

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
    finnhub: "Finnhub market data",
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
      className={`flex min-h-10 flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2 text-(length:--term-text-2xs) ${offline || stale ? "bg-down/5 text-down" : "bg-brand-soft/60 text-brand"}`}
    >
      <span className="inline-flex items-center gap-2 font-medium">
        <svg
          aria-hidden="true"
          focusable="false"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
          <path d="M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6" />
        </svg>
        <span>{source}</span>
      </span>
      <span className="inline-flex items-center gap-2">
        <svg
          aria-hidden="true"
          focusable="false"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 4" />
        </svg>
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
