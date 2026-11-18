"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { useForexStore } from "@/lib/store";
import type { InstrumentView } from "@/lib/types";
import type { SocketStatus } from "@/lib/ws/client";
import { InstrumentIcon } from "@/components/icons/InstrumentIcon";
import { cn } from "@/lib/utils";
import { formatQuoteAge, MAX_EXECUTABLE_QUOTE_AGE_MS, quoteAgeMs } from "@/lib/marketFreshness";
import { marketHoursForSymbol } from "@/lib/marketHours";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type TrafficState = "live" | "stale" | "offline";

const TRAFFIC_COLORS: Record<TrafficState, string> = {
  live: "bg-up",
  stale: "bg-(--term-warning-fg)",
  offline: "bg-down",
};

const TRAFFIC_TEXT_COLORS: Record<TrafficState, string> = {
  live: "text-up",
  stale: "text-(--term-warning-fg)",
  offline: "text-down",
};

const SOURCE_LABELS: Record<string, string> = {
  simulation: "Internal price feed",
  finnhub: "Live feed",
  alphavantage: "Alpha Vantage",
  tickerlayer: "TickerLayer",
  sifting: "Sifting",
  lse: "London Strategic Edge",
};

export function InstrumentMarketStatus({
  instrument,
  marketDataMode,
  wsStatus,
  clock,
  onOpenInstrumentSwitcher,
}: {
  instrument: InstrumentView;
  marketDataMode: string;
  wsStatus: SocketStatus;
  clock: string;
  onOpenInstrumentSwitcher: () => void;
}) {
  const quote = useForexStore((state) => state.quote);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedQuote = quote?.symbol === instrument.symbol ? quote : null;
  const ageMs = quoteAgeMs(selectedQuote, now);
  const marketHours = marketHoursForSymbol(instrument.symbol, now, selectedQuote?.time ?? 0);
  const stale = ageMs == null || ageMs > MAX_EXECUTABLE_QUOTE_AGE_MS;
  const connected = wsStatus === "open";
  const offline = wsStatus === "closed" || wsStatus === "unauthorized";
  const sessionClosed = !marketHours.isOpen;
  const state: TrafficState = offline || sessionClosed
    ? "offline"
    : connected && !stale
      ? "live"
      : "stale";
  const connectionLabel = wsStatus === "open"
    ? "Connected"
    : wsStatus === "connecting"
      ? "Connecting"
      : wsStatus === "unauthorized"
        ? "Sign-in required"
        : "Offline";
  const statusLabel = sessionClosed
    ? "Market closed"
    : offline
      ? "Feed offline"
      : !connected
        ? "Connecting"
        : stale
          ? ageMs == null ? "Waiting for quote" : "Stale"
          : "Live";
  const quoteLabel = offline
    ? "Unavailable"
    : ageMs == null
      ? "Waiting for quote"
      : `${stale ? "Stale" : "Live"} · ${formatQuoteAge(ageMs)} ago`;
  const source = SOURCE_LABELS[marketDataMode] ?? `${marketDataMode} market data`;
  const statusDescription = sessionClosed
    ? `Orders are unavailable while the ${marketHours.venue} session is closed.`
    : offline
      ? "Market data is offline. Wait for the feed to recover before placing an order."
      : stale
        ? selectedQuote
          ? "Stale prices can be used only after you acknowledge the risk in the trade ticket or close confirmation."
          : "Orders are unavailable until a valid market quote is received."
        : "Quotes are arriving normally.";

  return (
    <div className="flex min-w-0 shrink items-center gap-1.5">
      <button
        type="button"
        onClick={onOpenInstrumentSwitcher}
        aria-label={`Switch instrument. ${instrument.symbol}, ${marketHours.isOpen ? "session open" : "session closed"}, ${clock} local time`}
        aria-haspopup="dialog"
        className="group flex min-h-10 min-w-0 shrink items-center rounded-lg p-1 text-left focus-visible:outline-2 focus-visible:outline-brand"
      >
        <span className="flex min-h-8 min-w-0 items-center gap-1 sm:gap-1.5 rounded-md bg-panel-2 px-1.5 transition-colors group-hover:bg-panel group-focus-visible:bg-panel sm:px-2">
          <InstrumentIcon symbol={instrument.symbol} size={16} className="shrink-0" />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-xs font-semibold tracking-wide">{instrument.symbol}</span>
            <span className="flex items-center gap-1 text-(length:--term-text-2xs) text-text-faint">
              <span className={cn("size-1.5 shrink-0 rounded-full", marketHours.isOpen ? "bg-up" : "bg-text-faint")} aria-hidden />
              <span className="hidden min-[360px]:inline">{marketHours.isOpen ? "Session" : "Closed"}</span>
              <time className="tnum">{clock}</time>
            </span>
          </span>
          <ChevronDown size={12} strokeWidth={2} aria-hidden className="hidden shrink-0 text-text-faint sm:block" />
        </span>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Market status: ${statusLabel}`}
            title={`Market status: ${statusLabel}`}
            className="group flex min-h-10 shrink-0 items-center rounded-lg p-0 focus-visible:outline-2 focus-visible:outline-brand sm:p-1"
          >
            <span className="flex min-h-7 items-center gap-1.5 rounded-md bg-panel-2 px-1 transition-colors group-hover:bg-panel group-focus-visible:bg-panel sm:px-2">
              <TrafficLights state={state} />
              <span className="hidden min-w-0 flex-col text-left leading-tight sm:flex">
                <span className="text-(length:--term-text-2xs) font-semibold uppercase tracking-wide text-text-faint">Market</span>
                <span className={cn("truncate text-(length:--term-text-xs) font-medium", TRAFFIC_TEXT_COLORS[state])}>
                  {statusLabel}
                </span>
              </span>
              <ChevronDown size={12} strokeWidth={2} aria-hidden className="hidden shrink-0 text-text-faint sm:block" />
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[min(22rem,calc(100vw-1rem))] p-0 text-xs">
          <div className="p-3">
            <div className="flex items-start justify-between gap-3 rounded-lg bg-panel p-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <TrafficLights state={state} className="mt-1" />
                <div className="min-w-0">
                  <p className="font-semibold">{statusLabel}</p>
                  <p className="mt-0.5 text-text-muted">{instrument.symbol} · {marketHours.venue}</p>
                </div>
              </div>
              <span className={cn("shrink-0 rounded-md bg-canvas px-2 py-1 text-(length:--term-text-2xs) font-semibold uppercase tracking-wide", TRAFFIC_TEXT_COLORS[state])}>
                {state}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-1.5" aria-label="Market status states">
              <StateChip label="Live" state="live" current={state === "live"} />
              <StateChip label="Stale" state="stale" current={state === "stale"} />
              <StateChip label="Offline" state="offline" current={state === "offline"} />
            </div>

            <dl className="mt-3 divide-y divide-border-soft">
              <DetailRow label="Data source" value={source} />
              <DetailRow
                label="Connection"
                value={connectionLabel}
                valueClass={connected ? "text-up" : offline ? "text-down" : "text-(--term-warning-fg)"}
              />
              <DetailRow
                label="Session"
                value={`${instrument.symbol} · ${marketHours.isOpen ? "Open" : "Closed"}`}
                valueClass={marketHours.isOpen ? "text-up" : "text-text-muted"}
              />
              <DetailRow
                label="Last quote"
                value={quoteLabel}
                valueClass={connected && !stale ? "text-up" : offline ? "text-down" : "text-(--term-warning-fg)"}
              />
            </dl>

            <p className={cn(
              "mt-3 rounded-lg bg-panel px-3 py-2 leading-relaxed text-text-muted",
              (offline || stale || sessionClosed) && "text-text",
            )}>
              {statusDescription}
            </p>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function TrafficLights({ state, className }: { state: TrafficState; className?: string }) {
  return (
    <span className={cn("flex shrink-0 items-center gap-1", className)} aria-hidden="true">
      {(["live", "stale", "offline"] as const).map((light) => (
        <span
          key={light}
          className={cn(
            "size-2 rounded-full transition-colors",
            state === light ? TRAFFIC_COLORS[light] : "bg-text-faint/30",
          )}
        />
      ))}
    </span>
  );
}

function StateChip({ label, state, current }: { label: string; state: TrafficState; current: boolean }) {
  return (
    <span className={cn(
      "flex min-w-0 items-center justify-center gap-1.5 rounded-md bg-panel px-1.5 py-1.5 text-(length:--term-text-2xs)",
      current ? "font-semibold text-text" : "text-text-muted",
    )}>
      <span className={cn("size-1.5 shrink-0 rounded-full", TRAFFIC_COLORS[state])} aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}

function DetailRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
      <dt className="shrink-0 text-text-faint">{label}</dt>
      <dd className={cn("min-w-0 truncate text-right font-medium text-text", valueClass)}>{value}</dd>
    </div>
  );
}
