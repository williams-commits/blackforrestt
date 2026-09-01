import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  Zap,
  Globe2,
  LineChart,
  ShieldCheck,
  Lock,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { Reveal } from "@/components/landing/Reveal";
import { SectionBackdrop } from "../SectionBackdrop";
import { LivePricePanel } from "../LivePricePanel";
import { getLandingInstruments } from "@/lib/landingData";
import { currentBrandProfile } from "@/lib/branding";

/** Hero — dark cinematic band, display headline left, live terminal right. */
export async function Hero() {
  const t = await getTranslations("agile");
  const tHero = await getTranslations("hero");
  const tCta = await getTranslations("finalCta");
  const brand = await currentBrandProfile();
  const instruments = getLandingInstruments();
  const badge = brand.heroBadge || tHero("badge");
  const subtitle = brand.heroSubtitle || tHero("subtitle");

  return (
    <section id="hero" className="relative scroll-mt-24 overflow-hidden bg-[#0d100f]">
      {/* Frosted glass plate: abstract global-network earth, blurred and
          weighted right. The scrim keeps the copy column on near-solid
          charcoal; the live terminal floats on it as a glass panel. */}
      <SectionBackdrop
        src="/brands/agilefgs/backgrounds/hero-bg.jpg"
        opacity={0.85}
        position="72% 38%"
        blur={7}
        filter="saturate(1.15)"
        scrim="linear-gradient(90deg, #0d100f 0%, rgba(13,16,15,0.92) 44%, rgba(13,16,15,0.34) 100%)"
      />
      {/* Ambient green wash + bottom feather into the next band. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.55]"
        style={{ background: "radial-gradient(52% 42% at 78% 8%, rgba(38,59,51,0.85), transparent 70%)" }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-36"
        style={{ background: "linear-gradient(180deg, transparent, #0d100f)" }}
        aria-hidden="true"
      />
      <div className="ag-container relative grid items-center gap-16 py-24 lg:grid-cols-[1.15fr_0.85fr] lg:py-36">
        <Reveal>
          <span className="inline-flex items-center gap-2.5 rounded-full border border-white/12 bg-white/[0.045] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a7ada8] backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-[#63e891]" aria-hidden />
            {badge}
          </span>
          <h1 className="ag-display mt-8">
            {t("heroTitleA")}
            <br />
            <span className="text-[#63e891]">{t("heroTitleB")}</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-[#a7ada8]">{subtitle}</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/register" className="ag-btn ag-btn-primary rounded-full! px-8">
              {tCta("primary")}
            </Link>
            <Link href="/trade/XAUUSD" className="ag-btn ag-btn-ghost">
              {tHero("ctaSecondary")}
            </Link>
          </div>
          {/* Micro-trust line — only factual platform properties. */}
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
              trade: "Trade",
            }}
          />
        </Reveal>
      </div>
    </section>
  );
}

const BENEFITS: Array<{ key: string; icon: LucideIcon }> = [
  { key: "b1", icon: Zap },
  { key: "b2", icon: Globe2 },
  { key: "b3", icon: LineChart },
  { key: "b4", icon: ShieldCheck },
  { key: "b5", icon: Lock },
];

/** Capability strip — five factual platform properties, hairline-separated. */
export async function BenefitsStrip() {
  const t = await getTranslations("agile.benefits");
  return (
    <section aria-label="Platform benefits" className="border-y border-white/10 bg-[#111513]">
      <ul className="ag-container flex snap-x gap-0 overflow-x-auto py-0 lg:divide-x lg:divide-white/10">
        {BENEFITS.map(({ key, icon: Icon }) => (
          <li
            key={key}
            className="flex min-w-60 flex-1 snap-start items-start gap-4 px-6 py-8 lg:px-8"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#63e891]/25 bg-[#63e891]/[0.07]">
              <Icon size={17} strokeWidth={1.75} className="text-[#63e891]" aria-hidden />
            </span>
            <div>
              <div className="text-sm font-semibold text-[#f1f3ef]">{t(`${key}.t`)}</div>
              <div className="mt-1.5 text-xs leading-relaxed text-[#747a75]">{t(`${key}.d`)}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Trading value — three metric panels plus a pricing-honesty statement row. */
export async function ValueCards() {
  const t = await getTranslations("agile.value");
  const cards = ["c1", "c2", "c3"] as const;
  return (
    <section id="value" className="ag-section scroll-mt-24 bg-[#0d100f]">
      <div className="ag-container">
        <Reveal>
          <span className="ag-eyebrow">Agile FGS</span>
          <h2 className="ag-h2 mt-4 max-w-2xl">{t("title")}</h2>
          <p className="ag-sub mt-4">{t("subtitle")}</p>
        </Reveal>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {cards.map((key, index) => (
            <Reveal key={key} delay={index * 90}>
              <article className="ag-card ag-card-hover flex h-full flex-col p-9">
                <TrendingUp size={18} strokeWidth={1.75} className="text-[#63e891]" aria-hidden />
                <div className="mt-8 text-6xl font-extrabold tracking-[-0.03em] tnum text-[#f1f3ef]">
                  {t(`${key}.v`)}
                </div>
                <div className="mt-2.5 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#63e891]">
                  {t(`${key}.l`)}
                </div>
                <p className="mt-4 text-sm leading-relaxed text-[#a7ada8]">{t(`${key}.d`)}</p>
              </article>
            </Reveal>
          ))}
        </div>
        {/* Pricing statement — a single confident line, nothing invented:
            reuses the platform's existing truthful pricing copy. */}
        <Reveal delay={120}>
          <div className="ag-card mt-5 flex flex-col gap-4 p-9 md:flex-row md:items-center md:gap-12">
            <div className="min-w-56">
              <span className="ag-eyebrow">{t("pricingEyebrow")}</span>
              <h3 className="mt-2.5 text-2xl font-bold tracking-[-0.02em] text-[#f1f3ef]">
                {t("pricingTitle")}
              </h3>
            </div>
            <p className="flex-1 border-t border-white/8 pt-4 text-[15px] leading-relaxed text-[#a7ada8] md:border-l md:border-t-0 md:pl-12 md:pt-0">
              {t("pricingBody")}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
