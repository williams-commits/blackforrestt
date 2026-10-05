/** ShowcaseSection — split from the former Bottom.tsx monolith (Phase 7 structural pass). */
import Link from "next/link";
import type { ShowcaseContent } from "@/content/contracts";
import { DESK_LINE, DESK_AREA, PHONE_LINE, PHONE_AREA } from "../visuals/series";
import { Reveal } from "@/components/landing/Reveal"

export function ShowcaseSection({ content }: { content: ShowcaseContent }) {
  return (
    <section id="terminal" className="ag-section relative scroll-mt-24 overflow-hidden bg-[#0d0d0f]">
      <div className="ag-container relative grid items-center gap-16 lg:grid-cols-[0.9fr_1.1fr]">
        {/* Narrative + capabilities */}
        <Reveal>
          <span className="ag-eyebrow">{content.label}</span>
          <h2 className="ag-h2 mt-4 text-balance">{content.title}</h2>
          <p className="ag-sub mt-5 max-w-md">{content.subtitle}</p>
          <ul className="mt-9 space-y-4">
            {content.bullets.map((bullet, index) => (
              <li key={bullet} className="flex items-start gap-4">
                <span className="ag-stepnum shrink-0 pt-1">{String(index + 1).padStart(2, "0")}</span>
                <span className="text-[15px] leading-relaxed text-[#a9a9ae]">{bullet}</span>
              </li>
            ))}
          </ul>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/trade/XAUUSD" className="ag-btn ag-btn-primary">
              {content.ctaLabel}
            </Link>
          </div>
        </Reveal>

        {/*
          The terminal itself — desktop and mobile side by side with clear
          space between them, the phone standing taller than the desktop
          plate. Inside each screen: browser chrome/navbar above the real
          workspace grammar (metrics bar → chart + SELL/BUY order panel →
          positions dock on desktop; navbar → chart + order boxes + trade
          button on mobile). Values are blank — interface, not data.
        */}
        <Reveal delay={120}>
          <div className="relative mx-auto flex w-full max-w-xl items-center gap-8 perspective-[1600px]" aria-hidden="true">
            {/* Cast shade under the composition */}
            <div className="absolute -bottom-14 left-1/2 h-20 w-[94%] -translate-x-1/2 rounded-[100%] bg-black/70 blur-2xl" />

            {/* Desktop — the workspace plate */}
            <div className="ag-frame relative z-10 w-[86%] overflow-hidden p-2 transform-[rotateY(-5deg)_rotateX(1.5deg)] transition-transform duration-500 ease-out hover:transform-[rotateY(-1.5deg)_rotateX(0.5deg)] motion-reduce:transition-none">
              {/* Browser chrome — the navbar, as before */}
              <div className="flex items-center gap-1.5 border-b border-white/5 px-1 pb-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#ff6b6b]/60" />
                <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                <span className="h-1.5 w-1.5 rounded-full bg-[#f0b90b]/70" />
                <span className="ml-1.5 flex-1 rounded bg-white/5 px-2 py-0.5 font-mono text-[6.5px] tracking-widest text-[#75757b]">{content.hostLabel}</span>
              </div>
              {/* AccountBar — the real metrics strip */}
              <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
                {["ACCOUNT", "BALANCE", "EQUITY", "P/L"].map((metric) => (
                  <span key={metric} className="flex flex-col gap-1">
                    <span className="font-mono text-[6.5px] tracking-[0.16em] text-[#75757b]">{metric}</span>
                    <span className="h-1.5 w-8 rounded-sm bg-white/12" />
                  </span>
                ))}
              </div>
              {/* Chart + order panel */}
              <div className="grid grid-cols-[1fr_84px] gap-2 p-2">
                <div className="relative overflow-hidden rounded-md bg-[#0a0a0b] p-1.5">
                  <svg viewBox="0 0 300 120" className="h-36 w-full" preserveAspectRatio="none">
                    <defs>
                      <pattern id="ag-show-grid" width="30" height="24" patternUnits="userSpaceOnUse">
                        <path d="M 30 0 L 0 0 0 24" fill="none" stroke="rgba(255,255,255,0.045)" strokeWidth="1" />
                      </pattern>
                      <linearGradient id="ag-show-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(240,185,11,0.2)" />
                        <stop offset="100%" stopColor="rgba(240,185,11,0)" />
                      </linearGradient>
                    </defs>
                    <rect width="300" height="120" fill="url(#ag-show-grid)" />
                    <path d={DESK_AREA} fill="url(#ag-show-fill)" />
                    <path d={DESK_LINE} fill="none" stroke="#f0b90b" strokeWidth="0.6" strokeLinecap="round" />
                    <path d={DESK_LINE} fill="none" className="ag-chart-live" stroke="#f8d56a" strokeWidth="0.6" strokeLinecap="round" />
                    <circle cx="300" cy="12" r="1.8" fill="#f8d56a" className="ag-chart-pulse" />
                  </svg>
                </div>
                {/* Order rail — the real TradePanel grammar */}
                <div className="flex flex-col gap-1.5">
                  <span className="rounded-md border border-[#ff6b6b]/25 bg-[#ff6b6b]/10 py-1.5 text-center font-mono text-[8px] font-bold tracking-widest text-[#ff6b6b]">SELL</span>
                  <span className="rounded-md border border-[#f0b90b]/25 bg-[#f0b90b]/10 py-1.5 text-center font-mono text-[8px] font-bold tracking-widest text-[#f0b90b]">BUY</span>
                  <div className="grid grid-cols-4 gap-1 rounded-md border border-white/5 p-1.5">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <span key={i} className="h-2 rounded-sm bg-white/10" />
                    ))}
                  </div>
                  <span className="mt-auto h-6 rounded-md bg-[#f0b90b] opacity-90" />
                </div>
              </div>
              {/* Positions dock */}
              <div className="flex items-center gap-2 border-t border-white/5 px-3 py-2">
                <span className="font-mono text-[6.5px] tracking-[0.16em] text-[#75757b]">POSITIONS</span>
                {Array.from({ length: 3 }).map((_, i) => (
                  <span key={i} className="h-1.5 flex-1 rounded-sm bg-white/8" />
                ))}
              </div>
              {/* gloss shade */}
              <div className="pointer-events-none absolute inset-0 bg-linear-to-tr from-transparent via-white/4 to-white/6" />
            </div>

            {/* Phone — beside the desktop, standing taller; navbar on top */}
            <div className="relative z-0 -my-10 flex w-[33%] shrink-0 flex-col rounded-[18px] border border-white/10 bg-[#111113] p-1.5 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.9)] transform-[rotateY(10deg)_rotateX(2deg)]">
              <div className="flex h-full flex-col overflow-hidden rounded-[13px] bg-[#0a0a0b]">
                {/* App navbar — logo mark, section pills, account dot */}
                <div className="flex items-center justify-between border-b border-white/5 px-2 py-1.5">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-[3px] bg-[#f0b90b]" />
                    <span className="h-1 w-4 rounded-full bg-white/20" />
                  </span>
                  <span className="flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                    <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                  </span>
                </div>
                {/* Instrument chip strip */}
                <div className="flex items-center justify-between border-b border-white/5 px-2 py-1.5">
                  <span className="rounded bg-[#f0b90b]/12 px-1.5 py-0.5 font-mono text-[7px] font-bold tracking-widest text-[#f0b90b]">XAUUSD</span>
                  <span className="h-1 w-5 rounded-full bg-white/12" />
                </div>
                {/* chart — stretches so the phone stands tall */}
                <div className="flex-1 px-1 pt-1">
                  <svg viewBox="0 0 120 130" className="h-full w-full" preserveAspectRatio="none">
                    <path d={PHONE_AREA} fill="rgba(240,185,11,0.13)" />
                    <path d={PHONE_LINE} fill="none" stroke="#f0b90b" strokeWidth="0.6" strokeLinecap="round" />
                    <path d={PHONE_LINE} fill="none" className="ag-chart-live" stroke="#f8d56a" strokeWidth="0.6" strokeLinecap="round" />
                  </svg>
                </div>
                {/* order boxes — SELL over BUY, like the sheet */}
                <div className="grid grid-cols-2 gap-1.5 p-2">
                  <span className="rounded-md border border-[#ff6b6b]/25 bg-[#ff6b6b]/10 py-2 text-center font-mono text-[8px] font-bold tracking-widest text-[#ff6b6b]">SELL</span>
                  <span className="rounded-md border border-[#f0b90b]/25 bg-[#f0b90b]/10 py-2 text-center font-mono text-[8px] font-bold tracking-widest text-[#f0b90b]">BUY</span>
                </div>
                {/* trade FAB */}
                <div className="flex justify-end p-2.5 pt-1">
                  <span className="flex h-7 w-14 items-center justify-center rounded-full bg-[#f0b90b] font-sans text-[8px] font-bold text-[#0d0d0f]">Trade</span>
                </div>
              </div>
              {/* gloss shade */}
              <div className="pointer-events-none absolute inset-0 rounded-[18px] bg-linear-to-tr from-transparent via-white/4 to-white/6" />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/** Trust card icons — positional (registry, custody, protection). */

/**
 * Trust & security — a registry ledger: the real company facts as labelled
 * entries in framed cards, headed by the registration summary line. Only
 * configured facts render; fallbacks stay generic and truthful.
 */
