/** TrustSection — split from the former Bottom.tsx monolith (Phase 7 structural pass). */
import { Landmark, Lock, Umbrella } from "lucide-react";
import { Reveal } from "@/components/landing/Reveal";
import type { TrustContent } from "@/content/contracts";

const TRUST_ICONS = [Landmark, Lock, Umbrella];

export function TrustSection({ content }: { content: TrustContent }) {
  return (
    <section id="trust" className="ag-section scroll-mt-24 bg-[#111113]">
      <div className="ag-container">
        <Reveal>
          <span className="ag-eyebrow">{content.eyebrow}</span>
          <h2 className="ag-h2 mt-4 max-w-2xl text-balance">{content.title}</h2>
          <p className="ag-sub mt-4">{content.subtitle}</p>
        </Reveal>
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {content.cards.map((card, index) => {
            const Icon = TRUST_ICONS[index] ?? Landmark;
            return (
              <Reveal key={card.title} delay={index * 90}>
                <article className="ag-bento-cell flex h-full flex-col p-8">
                  <div className="flex items-center justify-between">
                    <Icon size={20} strokeWidth={1.75} className="text-[#f0b90b]" aria-hidden />
                    <span className="ag-stepnum">{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className="mt-6 text-base font-bold text-[#f1f3ef]">{card.title}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-[#a9a9ae]">{card.desc}</p>
                  {card.meta && (
                    <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.16em] text-[#75757b]">
                      {card.meta}
                    </p>
                  )}
                  {/* Institution pills — regulators, custody banks, protection
                      schemes (content-managed in the domain content package). */}
                  {card.tags.length > 0 && (
                    <div className="mt-auto flex flex-wrap gap-2 pt-5">
                      {card.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-white/5 bg-white/5 px-3.5 py-1 text-[11px] font-semibold tracking-wide text-[#a9a9ae]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/**
 * Steps — numbered editorial onboarding: a vertical rule connecting three
 * indexed entries (01 / 02 / 03), no cards — calm, institutional.
 */
