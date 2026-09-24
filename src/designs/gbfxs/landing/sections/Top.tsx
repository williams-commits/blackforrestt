import Link from "next/link";
import { Reveal } from "@/components/landing/Reveal";
import { SectionBackdrop } from "../visuals/SectionBackdrop";
import { LivePricePanel } from "../visuals/LivePricePanel";
import { TickerStrip } from "@/components/landing/TickerStrip";
import type { HeroContent, StatsContent } from "@/content/contracts";

/** The gbfxs hero requires the display-title variant members. */
type GbfxsHeroContent = HeroContent &
  Required<Pick<HeroContent, "titleA" | "titleB" | "trustLine" | "panel">>;
import type { InstrumentView } from "@/lib/types";

/**
 * Hero — the global trading desk: full-bleed cinematic plate, oversized
 * display headline with an accent line, dual CTA + factual micro-trust, and
 * the live terminal panel framed like a desk module. The band closes with
 * the live ticker marquee — the trading-floor signature.
 *
 * Design-only component: ALL copy arrives as typed content from the gbfxs
 * domain content package; live instruments arrive as data props.
 */
export function Hero({ content, instruments }: { content: GbfxsHeroContent; instruments: InstrumentView[] }) {
  return (
    <section id="hero" className="relative scroll-mt-24 overflow-hidden bg-[#0a0a0b]">
      <SectionBackdrop
        src="/brands/gbfxs/backgrounds/hero-bg.jpg"
        opacity={0.8}
        position="74% 36%"
        blur={0}
        filter="saturate(1.2)"
        scrim="linear-gradient(90deg, #0a0a0b 0%, rgba(10,10,11,0.94) 46%, rgba(10,10,11,0.42) 100%)"
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
        style={{ background: "linear-gradient(180deg, transparent, #0a0a0b)" }}
        aria-hidden="true"
      />

      <div className="ag-container relative grid items-center gap-16 pb-24 pt-24 lg:grid-cols-[1.12fr_0.88fr] lg:pb-32 lg:pt-36">
        <Reveal>
          <span className="inline-flex items-center gap-2.5 rounded-full border border-[#f0b90b]/30 bg-[#f0b90b]/8 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#f8d56a] backdrop-blur-md">
            <span className="relative flex h-1.5 w-1.5" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#f0b90b] opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#f0b90b]" />
            </span>
            {content.badge}
          </span>
          <h1 className="ag-display mt-9 text-balance">
            {content.titleA}
            <br />
            <span className="text-[#f0b90b]">{content.titleB}</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-[#a9a9ae]">{content.subtitle}</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/register" className="ag-btn ag-btn-primary px-9">
              {content.ctaPrimaryLabel}
            </Link>
            <Link href="/trade/XAUUSD" className="ag-btn ag-btn-ghost">
              {content.ctaSecondaryLabel}
            </Link>
          </div>
          <p className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-medium text-[#75757b]">
            {content.trustLine.map((part, index) => (
              <span key={index} className="flex items-center gap-3">
                {index > 0 && <span className="h-0.5 w-0.5 rounded-full bg-[#f0b90b]/60" aria-hidden />}
                <span>{part}</span>
              </span>
            ))}
          </p>
        </Reveal>

        <Reveal delay={120} className="flex justify-center lg:justify-end">
          <LivePricePanel
            initial={instruments}
            labels={{
              bid: content.panel.bid,
              ask: content.panel.ask,
              spread: content.panel.spread,
              trade: content.panel.trade,
              live: content.panel.live,
            }}
          />
        </Reveal>
      </div>

      {/* Live ticker — the floor strip. */}
      <div className="relative">
        <TickerStrip initial={instruments} ariaLabel={content.panel.tickerLive} />
      </div>
    </section>
  );
}

/**
 * Stat bar — the platform's real numbers as the GBFXS statement band: solid
 * brand yellow, ink numerals, hairline-divided ledger row. Borders are drawn
 * per cell (not divide-x) so the 2-up mobile wrap never shows a stray rule
 * at a row start.
 */
export function StatBar({ content }: { content: StatsContent }) {
  return (
    <section id="value" aria-label={content.ariaLabel} className="ag-cell-yellow scroll-mt-24 border-y border-black/10">
      <dl className="ag-container grid grid-cols-2 lg:grid-cols-4">
        {content.items.map(({ value, label }, index) => (
          <div
            key={label}
            className={`flex flex-col gap-1.5 px-5 py-8 sm:px-6 sm:py-10 lg:px-10 ${
              index % 2 === 1 ? "border-l border-black/12" : ""
            } ${index > 1 ? "border-t border-black/12 lg:border-t-0" : ""} ${
              index > 0 ? "lg:border-l lg:border-black/12" : ""
            }`}
          >
            <dd className="tnum text-4xl font-extrabold tracking-[-0.03em] text-[#0d0d0f] lg:text-[2.75rem]">
              {value}
            </dd>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0d0d0f]/62">
              {label}
            </dt>
          </div>
        ))}
      </dl>
    </section>
  );
}
