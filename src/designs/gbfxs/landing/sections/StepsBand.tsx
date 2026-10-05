
import type { StepsContent } from "@/content/contracts";/** StepsBand — split from the former Bottom.tsx monolith (Phase 7 structural pass). */
import {  } from "lucide-react"

export function StepsBand({ content }: { content: StepsContent }) {
  return (
    <section id="get-started" className="ag-section relative scroll-mt-24 overflow-hidden bg-[#0d0d0f]">
      <div className="ag-container relative">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <span className="ag-eyebrow">{content.eyebrow}</span>
            <h2 className="ag-h2 mt-4 text-balance">{content.title}</h2>
          </div>
          <p className="ag-sub max-w-sm! text-sm!">{content.subtitle}</p>
        </div>

        <ol className="mt-16 grid gap-12 lg:grid-cols-3 lg:gap-12">
          {content.steps.map((step, index) => (
            <li key={step.title} className="relative flex gap-6 lg:flex-col lg:gap-0">
              {/* Connector — horizontal through the circles (desktop) */}
              <span
                aria-hidden="true"
                className="absolute left-7 top-6 hidden h-px w-[calc(100%-3.5rem)] lg:block"
                style={{ background: "linear-gradient(90deg, rgba(240,185,11,0.5), rgba(255,255,255,0.1) 70%, transparent)" }}
              />
              {/* Vertical connector for stacked/mobile */}
              <span
                aria-hidden="true"
                className="absolute left-7 top-14 h-[calc(100%-2.5rem)] w-px bg-linear-to-b from-[#f0b90b]/40 to-transparent lg:hidden"
              />
              <span className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[#f0b90b]/40 bg-[#111113] tnum text-[15px] font-bold text-[#f0b90b] shadow-[0_0_24px_-8px_rgba(240,185,11,0.45)]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="lg:mt-8">
                <h3 className="text-lg font-bold tracking-[-0.015em] text-[#f1f3ef]">{step.title}</h3>
                <p className="mt-2.5 max-w-sm text-sm leading-relaxed text-[#a9a9ae]">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/**
 * Final CTA — the closing frame: full-bleed night-district plate under a
 * near-solid scrim, display headline, dual CTA and the platform's real
 * numbers as a closing ledger row.
 */
