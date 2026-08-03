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
      className={`flex min-h-8 flex-wrap items-center gap-x-4 gap-y-1 border-b px-3 py-1 text-[10px] ${offline || stale ? "border-down/30 bg-down/10 text-down" : "border-brand/30 bg-brand-soft text-brand"}`}
    >
      <span className="flex items-center gap-x-1">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="12" cy="5" rx="9" ry="3"/>
          <path d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
          <path d="M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6"/>
        </svg> {source}
      </span>
      <span className="flex items-center gap-x-1"> 
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 4"/>
        </svg> {offline ? "offline" : wsStatus} | {ageMs == null ? "waiting for quote" : `${(ageMs / 1_000).toFixed(1)}s old${stale ? " · stale" : ""}`}
      </span>
      {(offline || stale) && <span className="font-semibold">New orders are blocked until a fresh quote is received.</span>}
    </div>
  );
}
