/** IntelligenceSection — split from the former Bottom.tsx monolith (Phase 7 structural pass). */
import Link from "next/link";
import type { IntelligenceContent } from "@/content/contracts";
import { SIGNAL_LINE, SIGNAL_AREA } from "../visuals/series";
import { ArrowRight, Check,  } from "lucide-react"
import { Reveal } from "@/components/landing/Reveal"

export function IntelligenceSection({ content }: { content: IntelligenceContent }) {
  return (
    <section id="intelligence" className="ag-cell-yellow ag-section-compact relative scroll-mt-24 overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(80% 55% at 92% -10%, rgba(255,255,255,0.32), transparent 62%)" }}
      />
      <div className="ag-container relative grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        {/* Narrative + checklist */}
        <Reveal>
          <span className="ag-eyebrow ag-eyebrow-ink">{content.eyebrow}</span>
          <h2 className="ag-h2 ag-ink-h2 mt-4 text-balance">{content.title}</h2>
          <p className="ag-sub ag-ink-sub mt-4 max-w-lg">{content.subtitle}</p>
          <ul className="mt-8 space-y-3.5">
            {content.bullets.map((bullet) => (
              <li key={bullet} className="ag-body flex items-start gap-3 text-[#0d0d0f]/84">
                <Check size={16} strokeWidth={2.5} className="mt-0.5 shrink-0 text-[#0d0d0f]" aria-hidden />
                {bullet}
              </li>
            ))}
          </ul>
          <Link href="/analytics/technical" className="ag-btn ag-btn-ink mt-9">
            {content.ctaLabel} <ArrowRight size={15} strokeWidth={2} aria-hidden />
          </Link>
        </Reveal>

        {/* Analyst composition — signal card + leaning calendar card */}
        <Reveal delay={120}>
          <div className="relative">
            <div className="ag-frame p-6 sm:p-7">
              <div className="flex items-center justify-between" aria-hidden="true">
                <span className="flex items-center gap-2.5">
                  <span className="rounded-md bg-[#f0b90b]/12 px-2.5 py-1 font-mono text-[10px] font-bold tracking-widest text-[#f0b90b]">SIGNAL</span>
                  <span className="font-mono text-[10px] tracking-widest text-[#75757b]">H4</span>
                </span>
                {/* Confidence dots */}
                <span className="flex items-center gap-1">
                  {[0.35, 0.65, 1].map((opacity) => (
                    <span key={opacity} className="h-1.5 w-1.5 rounded-full bg-[#f0b90b]" style={{ opacity }} />
                  ))}
                </span>
              </div>

              <svg viewBox="0 0 320 132" className="mt-5 w-full" aria-hidden="true" focusable="false">
                <defs>
                  <linearGradient id="ag-int-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(240,185,11,0.2)" />
                    <stop offset="100%" stopColor="rgba(240,185,11,0)" />
                  </linearGradient>
                </defs>
                {/* Entry / exit guide bands — abstract zones, no numbers. */}
                <rect x="0" y="14" width="320" height="16" fill="rgba(255,107,107,0.07)" />
                <rect x="0" y="100" width="320" height="16" fill="rgba(240,185,11,0.08)" />
                <line x1="0" y1="22" x2="320" y2="22" stroke="rgba(255,107,107,0.4)" strokeDasharray="3 4" strokeWidth="1" />
                <line x1="0" y1="108" x2="320" y2="108" stroke="rgba(240,185,11,0.45)" strokeDasharray="3 4" strokeWidth="1" />
                <path d={SIGNAL_AREA} fill="url(#ag-int-fill)" />
                <path d={SIGNAL_LINE} fill="none" stroke="#f0b90b" strokeWidth="0.6" strokeLinecap="round" />
                {/* Traveling shimmer — the signal reads as live analysis. */}
                <path d={SIGNAL_LINE} fill="none" className="ag-chart-live" stroke="#f8d56a" strokeWidth="0.8" strokeLinecap="round" />
                {/* Entry marker on the line */}
                <circle cx="168" cy="40" r="3" fill="#f0b90b" />
                <circle cx="168" cy="40" r="6" fill="none" stroke="rgba(240,185,11,0.5)" strokeWidth="0.6" className="ag-chart-pulse" />
              </svg>

              {/* Level chips — the signal card's footer, values blank. */}
              <div className="mt-5 grid grid-cols-3 gap-2" aria-hidden="true">
                {["ENTRY", "STOP", "TARGET"].map((level, index) => (
                  <span
                    key={level}
                    className={`rounded-md border py-2 text-center font-mono text-[8.5px] font-bold tracking-widest ${
                      index === 1
                        ? "border-[#ff6b6b]/25 bg-[#ff6b6b]/8 text-[#ff6b6b]"
                        : "border-[#f0b90b]/25 bg-[#f0b90b]/8 text-[#f0b90b]"
                    }`}
                  >
                    {level}
                </span>
                ))}
              </div>
            </div>

            {/* Calendar card — leaning against the signal card. */}
            <div
              className="ag-frame absolute bottom-0 left-0 w-44 -rotate-3 p-3 sm:w-48"
              aria-hidden="true"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[8px] font-bold tracking-widest text-[#75757b]">CALENDAR</span>
                <span className="h-1.5 w-1.5 rounded-full bg-[#f0b90b]" />
              </div>
              <div className="mt-2.5 space-y-1.5">
                {[0, 1, 2].map((row) => (
                  <span key={row} className="flex items-center gap-2 rounded-md border border-white/5 bg-white/5 px-2 py-1.5">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-xs bg-[#f0b90b]/70" />
                    <span className="h-1.5 flex-1 rounded-full bg-white/12" />
                    <span className="h-1.5 w-4 rounded-full bg-white/8" />
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/**
 * Product showcase — the terminal presented as a layered device composition:
 * a wide browser plate with a phone module overlapping it, over the mesh
 * ambience. Numbered feature list beside it. All CSS/SVG, abstract and
 * honest (blank price tags).
 */
