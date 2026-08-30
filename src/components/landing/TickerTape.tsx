"use client";

import { useEffect, useState } from "react";
import type { InstrumentView } from "@/lib/types";

/**
 * Horizontal live-price marquee strip for the Agile landing template.
 * Polls the shared /api/instruments feed (same source as every other
 * landing island) and scrolls a duplicated track; users preferring reduced
 * motion get a static wrapped grid instead.
 */
export function TickerTape({ initial }: { initial: InstrumentView[] }) {
  const [instruments, setInstruments] = useState<InstrumentView[]>(initial.slice(0, 24));

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/instruments", { cache: "no-store" });
        if (!response.ok || !active) return;
        const payload = (await response.json()) as { instruments?: InstrumentView[] };
        if (Array.isArray(payload.instruments) && payload.instruments.length > 0 && active) {
          setInstruments(payload.instruments.slice(0, 24));
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

  if (instruments.length === 0) return null;

  return (
    <div
      className="border-y border-white/10 bg-black/20"
      aria-label="Live market prices"
      role="region"
    >
      {/* Marquee: the track duplicates the list once so translateX(-50%) loops
          seamlessly. Screen readers get the unduplicated semantic list. */}
      <div className="group relative overflow-hidden py-2.5 motion-reduce:overflow-x-auto">
        <style>{`
          @keyframes agile-ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
          .agile-ticker-track { display: flex; width: max-content; gap: 2.5rem; animation: agile-ticker 60s linear infinite; }
          .agile-ticker-track:hover, .agile-ticker-track:focus-within { animation-play-state: paused; }
          @media (prefers-reduced-motion: reduce) { .agile-ticker-track { animation: none; flex-wrap: wrap; width: auto; } }
        `}</style>
        <div className="agile-ticker-track px-4">
          {[...instruments, ...instruments].map((instrument, index) => {
            const up = instrument.changePct >= 0;
            return (
              <span key={`${instrument.symbol}-${index}`} className="flex shrink-0 items-center gap-2 text-xs tnum" aria-hidden={index >= instruments.length}>
                <span className="font-mono font-semibold text-white/85">{instrument.symbol}</span>
                <span className="text-white/70">{instrument.bid.toFixed(instrument.digits)}</span>
                {/* Hardcoded dim-theme tones: the tape always sits on the dark
                    hero band, in either site theme. */}
                <span style={{ color: up ? "#4cba6a" : "#f15b5b" }} className="font-semibold">
                  {up ? "▲" : "▼"} {Math.abs(instrument.changePct).toFixed(2)}%
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
