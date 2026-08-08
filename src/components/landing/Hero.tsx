import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { absoluteTradeUrl } from "@/lib/branding";
import { LivePrice } from "@/components/landing/LivePrice";
import { getFeaturedInstrument } from "@/lib/landingData";

/**
 * Hero — headline, dual CTA, and two cards: a live featured market and a
 * "new this week" education chapter strip. The featured card hydrates into a
 * LivePrice client island that polls /api/instruments; the chapter card is
 * static editorial prose.
 */
export async function Hero() {
  const t = await getTranslations("hero");
  const featured = getFeaturedInstrument();

  return (
    <section id="hero" className="relative overflow-hidden bg-linear-to-b from-panel to-canvas scroll-mt-24">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-16 lg:py-24">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-10 items-center">
          {/* Left: pitch */}
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-soft text-brand text-xs font-semibold mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              {t("badge")}
            </span>
            <h1 className="text-4xl lg:text-5xl font-extrabold leading-[1.05] tracking-tight">
              {t.rich("title", {
                accent: (chunks) => <span className="text-brand">{chunks}</span>,
              })}
            </h1>
            <p className="font-prose mt-5 text-lg leading-relaxed text-text-muted max-w-xl">
              {t("subtitle")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={absoluteTradeUrl("/register")}
                className="px-6 py-3 rounded-lg bg-brand text-white font-semibold hover:brightness-110 transition shadow-card"
              >
                {t("ctaPrimary")}
              </Link>
              <Link
                href={absoluteTradeUrl("/trade/XAUUSD")}
                className="px-6 py-3 rounded-lg bg-canvas border border-border font-semibold hover:bg-panel transition font-mono text-sm"
              >
                {t("ctaSecondary")}
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-text-muted">
              <Stat value="24/7" label={t("stats.support")} />
              <Stat value="45+" label={t("stats.markets")} />
              <Stat value="0.0s" label={t("stats.execution")} />
            </div>
          </div>

          {/* Right: featured market + new this week */}
          <div className="grid sm:grid-cols-2 gap-4">
            {featured ? (
              <LivePrice initial={featured} />
            ) : (
              <div className="rounded-xl border border-border bg-panel p-5 text-sm text-text-muted">
                {t("loadingMarkets")}
              </div>
            )}

            <NewThisWeekCard />
          </div>
        </div>
      </div>
    </section>
  );
}

async function NewThisWeekCard() {
  const t = await getTranslations("hero.newThisWeek");
  const chapterKeys = ["c1", "c2", "c3"] as const;
  return (
    <div className="rounded-xl border border-border bg-panel p-5 flex flex-col">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-widest text-brand font-semibold">
          {t("label")}
        </div>
        <span className="text-[10px] font-mono text-text-faint">{t("series")}</span>
      </div>
      <p className="font-prose mt-2 text-sm leading-snug text-text">
        {t("blurb")}
      </p>
      <ul className="mt-4 space-y-3 flex-1">
        {chapterKeys.map((c) => (
          <li key={c} className="group">
            <a href="#confidence" className="block">
              <div className="flex items-center gap-2 text-[10px]">
                <span className="px-1.5 py-0.5 rounded bg-brand-soft text-brand font-semibold uppercase tracking-wider">
                  {t(`chapters.${c}.tag`)}
                </span>
                <span className="text-text-faint font-mono">{t(`chapters.${c}.meta`)}</span>
              </div>
              <div className="font-prose mt-1 text-sm text-text group-hover:text-brand transition">
                {t(`chapters.${c}.title`)}
              </div>
            </a>
          </li>
        ))}
      </ul>
      <a href="#confidence" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:gap-2 transition-all">
        {t("viewAll")}
      </a>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-xl font-bold text-text tnum font-mono">{value}</span>
      <span className="text-text-faint">{label}</span>
    </div>
  );
}
