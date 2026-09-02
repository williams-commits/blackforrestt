import { getTranslations } from "next-intl/server";
import { Zap, ShieldCheck, LineChart } from "lucide-react";
import { Reveal } from "@/components/landing/Reveal";
import { GlobeArcs } from "../GlobeArcs";
import { MarketIcon } from "@/components/landing/MarketIcons";
import { CATEGORY_ORDER } from "@/lib/landingUi";
import type { InstrumentCategory } from "@/lib/types";

/**
 * Platform bento — the "why this desk" grid: an asymmetric card field where
 * each cell is one platform capability, anchored by the terminal cell and
 * closed by the global-markets cell with the GlobeArcs illustration. Content
 * reuses the platform's truthful pillar copy; the composition is entirely
 * the Agile architecture (nothing like the primary brand's feature rows).
 */
export async function BentoSection({ categoryCounts }: { categoryCounts: Record<string, number> }) {
  const t = await getTranslations("agile.pillars");
  const tA = await getTranslations("agile");
  const tM = await getTranslations("agile.markets");

  return (
    <section id="platform" className="ag-section relative scroll-mt-24 overflow-hidden bg-[#0d100f]">
      {/* <div className="pointer-events-none absolute inset-0 ag-mesh opacity-70" aria-hidden="true" /> */}
      <div className="ag-container relative">
        <Reveal>
          <span className="ag-eyebrow">{t("eyebrow")}</span>
          <h2 className="ag-h2 mt-4 max-w-2xl text-balance">{t("title")}</h2>
          <p className="ag-sub mt-4 max-w-2xl">{t("subtitle")}</p>
        </Reveal>

        <div className="ag-bento mt-14">
          {/* Terminal — the anchor cell */}
          <Reveal className="ag-bento-terminal">
            <article className="ag-bento-cell flex h-full flex-col justify-between p-8">
              <div>
                <span className="ag-stepnum">01</span>
                <h3 className="mt-3 text-xl font-bold tracking-[-0.015em] text-[#f1f3ef]">{t("all.title")}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#a7ada8]">{t("all.desc")}</p>
              </div>
              {/* Abstract chart mark — the desk's signature motif. */}
              <svg viewBox="0 0 220 64" className="mt-6 w-full" aria-hidden="true" focusable="false">
                <defs>
                  <linearGradient id="ag-bento-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(99,232,145,0.25)" />
                    <stop offset="100%" stopColor="rgba(99,232,145,0)" />
                  </linearGradient>
                </defs>
                <path
                  d="M0 52 L22 44 L44 48 L66 34 L88 40 L110 26 L132 31 L154 18 L176 24 L198 12 L220 16 L220 64 L0 64 Z"
                  fill="url(#ag-bento-fill)"
                />
                <path
                  d="M0 52 L22 44 L44 48 L66 34 L88 40 L110 26 L132 31 L154 18 L176 24 L198 12 L220 16"
                  fill="none"
                  stroke="#63e891"
                  strokeWidth="1"
                  strokeLinecap="round"
                />
                {[34, 88, 154].map((x) => (
                  <circle key={x} cx={x + 22} cy={x === 34 ? 34 : x === 88 ? 26 : 18} r="2.4" fill="#63e891" />
                ))}
              </svg>
            </article>
          </Reveal>

          {/* Execution */}
          <Reveal delay={70} className="ag-bento-execution">
            <article className="ag-bento-cell flex h-full flex-col p-7">
              <span className="ag-stepnum">02</span>
              <Zap size={20} strokeWidth={1.75} className="mt-4 text-[#63e891]" aria-hidden />
              <h3 className="mt-4 text-base font-bold text-[#f1f3ef]">{t("speed.title")}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#a7ada8]">{t("speed.desc")}</p>
              <div className="mt-auto pt-5 tnum text-4xl font-extrabold tracking-[-0.03em] text-[#63e891]">&lt;1s</div>
            </article>
          </Reveal>

          {/* Security */}
          <Reveal delay={140} className="ag-bento-security">
            <article className="ag-bento-cell flex h-full flex-col p-7">
              <span className="ag-stepnum">03</span>
              <ShieldCheck size={20} strokeWidth={1.75} className="mt-4 text-[#63e891]" aria-hidden />
              <h3 className="mt-4 text-base font-bold text-[#f1f3ef]">{t("security.title")}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#a7ada8]">{t("security.desc")}</p>
            </article>
          </Reveal>

          {/* Asset classes — live counts */}
          <Reveal delay={80} className="ag-bento-assets">
            <article className="ag-bento-cell h-full p-8">
              <span className="ag-stepnum">04</span>
              <h3 className="mt-3 text-xl font-bold tracking-[-0.015em] text-[#f1f3ef]">{t("pricing.title")}</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-[#a7ada8]">{t("pricing.desc")}</p>
              <div className="mt-6 flex flex-wrap gap-2.5">
                {CATEGORY_ORDER.map((category: InstrumentCategory) => (
                  <span
                    key={category}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-[#a7ada8]"
                  >
                    <span className="text-[#63e891]" aria-hidden>
                      <MarketIcon category={category} className="h-3.5 w-3.5" />
                    </span>
                    {tM(`categories.${category.toLowerCase()}`)}
                    <span className="tnum font-semibold text-[#f1f3ef]">{categoryCounts[category] ?? 0}</span>
                  </span>
                ))}
              </div>
            </article>
          </Reveal>

          {/* Global reach — spans the full row below lg so the copy beside
              the globe never clips (the 2-col bento squeezed it). */}
          <Reveal delay={150} className="ag-bento-global col-span-2 lg:col-span-1">
            <article className="ag-bento-cell relative flex h-full items-center gap-6 overflow-hidden p-8">
              <GlobeArcs className="w-36 shrink-0 sm:w-44 lg:w-52" />
              <div className="relative">
                <span className="ag-stepnum">05</span>
                <h3 className="mt-3 text-base font-bold text-[#f1f3ef]">{tA("globalTitle")}</h3>
                <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-[#a7ada8]">
                  <LineChart size={15} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[#63e891]" aria-hidden />
                  {t("all.desc")}
                </p>
              </div>
            </article>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
