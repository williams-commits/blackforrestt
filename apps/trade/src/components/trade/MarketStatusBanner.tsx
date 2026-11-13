"use client";

import { useEffect, useState } from "react";
import { Activity, Clock3, Radio } from "lucide-react";
import { useForexStore } from "@/lib/store";
import type { InstrumentView } from "@/lib/types";
import type { SocketStatus } from "@/lib/ws/client";
import { MAX_EXECUTABLE_QUOTE_AGE_MS, quoteAgeMs } from "@/lib/marketFreshness";

export function MarketStatusBanner({
  marketDataMode,
  wsStatus,
  instrument,
}: {
  marketDataMode: string;
  wsStatus: SocketStatus;
  instrument: InstrumentView;
}) {
  const quote = useForexStore((state) => state.quote);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedQuote = quote?.symbol === instrument.symbol ? quote : null;
  const ageMs = quoteAgeMs(selectedQuote, now);
  const stale = ageMs == null || ageMs > MAX_EXECUTABLE_QUOTE_AGE_MS;
  const connected = wsStatus === "open";
  const offline = wsStatus === "closed" || wsStatus === "unauthorized";
  const connectionLabel = wsStatus === "open"
    ? "Connected"
    : wsStatus === "connecting"
      ? "Connecting"
      : wsStatus === "unauthorized"
        ? "Sign-in required"
        : "Offline";
  const quoteLabel = offline
    ? "Feed offline"
    : ageMs == null
      ? "Waiting for quote"
      : stale
        ? `Stale · ${(ageMs / 1_000).toFixed(1)}s`
        : `Live · ${(ageMs / 1_000).toFixed(1)}s`;
  const sourceLabel: Record<string, string> = {
    simulation: "Internal price feed",
    finnhub: "Live feed",
    alphavantage: "Alpha Vantage",
    tickerlayer: "TickerLayer",
    sifting: "Sifting",
    lse: "London Strategic Edge",
  };
  const source = sourceLabel[marketDataMode] ?? `${marketDataMode} market data`;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-w-0 flex-col gap-1.5 border-y border-border-soft bg-canvas px-3 py-0.5 text-(length:--term-text-2xs) sm:gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:px-4 lg:py-0.5"
    >
      <div
        role="group"
        aria-label="Feed and session status"
        tabIndex={0}
        className="-mx-3 flex min-w-0 w-full items-center gap-1.5 overflow-x-auto overscroll-x-contain px-3 py-0.5 scrollbar-none focus-visible:outline-2 focus-visible:outline-brand [&::-webkit-scrollbar]:hidden lg:mx-0 lg:w-auto lg:flex-1 lg:flex-wrap lg:overflow-visible lg:px-0 lg:py-0"
      >
        <StatusPill
          icon={<Radio size={12} strokeWidth={2} aria-hidden />}
          label={source}
          tone="text-text-muted"
        />
        <StatusPill
          icon={<Activity size={12} strokeWidth={2} aria-hidden />}
          label={connectionLabel}
          tone={connected ? "text-up" : offline ? "text-down" : "text-brand"}
        />
        <StatusPill
          icon={<Clock3 size={12} strokeWidth={2} aria-hidden />}
          label={`${instrument.symbol} · ${instrument.marketHours.isOpen ? "Session open" : "Session closed"}`}
          tone={instrument.marketHours.isOpen ? "text-up" : "text-text-muted"}
        />
        <StatusPill
          icon={<Radio size={12} strokeWidth={2} aria-hidden />}
          label={quoteLabel}
          tone={connected && !stale ? "text-up" : offline || stale ? "text-down" : "text-brand"}
        />
      </div>
      {(offline || stale) && (
        <span className="px-1 pt-0.5 font-medium text-text-muted lg:pt-0">
          New orders require a fresh live quote.
        </span>
      )}
    </div>
  );
}

function StatusPill({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  tone: string;
}) {
  return (
    <span className={`inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-md bg-panel px-2.5 py-1 font-medium ${tone}`}>
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </span>
  );
}
