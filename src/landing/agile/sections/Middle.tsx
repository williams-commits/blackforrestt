"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { MarketIcon } from "@/components/landing/MarketIcons";
import { Sparkline } from "../Sparkline";
import { useInstruments } from "@/components/landing/useInstruments";
import type { InstrumentView } from "@/lib/types";

/**
 * Movers — the discovery strip: the feed's biggest 24h moves as horizontal
 * "blotter" cards, each carrying a large performance numeral, the live last
 * price and a direction sparkline. Real data, ranked by |change|, no
 * fabricated trader profiles.
 */
export function MoversSection({
  initial,
  labels,
}: {
  initial: InstrumentView[];
  labels: { eyebrow: string; title: string; subtitle: string; metric: string; last: string; cta: string };
}) {
  const instruments = useInstruments(initial, 4_000);

  const movers = useMemo(
    () =>
      [...instruments]
        .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
        .slice(0, 6),
    [instruments],
  );

  return (
    <section id="movers" className="ag-section scroll-mt-24 bg-[#0d100f]">
      <div className="ag-container">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <span className="ag-eyebrow">{labels.eyebrow}</span>
            <h2 className="ag-h2 mt-4 text-balance">{labels.title}</h2>
            <p className="ag-sub mt-4">{labels.subtitle}</p>
          </div>
          <Link href="/tools/informers" className="ag-btn ag-btn-ghost">
            {labels.cta} <ArrowRight size={15} strokeWidth={2} aria-hidden />
          </Link>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {movers.map((instrument) => {
            const up = instrument.changePct >= 0;
            return (
              <Link
                key={instrument.symbol}
                href={`/trade/${instrument.symbol}`}
                className="ag-bento-cell group flex h-full flex-col p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[#63e891]">
                      <MarketIcon category={instrument.category} className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="font-mono text-sm font-bold text-[#f1f3ef]">{instrument.symbol}</div>
                      <div className="text-[11px] text-[#747a75]">{instrument.name}</div>
                    </div>
                  </div>
                  <Sparkline
                    symbol={instrument.symbol}
                    changePct={instrument.changePct}
                    width={72}
                    height={26}
                    className="opacity-80 transition-opacity group-hover:opacity-100"
                  />
                </div>
                <div className="mt-6 flex items-end justify-between border-t border-white/8 pt-5">
                  <div>
                    <div className={`text-4xl font-extrabold tracking-[-0.03em] tnum ${up ? "ag-up" : "ag-down"}`}>
                      {up ? "+" : ""}
                      {instrument.changePct.toFixed(2)}%
                    </div>
                    <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#747a75]">
                      {labels.metric}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-semibold tnum text-[#f1f3ef]">
                      {instrument.mid.toFixed(instrument.digits)}
                    </div>
                    <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#747a75]">
                      {labels.last}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
