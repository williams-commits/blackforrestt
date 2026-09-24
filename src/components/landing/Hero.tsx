import Link from "next/link";
import { LivePrice } from "@/components/landing/LivePrice";
import { getFeaturedInstrument } from "@/lib/landingData";
import type { HeroContent } from "@/content/contracts";

/**
 * Hero — headline, dual CTA, and two cards: a live featured market and a
 * "new this week" education chapter strip. The featured card hydrates into a
 * LivePrice client island that polls /api/instruments; the chapter card is
 * static editorial prose. ALL copy arrives as the typed HeroContent contract
 * (including the brand-override badge/subtitle resolution, done by the
 * domain content package).
 */
export function Hero({ content }: { content: HeroContent }) {
  const featured = getFeaturedInstrument();

  return (
    <section id="hero" className="relative overflow-hidden bg-linear-to-b from-panel to-canvas scroll-mt-24">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-16 lg:py-24">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-10 items-center">
          {/* Left: pitch */}
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-soft bg-brand-soft/60 text-brand text-xs font-semibold mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              {content.badge}
            </span>
            <h1 className="text-4xl lg:text-[3.4rem] font-extrabold leading-[1.05] tracking-tight">
              {(content.titleSegments ?? []).map((segment, index) =>
                segment.accent ? (
                  <span key={index} className="text-brand">{segment.text}</span>
                ) : (
                  // Bare text for plain segments — same DOM as the ICU rich
                  // renderer this replaced.
                  segment.text
                ),
              )}
            </h1>
            <p className="font-prose mt-5 text-lg leading-relaxed text-text-muted max-w-xl">
              {content.subtitle}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="px-6 py-3 rounded-lg bg-brand text-white font-semibold hover:brightness-110 transition shadow-card"
              >
                {content.ctaPrimaryLabel}
              </Link>
              <Link
                href="/trade/XAUUSD"
                className="px-6 py-3 rounded-lg bg-canvas border border-border font-semibold hover:bg-panel transition font-mono text-sm"
              >
                {content.ctaSecondaryLabel}
              </Link>
            </div>
            {(content.stats ?? []).length > 0 ? (
              <dl className="mt-10 flex flex-wrap divide-x divide-border-soft border-t border-border-soft pt-6">
                {(content.stats ?? []).map((stat) => (
                  <Stat key={stat.label} value={stat.value} label={stat.label} />
                ))}
              </dl>
            ) : null}
          </div>

          {/* Right: featured market + new this week */}
          <div className="grid sm:grid-cols-2 gap-4">
            {featured ? (
              <LivePrice initial={featured} />
            ) : (
              <div className="rounded-xl border border-border bg-panel p-5 text-sm text-text-muted">
                {content.loadingMarkets}
              </div>
            )}

            {content.newThisWeek && <NewThisWeekCard content={content.newThisWeek} />}
          </div>
        </div>
      </div>
    </section>
  );
}

function NewThisWeekCard({ content }: { content: NonNullable<HeroContent["newThisWeek"]> }) {
  return (
    <div className="rounded-xl border border-border bg-panel p-5 flex flex-col">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-widest text-brand font-semibold">
          {content.label}
        </div>
        <span className="text-[10px] font-mono text-text-faint">{content.series}</span>
      </div>
      <p className="font-prose mt-2 text-sm leading-snug text-text">
        {content.blurb}
      </p>
      <ul className="mt-4 space-y-3 flex-1">
        {content.chapters.map((chapter) => (
          <li key={chapter.title} className="group">
            <a href="#confidence" className="block">
              <div className="flex items-center gap-2 text-[10px]">
                <span className="px-1.5 py-0.5 rounded bg-brand-soft text-brand font-semibold uppercase tracking-wider">
                  {chapter.tag}
                </span>
                <span className="text-text-faint font-mono">{chapter.meta}</span>
              </div>
              <div className="font-prose mt-1 text-sm text-text group-hover:text-brand transition">
                {chapter.title}
              </div>
            </a>
          </li>
        ))}
      </ul>
      <a href="#confidence" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:gap-2 transition-all">
        {content.viewAll}
      </a>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-6 first:pl-0 py-1">
      <dd className="text-xl font-bold tnum font-mono text-text">{value}</dd>
      <dt className="text-[11px] uppercase tracking-wider text-text-faint">{label}</dt>
    </div>
  );
}
