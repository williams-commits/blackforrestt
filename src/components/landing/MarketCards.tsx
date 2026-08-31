"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { InstrumentView } from "@/lib/types";

/**
 * Live instrument card tiles (eToro-style market cards): crisp white cards,
 * hairline borders, tabular data, one restrained accent on hover. Each tile
 * deep-links straight into the terminal for that instrument. Polls the
 * shared /api/instruments feed every 3s like the other landing islands.
 */
export function MarketCards({
  initial,
  labels,
}: {
  initial: InstrumentView[];
  labels: { tradeNow: string };
}) {
  const [instruments, setInstruments] = useState<InstrumentView[]>(initial);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/instruments", { cache: "no-store" });
        if (!response.ok || !active) return;
        const payload = (await response.json()) as { instruments?: InstrumentView[] };
        if (Array.isArray(payload.instruments) && payload.instruments.length > 0 && active) {
          setInstruments(payload.instruments);
        }
      } catch {
        /* transient — keep the last snapshot */
      }
    };
    const timer = window.setInterval(() => void load(), 3_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  // A hand-picked, category-balanced selection: FX majors + gold + oil +
  // indices + BTC/ETH. Falls back to whatever the feed provides.
  const PREFERRED = [
    "EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "WTIUSD", "US30", "NAS100", "BTCUSD", "ETHUSD",
  ];
  const bySymbol = new Map(instruments.map((instrument) => [instrument.symbol, instrument]));
  const picked = PREFERRED.map((symbol) => bySymbol.get(symbol)).filter(
    (instrument): instrument is InstrumentView => Boolean(instrument),
  );
  const cards = (picked.length >= 6 ? picked : instruments).slice(0, 8);

  if (cards.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {cards.map((instrument) => {
        const up = instrument.changePct >= 0;
        return (
          <Link
            key={instrument.symbol}
            href={`/trade/${instrument.symbol}`}
            className="group flex flex-col rounded-xl border border-border bg-canvas p-5 transition hover:border-brand hover:shadow-panel"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-sm font-bold text-text">{instrument.symbol}</span>
              <span className={`text-xs font-semibold tnum ${up ? "text-up" : "text-down"}`}>
                {up ? "▲" : "▼"} {Math.abs(instrument.changePct).toFixed(2)}%
              </span>
            </div>
            <span className="mt-1 truncate text-xs text-text-muted">{instrument.name}</span>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xl font-bold tnum text-text">{instrument.mid.toFixed(instrument.digits)}</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-brand opacity-0 transition group-hover:opacity-100">
                {labels.tradeNow}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
