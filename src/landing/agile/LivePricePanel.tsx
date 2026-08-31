"use client";

import Link from "next/link";
import { useState } from "react";
import { useInstruments } from "@/components/landing/useInstruments";
import type { InstrumentView } from "@/lib/types";

/**
 * Hero right-hand visual: a live mini-terminal panel (real data — the same
 * /api/instruments feed every landing island uses). Selected symbol shows a
 * large last price, bid/ask and spread; a row of switchable instruments
 * makes it interactive. No mock data, no decorative sparklines.
 */
export function LivePricePanel({
  initial,
  labels,
}: {
  initial: InstrumentView[];
  labels: { bid: string; ask: string; spread: string; trade: string };
}) {
  const instruments = useInstruments(initial, 2_000);
  const [selected, setSelected] = useState<string>("XAUUSD");

  const preferred = ["XAUUSD", "EURUSD", "BTCUSD", "US30"];
  const bySymbol = new Map(instruments.map((instrument) => [instrument.symbol, instrument]));
  const tabs = preferred.map((symbol) => bySymbol.get(symbol)).filter((i): i is InstrumentView => Boolean(i));
  const activeInstrument = bySymbol.get(selected) ?? tabs[0];

  if (!activeInstrument) return null;

  const up = activeInstrument.changePct >= 0;
  const spread = activeInstrument.ask - activeInstrument.bid;

  return (
    <div className="ag-glass w-full max-w-md p-6 sm:p-7" role="group" aria-label="Live market panel">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2" aria-live="polite">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#63e891] opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#63e891]" />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#747a75]">Live</span>
        </div>
        <nav className="flex gap-1" aria-label="Instrument">
          {tabs.map((tab) => (
            <button
              key={tab.symbol}
              type="button"
              onClick={() => setSelected(tab.symbol)}
              aria-pressed={tab.symbol === activeInstrument.symbol}
              className={`rounded-md px-2.5 py-1.5 font-mono text-[11px] font-semibold transition-colors ${
                tab.symbol === activeInstrument.symbol
                  ? "bg-[#63e891]/15 text-[#63e891]"
                  : "text-[#747a75] hover:text-[#a7ada8]"
              }`}
            >
              {tab.symbol}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <div className="font-mono text-4xl font-bold tracking-tight tnum text-[#f1f3ef]">
            {activeInstrument.mid.toFixed(activeInstrument.digits)}
          </div>
          <div className={`mt-2 text-sm font-semibold tnum ${up ? "ag-up" : "ag-down"}`}>
            {up ? "▲" : "▼"} {Math.abs(activeInstrument.changePct).toFixed(2)}%
          </div>
        </div>
        <Link
          href={`/trade/${activeInstrument.symbol}`}
          className="ag-btn ag-btn-primary min-h-0! px-4 py-2.5 text-[13px]"
        >
          {labels.trade}
        </Link>
      </div>

      <dl className="mt-6 grid grid-cols-3 divide-x divide-white/12 border-t border-white/10 pt-4 text-center">
        <div className="px-2">
          <dt className="text-[10px] uppercase tracking-widest text-[#747a75]">{labels.bid}</dt>
          <dd className="mt-1 font-mono text-sm tnum text-[#a7ada8]">{activeInstrument.bid.toFixed(activeInstrument.digits)}</dd>
        </div>
        <div className="px-2">
          <dt className="text-[10px] uppercase tracking-widest text-[#747a75]">{labels.ask}</dt>
          <dd className="mt-1 font-mono text-sm tnum text-[#a7ada8]">{activeInstrument.ask.toFixed(activeInstrument.digits)}</dd>
        </div>
        <div className="px-2">
          <dt className="text-[10px] uppercase tracking-widest text-[#747a75]">{labels.spread}</dt>
          <dd className="mt-1 font-mono text-sm tnum text-[#63e891]">{spread.toFixed(activeInstrument.digits)}</dd>
        </div>
      </dl>
    </div>
  );
}
