"use client";

import Link from "next/link";
import { useInstruments } from "@/components/landing/useInstruments";
import { InstrumentLogo } from "./InstrumentLogo";
import type { InstrumentView } from "@/lib/types";

/**
 * Live ticker marquee — the trading-desk signature strip. Real instruments
 * from the shared feed scroll horizontally in an infinite CSS loop; the list
 * is duplicated for the wrap-around with the duplicate aria-hidden so screen
 * readers hear each quote once. Scrolling pauses on hover and is disabled
 * entirely under prefers-reduced-motion (the strip simply overflows).
 */
export function TickerMarquee({
  initial,
  ariaLabel,
}: {
  initial: InstrumentView[];
  ariaLabel: string;
}) {
  const instruments = useInstruments(initial, 4_000);
  const row = instruments.slice(0, 14);

  if (row.length === 0) return null;

  return (
    <div className="ag-ticker" role="region" aria-label={ariaLabel}>
      <div className="ag-ticker-track">
        {[0, 1].map((copy) => (
          <ul key={copy} className="ag-ticker-row" aria-hidden={copy === 1 || undefined}>
            {row.map((instrument) => {
              const up = instrument.changePct >= 0;
              return (
                <li key={instrument.symbol}>
                  <Link href={`/trade/${instrument.symbol}`} className="ag-ticker-item">
                    <InstrumentLogo
                      symbol={instrument.symbol}
                      base={instrument.base}
                      quote={instrument.quote}
                      category={instrument.category}
                      className="h-5 shrink-0"
                    />
                    <span className="font-semibold">{instrument.symbol}</span>
                    <span className="tnum">{instrument.mid.toFixed(instrument.digits)}</span>
                    <span className={`tnum font-semibold ${up ? "ag-up" : "ag-down"}`}>
                      {up ? "+" : ""}
                      {instrument.changePct.toFixed(2)}%
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ))}
      </div>
    </div>
  );
}
