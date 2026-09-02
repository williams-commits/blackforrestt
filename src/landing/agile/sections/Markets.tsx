"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { MarketIcon } from "@/components/landing/MarketIcons";
import { useInstruments } from "@/components/landing/useInstruments";
import type { InstrumentCategory, InstrumentView } from "@/lib/types";

/** Instruments shown per category tab (and for the default view). */
const VISIBLE = 3;

interface MarketPanel {
  title: string;
  bullets: string[];
  cta: string;
}

/**
 * Markets — category-led composition: the left panel carries the selected
 * market's story (headline, mint-dot bullets, CTA) and swaps with the active
 * category pill; the right side lists that category's top instruments —
 * circular category mark, symbol + name, dominant price with a "Today"
 * change line. Real feed, three instruments per category, a last-update
 * caption closing the list.
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
    empty: string;
    today: string;
    updated: string;
    panels: Record<string, MarketPanel>;
  };
}) {
  const instruments = useInstruments(initial, 3_000);
  const [selected, setSelected] = useState<InstrumentCategory | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const available = useMemo(
    () => Array.from(new Set(instruments.map((instrument) => instrument.category))),
    [instruments],
  );
  // No "All" tab: the section header carries the general pitch; the first
  // available category is the default selection until the visitor chooses.
  const active = selected && available.includes(selected) ? selected : (available[0] ?? "");
  const filtered = useMemo(
    () => instruments.filter((i) => i.category === active).slice(0, VISIBLE),
    [instruments, active],
  );
  const panel = labels.panels[active.toLowerCase()] ?? Object.values(labels.panels)[0];

  // Stamp the caption each time the feed delivers a fresh snapshot (client
  // only — starts null so server and client markup agree).
  useEffect(() => {
    setUpdatedAt(
      new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    );
  }, [instruments]);

  return (
    <section
      id="markets"
      className="ag-section relative scroll-mt-24 overflow-hidden border-y border-white/10 bg-[#111513]"
    >
      {/* <div className="pointer-events-none absolute inset-0 ag-mesh opacity-50" aria-hidden="true" /> */}
      <div className="ag-container relative">
        {/* Section header — the general pitch, with the explore CTA right */}
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <span className="ag-eyebrow">{labels.eyebrow}</span>
            <h2 className="ag-h2 mt-4 text-balance">{labels.title}</h2>
            <p className="ag-sub mt-4">{labels.subtitle}</p>
          </div>
          <Link href="/tools/informers" className="ag-btn ag-btn-ghost shrink-0">
            {labels.cta} <ArrowRight size={15} strokeWidth={2} aria-hidden />
          </Link>
        </div>

        {/* Category pills — one per asset class in the feed */}
        <div className="mt-10 flex flex-wrap gap-2" role="tablist" aria-label={labels.eyebrow}>
          {available.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={active === tab}
              onClick={() => setSelected(tab)}
              className={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                active === tab
                  ? "border-[#63e891]/60 bg-[#63e891]/15 text-[#63e891]"
                  : "border-white/10 text-[#a7ada8] hover:border-white/25 hover:text-[#f1f3ef]"
              }`}
            >
              {labels.categories[tab.toLowerCase()] ?? tab}
            </button>
          ))}
        </div>

        <div className="mt-10 grid items-stretch gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
          {/* Market panel — the selected category's story */}
          <div
            key={active}
            className="ag-cell-accent relative flex flex-col overflow-hidden rounded-2xl p-9 lg:p-10"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{ background: "radial-gradient(100% 70% at 90% -10%, rgba(99,232,145,0.14), transparent 60%)" }}
            />
            <div className="relative flex h-full flex-col">
              <h3 className="text-[clamp(1.6rem,2.6vw,2.3rem)] font-bold leading-[1.12] tracking-[-0.02em] text-[#f1f3ef] text-balance">
                {panel.title}
              </h3>
              <ul className="mt-6 space-y-3.5">
                {panel.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-3 text-[14.5px] leading-relaxed text-[#f1f3ef]/85">
                    <span className="mt-1.75 h-1.5 w-1.5 shrink-0 rounded-full bg-[#63e891]" aria-hidden />
                    {bullet}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-8">
                <Link href="/register" className="ag-btn ag-btn-primary rounded-full!">
                  {panel.cta} <ArrowRight size={15} strokeWidth={2} aria-hidden />
                </Link>
              </div>
            </div>
          </div>

          {/* Instrument cards — vertical list, live prices */}
          <div className="flex flex-col gap-3">
            {filtered.map((instrument) => {
              const up = instrument.changePct >= 0;
              return (
                <Link
                  key={instrument.symbol}
                  href={`/trade/${instrument.symbol}`}
                  className="ag-bento-cell group flex items-center gap-4 rounded-2xl px-5 py-4"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#63e891] transition-colors group-hover:border-[#63e891]/40">
                    <MarketIcon category={instrument.category} className="h-5.5 w-5.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-mono text-[15px] font-bold text-[#f1f3ef]">
                      {instrument.symbol}
                    </span>
                    <span className="mt-0.5 block truncate font-sans text-[12px] text-[#747a75]">
                      {instrument.name}
                    </span>
                  </span>
                  <span className="ml-auto shrink-0 text-right">
                    <span className="block font-mono text-[17px] font-bold tnum text-[#f1f3ef]">
                      {instrument.mid.toFixed(instrument.digits)}
                    </span>
                    <span className="mt-0.5 flex items-center justify-end gap-1.5 text-[11px]">
                      <span className="text-[#747a75]">{labels.today}</span>
                      <span className={`font-semibold tnum ${up ? "ag-up" : "ag-down"}`}>
                        {up ? "+" : ""}
                        {instrument.changePct.toFixed(2)}%
                      </span>
                    </span>
                  </span>
                </Link>
              );
            })}
            {filtered.length === 0 && (
              <p className="flex flex-1 items-center justify-center rounded-2xl border border-white/10 px-6 py-10 text-center text-sm text-[#747a75]">
                {labels.empty}
              </p>
            )}
            {updatedAt && (
              <p className="mt-1 text-right text-[11px] text-[#747a75]">
                {labels.updated}: <span className="tnum text-[#a7ada8]">{updatedAt}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
