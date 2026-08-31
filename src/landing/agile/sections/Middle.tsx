"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Activity } from "lucide-react";
import { MarketIcon } from "@/components/landing/MarketIcons";
import type { InstrumentView } from "@/lib/types";

/**
 * Movers section — the "investors worth watching" slot, honestly: instead of
 * fabricated trader profiles, the platform's real top movers as large
 * performance cards (live 24h change as the headline metric). Same visual
 * grammar: big card, name, description, performance metric, CTA.
 */
export function MoversSection({
  initial,
  labels,
}: {
  initial: InstrumentView[];
  labels: { eyebrow: string; title: string; subtitle: string; metric: string; cta: string };
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
    const timer = window.setInterval(() => void load(), 4_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

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
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <span className="ag-eyebrow">{labels.eyebrow}</span>
            <h2 className="ag-h2 mt-3">{labels.title}</h2>
            <p className="ag-sub mt-3">{labels.subtitle}</p>
          </div>
          <Link href="/tools/informers" className="ag-btn ag-btn-ghost">
            {labels.cta} <ArrowRight size={15} strokeWidth={2} aria-hidden />
          </Link>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {movers.map((instrument) => {
            const up = instrument.changePct >= 0;
            return (
              <Link
                key={instrument.symbol}
                href={`/trade/${instrument.symbol}`}
                className="ag-card ag-card-hover flex h-full flex-col p-7"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[#63e891]">
                      <MarketIcon category={instrument.category} className="h-5.25 w-5.25" />
                    </span>
                    <div>
                      <div className="font-mono text-sm font-bold text-[#f1f3ef]">{instrument.symbol}</div>
                      <div className="text-[11px] text-[#747a75]">{instrument.name}</div>
                    </div>
                  </div>
                  <Activity size={16} strokeWidth={1.75} className={up ? "ag-up" : "ag-down"} aria-hidden />
                </div>
                <div className="mt-7 flex items-end justify-between">
                  <div>
                    <div className={`text-4xl font-extrabold tracking-tight tnum ${up ? "ag-up" : "ag-down"}`}>
                      {up ? "+" : ""}
                      {instrument.changePct.toFixed(2)}%
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-widest text-[#747a75]">{labels.metric}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-semibold tnum text-[#f1f3ef]">
                      {instrument.mid.toFixed(instrument.digits)}
                    </div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-widest text-[#747a75]">Last</div>
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
