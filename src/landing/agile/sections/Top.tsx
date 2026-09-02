import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/landing/Reveal";
import { SectionBackdrop } from "../SectionBackdrop";
import { LivePricePanel } from "../LivePricePanel";
import { TickerMarquee } from "../TickerMarquee";
import { getLandingInstruments } from "@/lib/landingData";
import { currentBrandProfile } from "@/lib/branding";

/**
 * Hero — the global trading desk: full-bleed cinematic plate, oversized
 * display headline with an accent line, dual CTA + factual micro-trust, and
 * the live terminal panel framed like a desk module. The band closes with
 * the live ticker marquee — the trading-floor signature.
 */
export async function Hero() {
  const t = await getTranslations("agile");
  const tHero = await getTranslations("hero");
  const tCta = await getTranslations("finalCta");
  const tPanel = await getTranslations("agile.panel");
  const tMarkets = await getTranslations("agile.markets");
  const brand = await currentBrandProfile();
  const instruments = getLandingInstruments();
  const badge = brand.heroBadge || tHero("badge");
  const subtitle = brand.heroSubtitle || tHero("subtitle");

  return (
    <section id="hero" className="relative scroll-mt-24 overflow-hidden bg-[#0a0d0b]">
      <SectionBackdrop
        src="/brands/agilefgs/backgrounds/hero-bg.jpg"
        opacity={0.8}
        position="74% 36%"
        blur={0}
        filter="saturate(1.2)"
        scrim="linear-gradient(90deg, #0a0d0b 0%, rgba(10,13,11,0.94) 46%, rgba(10,13,11,0.42) 100%)"
      />
      {/* <div
        className="pointer-events-none absolute inset-0 ag-mesh opacity-90"
        aria-hidden="true"
      /> */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
        style={{ background: "linear-gradient(180deg, transparent, #0a0d0b)" }}
        aria-hidden="true"
      />

      <div className="ag-container relative grid items-center gap-16 pb-24 pt-24 lg:grid-cols-[1.12fr_0.88fr] lg:pb-32 lg:pt-36">
        <Reveal>
          <span className="inline-flex items-center gap-2.5 rounded-full border border-[#63e891]/25 bg-[#63e891]/5 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8ff0b4] backdrop-blur-md">
            <span className="relative flex h-1.5 w-1.5" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#63e891] opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#63e891]" />
            </span>
            {badge}
          </span>
          <h1 className="ag-display mt-9 text-balance">
            {t("heroTitleA")}
            <br />
            <span className="text-[#63e891]">{t("heroTitleB")}</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-[#a7ada8]">{subtitle}</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/register" className="ag-btn ag-btn-primary rounded-full! px-9">
              {tCta("primary")}
            </Link>
            <Link href="/trade/XAUUSD" className="ag-btn ag-btn-ghost">
              {tHero("ctaSecondary")}
            </Link>
          </div>
          <p className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-medium text-[#747a75]">
            {t("heroTrustLine").split("·").map((part, index) => (
              <span key={index} className="flex items-center gap-3">
                {index > 0 && <span className="h-0.5 w-0.5 rounded-full bg-[#63e891]/60" aria-hidden />}
                <span>{part.trim()}</span>
              </span>
            ))}
          </p>
        </Reveal>

        <Reveal delay={120} className="flex justify-center lg:justify-end">
          <LivePricePanel
            initial={instruments}
            labels={{
              bid: t("showcase.bid"),
              ask: t("showcase.ask"),
              spread: t("showcase.spread"),
              trade: tMarkets("trade"),
              live: tPanel("live"),
            }}
          />
        </Reveal>
      </div>

      {/* Live ticker — the floor strip. */}
      <div className="relative">
        <TickerMarquee initial={instruments} ariaLabel={tMarkets("live")} />
      </div>
    </section>
  );
}

const STATS = [
  { v: "45+", key: "statInstruments" },
  { v: "<1s", key: "statExecution" },
  { v: "24/7", key: "statSupport" },
  { v: "9", key: "statLanguages" },
] as const;

/**
 * Stat bar — the platform's real numbers as a hairline-divided ledger row.
 * Replaces the old benefits strip + value cards: same truthful claims, far
 * more institutional composition.
 */
export async function StatBar() {
  const t = await getTranslations("agile");
  const tV = await getTranslations("agile.value");
  return (
    <section id="value" aria-label={tV("subtitle")} className="scroll-mt-24 border-b border-white/8 bg-[#0d100f]">
      <dl className="ag-container grid grid-cols-2 divide-x divide-white/8 lg:grid-cols-4">
        {STATS.map(({ v, key }, index) => (
          <div
            key={key}
            className={`flex flex-col gap-1.5 px-6 py-10 lg:px-10 ${index > 1 ? "border-t border-white/8 lg:border-t-0" : ""}`}
          >
            <dd className="tnum text-4xl font-extrabold tracking-[-0.03em] text-[#f1f3ef] lg:text-[2.75rem]">
              {v}
            </dd>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#747a75]">
              {t(key)}
            </dt>
          </div>
        ))}
      </dl>
    </section>
  );
}
