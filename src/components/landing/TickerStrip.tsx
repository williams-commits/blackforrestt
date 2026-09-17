"use client";

import Link from "next/link";
import { useInstruments } from "@/components/landing/useInstruments";
import { InstrumentLogo } from "@/components/landing/InstrumentLogo";
import type { InstrumentView } from "@/lib/types";

/**
 * Live ticker strip — the trading-desk marquee, SELF-CONTAINED for any
 * surface (the gbfxs landing's floor ticker AND the embeddable /widgets/ticker
 * iframe). Real instruments from the shared feed scroll horizontally in an
 * infinite CSS loop; the list is duplicated for the wrap-around with the
 * duplicate aria-hidden so screen readers hear each quote once. Scrolling
 * pauses on hover and is disabled entirely under prefers-reduced-motion.
 *
 * Carries its own scoped styles (extracted verbatim from the gbfxs design
 * sheet) so mounting it never requires a design's stylesheet.
 */
export function TickerStrip({
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
      <TickerStripStyles />
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

/** Scoped styles for the strip. Class names keep the historical `ag-ticker*`
 *  names (the /widgets/ticker light-theme override targets them). */
function TickerStripStyles() {
  return (
    <style>{`
      .ag-ticker {
        position: relative;
        overflow: hidden;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        background: #0a0a0b;
      }
      .ag-ticker::before,
      .ag-ticker::after {
        content: "";
        position: absolute;
        top: 0;
        bottom: 0;
        width: 72px;
        z-index: 1;
        pointer-events: none;
      }
      .ag-ticker::before { left: 0; background: linear-gradient(90deg, #0a0a0b, transparent); }
      .ag-ticker::after { right: 0; background: linear-gradient(270deg, #0a0a0b, transparent); }
      .ag-ticker-track {
        display: flex;
        width: max-content;
        animation: ag-ticker-marquee 46s linear infinite;
      }
      .ag-ticker:hover .ag-ticker-track { animation-play-state: paused; }
      .ag-ticker-row {
        display: flex;
        align-items: center;
        padding-block: 0.8rem;
      }
      .ag-ticker-item {
        display: inline-flex;
        align-items: center;
        gap: 0.55rem;
        padding-inline: 1.4rem;
        font-family: var(--font-agile-inter), Inter, sans-serif;
        font-size: 13px;
        font-variant-numeric: tabular-nums;
        color: #f1f3ef;
        border-right: 1px solid rgba(255, 255, 255, 0.07);
        transition: color 150ms ease;
      }
      .ag-ticker-item:hover { color: #f0b90b; }
      .ag-ticker-item .tnum { color: #a9a9ae; }
      .ag-ticker-item .ag-up { color: #0ecb81; }
      .ag-ticker-item .ag-down { color: var(--ag-negative, #f6465d); }
      @keyframes ag-ticker-marquee {
        from { transform: translateX(0); }
        to { transform: translateX(-50%); }
      }
      @media (prefers-reduced-motion: reduce) {
        .ag-ticker-track { animation: none; }
      }
    `}</style>
  );
}
