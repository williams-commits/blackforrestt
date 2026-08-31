"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { SectionBackdrop } from "../SectionBackdrop";
import { MarketIcon } from "@/components/landing/MarketIcons";
import { useInstruments } from "@/components/landing/useInstruments";
import type { InstrumentView } from "@/lib/types";

/**
 * Markets dashboard: category tabs (live filter over the instruments feed)
 * left, compact market tiles right — real prices, real changes. The left
 * panel carries the pitch + CTA (reference layout: "20+ exchanges").
 */
export function MarketsSection({
  initial,
  labels,
}: {
  initial: InstrumentView[];
  labels: {
    eyebrow: string;
    title: string;
    subtitle: string;
    cta: string;
    categories: Record<string, string>;
    trade: string;
  };
}) {
  const instruments = useInstruments(initial, 3_000);
  const [category, setCategory] = useState<string>("ALL");

  const available = useMemo(
    () => Array.from(new Set(instruments.map((instrument) => instrument.category))),
    [instruments],
  );
  const tabs = ["ALL", ...available];
  const filtered = useMemo(
    () =>
      (category === "ALL" ? instruments : instruments.filter((i) => i.category === category)).slice(0, 8),
    [instruments, category],
  );

  return (
    <section
      id="markets"
      className="ag-section relative scroll-mt-24 overflow-hidden border-y border-white/10 bg-[#181c1a]"
    >
      {/* Frosted glass plate: elegant blue candlestick charts, blurred
          behind the band. The pitch column sits on a near-solid dark field;
          the tiles side is barely tinted so the imagery carries through. */}
      <SectionBackdrop
        src="/brands/agilefgs/backgrounds/markets-bg.jpg"
        opacity={0.68}
        blur={9}
        filter="saturate(0.95)"
        scrim="linear-gradient(90deg, rgba(24,28,26,0.98) 32%, rgba(24,28,26,0.8) 54%, rgba(24,28,26,0.15) 100%)"
      />
      <div className="ag-container relative">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          {/* Left: pitch + tabs + CTA */}
          <div>
            <span className="ag-eyebrow">{labels.eyebrow}</span>
            <h2 className="ag-h2 mt-3">{labels.title}</h2>
            <p className="ag-sub mt-4">{labels.subtitle}</p>
            <div className="mt-7 flex flex-wrap gap-2" role="tablist" aria-label="Asset class">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={category === tab}
                  onClick={() => setCategory(tab)}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                    category === tab
                      ? "border-[#63e891]/60 bg-[#63e891]/15 text-[#63e891]"
                      : "border-white/10 text-[#a7ada8] hover:border-white/25 hover:text-[#f1f3ef]"
                  }`}
                >
                  {tab === "ALL" ? labels.categories.all : (labels.categories[tab.toLowerCase()] ?? tab)}
                </button>
              ))}
            </div>
            <Link href="/tools/informers" className="ag-btn ag-btn-primary mt-8 rounded-full!">
              {labels.cta} <ArrowRight size={15} strokeWidth={2} aria-hidden />
            </Link>
          </div>

          {/* Right: live tiles */}
          <div className="grid content-start gap-3 sm:grid-cols-2">
            {filtered.map((instrument) => {
              const up = instrument.changePct >= 0;
              return (
                <Link
                  key={instrument.symbol}
                  href={`/trade/${instrument.symbol}`}
                  className="ag-glass-tile ag-card-hover flex items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[#63e891]">
                      <MarketIcon category={instrument.category} className="h-4.75 w-4.75" />
                    </span>
                    <div className="min-w-0">
                      <div className="font-mono text-sm font-bold text-[#f1f3ef]">{instrument.symbol}</div>
                      <div className="mt-0.5 truncate text-[11px] text-[#a7ada8]">{instrument.name}</div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-[15px] font-semibold tnum text-[#f1f3ef]">
                      {instrument.mid.toFixed(instrument.digits)}
                    </div>
                    <div className={`mt-0.5 text-xs font-semibold tnum ${up ? "ag-up" : "ag-down"}`}>
                      {up ? "+" : ""}
                      {instrument.changePct.toFixed(2)}%
                    </div>
                  </div>
                </Link>
              );
            })}
            {filtered.length === 0 && (
              <p className="col-span-2 text-sm text-[#747a75]">No instruments in this category right now.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
