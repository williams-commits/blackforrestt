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

/** Hero — dark cinematic band, crisp headline left, live terminal right. */
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
        scrim="linear-gradient(90deg, #0d100f 0%, rgba(13,16,15,0.9) 42%, rgba(13,16,15,0.32) 100%)"
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
      <div className="ag-container relative grid items-center gap-14 py-20 lg:grid-cols-[1.15fr_0.85fr] lg:py-28">
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-[#a7ada8] backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-[#63e891]" aria-hidden />
            {badge}
          </span>
          <h1 className="mt-7 text-[2.75rem] font-extrabold leading-[1.04] tracking-tight text-[#f1f3ef] sm:text-6xl lg:text-[4.5rem]">
            {t("heroTitleA")}
            <br />
            <span className="text-[#63e891]">{t("heroTitleB")}</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#a7ada8]">{subtitle}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/register" className="ag-btn ag-btn-primary rounded-full! px-8">
              {tCta("primary")}
            </Link>
            <Link href="/trade/XAUUSD" className="ag-btn ag-btn-ghost">
              {tHero("ctaSecondary")}
            </Link>
          </div>
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

/** Benefits strip — horizontal, hairline-separated, scrollable on mobile. */
export async function BenefitsStrip() {
  const t = await getTranslations("agile.benefits");
  return (
    <section aria-label="Platform benefits" className="border-y border-white/10 bg-[#111513]">
      <ul className="ag-container flex snap-x gap-0 overflow-x-auto py-0 lg:divide-x lg:divide-white/12">
        {BENEFITS.map(({ key, icon: Icon }) => (
          <li
            key={key}
            className="flex min-w-55 flex-1 snap-start items-start gap-3 px-5 py-6 lg:px-7"
          >
            <Icon size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[#63e891]" aria-hidden />
            <div>
              <div className="text-sm font-semibold text-[#f1f3ef]">{t(`${key}.t`)}</div>
              <div className="mt-1 text-xs leading-relaxed text-[#747a75]">{t(`${key}.d`)}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Value cards — three large metric panels, minimal and structural. */
export async function ValueCards() {
  const t = await getTranslations("agile.value");
  const cards = ["c1", "c2", "c3"] as const;
  return (
    <section id="value" className="ag-section scroll-mt-24 bg-[#0d100f]">
      <div className="ag-container">
        <Reveal>
          <span className="ag-eyebrow">Agile FGS</span>
          <h2 className="ag-h2 mt-3 max-w-2xl">{t("title")}</h2>
          <p className="ag-sub mt-3">{t("subtitle")}</p>
        </Reveal>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {cards.map((key, index) => (
            <Reveal key={key} delay={index * 90}>
              <article className="ag-card ag-card-hover flex h-full flex-col p-8">
                <TrendingUp size={18} strokeWidth={1.75} className="text-[#63e891]" aria-hidden />
                <div className="mt-6 text-5xl font-extrabold tracking-tight tnum text-[#f1f3ef]">
                  {t(`${key}.v`)}
                </div>
                <div className="mt-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-[#63e891]">
                  {t(`${key}.l`)}
                </div>
                <p className="mt-4 text-sm leading-relaxed text-[#a7ada8]">{t(`${key}.d`)}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
