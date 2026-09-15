import { getTranslations } from "next-intl/server";
import { Zap, ShieldCheck, LineChart } from "lucide-react";
import { Reveal } from "@/components/landing/Reveal";
import { GlobeArcs } from "../GlobeArcs";
import { InstrumentLogo } from "../InstrumentLogo";
import { areaPath, smoothPath } from "../smoothPath";
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
/** Terminal-cell chart series (hand-plotted) → smoothed Catmull-Rom paths. */
const TERMINAL_LEAD: Array<[number, number]> = [[0, 62], [20, 55], [40, 58], [60, 44], [80, 49], [100, 34], [120, 39], [140, 24], [160, 29], [180, 16], [200, 20], [220, 10]];
const TERMINAL_SOFT: Array<[number, number]> = [[0, 70], [20, 66], [40, 69], [60, 60], [80, 63], [100, 52], [120, 56], [140, 46], [160, 50], [180, 41], [200, 44], [220, 36]];
const TERMINAL_FAINT: Array<[number, number]> = [[0, 52], [20, 48], [40, 50], [60, 40], [80, 42], [100, 30], [120, 33], [140, 22], [160, 25], [180, 14], [200, 17], [220, 8]];
const TERMINAL_LINE = smoothPath(TERMINAL_LEAD);
const TERMINAL_AREA = areaPath(TERMINAL_LEAD, 84);

export async function BentoSection({ categoryCounts }: { categoryCounts: Record<string, number> }) {
  const t = await getTranslations("agile.pillars");
  const tA = await getTranslations("agile");
  const tM = await getTranslations("agile.markets");

  return (
    <section id="platform" className="ag-section relative scroll-mt-24 overflow-hidden bg-[#0d0d0f]">
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
            <article className="ag-bento-cell flex h-full min-h-52 flex-col justify-between p-8">
              <div>
                <span className="ag-stepnum">01</span>
                <h3 className="mt-3 text-xl font-bold tracking-[-0.015em] text-[#f1f3ef]">{t("all.title")}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#a9a9ae]">{t("all.desc")}</p>
              </div>
              {/* Multi-market chart — the desk's signature motif: smooth
                  Catmull-Rom curves in the brand theme (thin gold lead with
                  a soft area wash, faint gold hairline companions), a
                  traveling shimmer that keeps the line alive, and the REAL
                  instrument tokens emerging from inside the chart plane. */}
              <div className="relative mt-6">
                <svg viewBox="0 0 220 84" className="w-full" aria-hidden="true" focusable="false">
                  <defs>
                    <linearGradient id="ag-bento-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(240,185,11,0.16)" />
                      <stop offset="100%" stopColor="rgba(240,185,11,0)" />
                    </linearGradient>
                  </defs>
                  {/* Hairline baseline grid. */}
                  {[14, 34, 54, 74].map((y) => (
                    <line key={y} x1="0" y1={y} x2="220" y2={y} stroke="rgba(255,255,255,0.045)" strokeWidth="0.6" />
                  ))}
                  {/* Faint theme companions — tiny dashed gold hairlines. */}
                  <path d={smoothPath(TERMINAL_SOFT)} fill="none" stroke="rgba(240,185,11,0.32)" strokeWidth="0.6" strokeDasharray="2 5" strokeLinecap="round" />
                  <path d={smoothPath(TERMINAL_FAINT)} fill="none" stroke="rgba(240,185,11,0.18)" strokeWidth="0.6" strokeLinecap="round" />
                  {/* Lead series — the theme line, smooth and thin. */}
                  <path d={TERMINAL_AREA} fill="url(#ag-bento-fill)" />
                  <path d={TERMINAL_LINE} fill="none" stroke="#f0b90b" strokeWidth="0.6" strokeLinecap="round" strokeLinejoin="round" />
                  {/* Traveling shimmer — the line reads as live data. */}
                  <path d={TERMINAL_LINE} fill="none" className="ag-chart-live" stroke="#f8d56a" strokeWidth="0.6" strokeLinecap="round" />
                  {/* Breathing close marker at the live edge. */}
                  <circle cx="220" cy="10" r="1.8" fill="#f8d56a" className="ag-chart-pulse" />
                </svg>
                {/* Real instrument tokens EMERGING from the chart plane —
                    staggered depths and rise phases so the field reads as
                    products floating up out of the markets. */}
                <span className="ag-float-a absolute top-0 left-3 z-10 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#1b1b1e]/90 shadow-[0_12px_28px_-12px_rgba(0,0,0,0.85)] backdrop-blur" style={{ animationDelay: "0.2s" }}>
                  <InstrumentLogo symbol="EURUSD" base="EUR" quote="USD" category="FOREX" className="h-6" />
                </span>
                <span className="ag-float-b absolute top-1.5 right-12 z-10 flex h-9 w-9 scale-95 items-center justify-center rounded-lg border border-white/10 bg-[#1b1b1e]/90 shadow-[0_10px_22px_-12px_rgba(0,0,0,0.8)] backdrop-blur" style={{ animationDelay: "1.1s" }}>
                  <InstrumentLogo symbol="BTCUSD" base="BTC" quote="USD" category="CRYPTO" className="h-6" />
                </span>
                <span className="ag-float-b absolute top-1/3 -left-1 z-10 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#1b1b1e]/90 shadow-[0_12px_28px_-12px_rgba(0,0,0,0.85)] backdrop-blur" style={{ animationDelay: "2s" }}>
                  <InstrumentLogo symbol="XAUUSD" base="XAU" quote="USD" category="COMMODITY" className="h-6" />
                </span>
                <span className="ag-float-a absolute bottom-1 left-1/4 z-10 flex h-9 w-9 scale-95 items-center justify-center rounded-lg border border-white/10 bg-[#1b1b1e]/90 shadow-[0_10px_22px_-12px_rgba(0,0,0,0.8)] backdrop-blur" style={{ animationDelay: "2.9s" }}>
                  <InstrumentLogo symbol="US30" base="US30" quote="USD" category="INDEX" className="h-6" />
                </span>
                <span className="ag-float-b absolute -bottom-2 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#1b1b1e]/90 shadow-[0_12px_28px_-12px_rgba(0,0,0,0.85)] backdrop-blur" style={{ animationDelay: "3.7s" }}>
                  <InstrumentLogo symbol="AAPL" base="AAPL" quote="USD" category="STOCK" className="h-6" />
                </span>
              </div>
            </article>
          </Reveal>

          {/* Execution */}
          <Reveal delay={70} className="ag-bento-execution">
            <article className="ag-bento-cell flex h-full flex-col p-7">
              <span className="ag-stepnum">02</span>
              <Zap size={20} strokeWidth={1.75} className="mt-4 text-[#f0b90b]" aria-hidden />
              <h3 className="mt-4 text-base font-bold text-[#f1f3ef]">{t("speed.title")}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#a9a9ae]">{t("speed.desc")}</p>
              <div className="mt-auto pt-5 tnum text-4xl font-extrabold tracking-[-0.03em] text-[#f0b90b]">&lt;1s</div>
            </article>
          </Reveal>

          {/* Security */}
          <Reveal delay={140} className="ag-bento-security">
            <article className="ag-bento-cell flex h-full flex-col p-7">
              <span className="ag-stepnum">03</span>
              <ShieldCheck size={20} strokeWidth={1.75} className="mt-4 text-[#f0b90b]" aria-hidden />
              <h3 className="mt-4 text-base font-bold text-[#f1f3ef]">{t("security.title")}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#a9a9ae]">{t("security.desc")}</p>
            </article>
          </Reveal>

          {/* Asset classes — live counts */}
          <Reveal delay={80} className="ag-bento-assets">
            <article className="ag-bento-cell h-full p-8">
              <span className="ag-stepnum">04</span>
              <h3 className="mt-3 text-xl font-bold tracking-[-0.015em] text-[#f1f3ef]">{t("pricing.title")}</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-[#a9a9ae]">{t("pricing.desc")}</p>
              <div className="mt-6 flex flex-wrap gap-2.5">
                {CATEGORY_ORDER.map((category: InstrumentCategory) => (
                  <span
                    key={category}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-[#a9a9ae]"
                  >
                    <span className="text-[#f0b90b]" aria-hidden>
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
              the globe never clips (the 2-col bento squeezed it). Yellow
              statement cell: ink globe + ink copy on brand yellow. */}
          <Reveal delay={150} className="ag-bento-global col-span-1 lg:col-span-1">
            <article className="ag-bento-cell ag-cell-yellow relative flex h-full min-h-48 items-center gap-4 overflow-hidden p-6 sm:gap-6 sm:p-8">
              <GlobeArcs ink className="w-28 shrink-0 sm:w-44 lg:w-52" />
              <div className="relative">
                <span className="ag-stepnum ag-stepnum-ink">05</span>
                <h3 className="mt-3 text-base font-bold tracking-[-0.015em] text-[#0d0d0f]">{tA("globalTitle")}</h3>
                <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-[#0d0d0f]/78">
                  <LineChart size={15} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[#0d0d0f]" aria-hidden />
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
