import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  Zap,
  CandlestickChart,
  ShieldCheck,
  Lock,
  MonitorSmartphone,
  Database,
  TrendingUp,
} from "lucide-react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Markets } from "@/components/landing/Markets";
import { TickerTape } from "@/components/landing/TickerTape";
import { getLandingInstruments } from "@/lib/landingData";
import { currentBrandProfile, safeBrandColor } from "@/lib/branding";

/**
 * Agile FGS landing template — a deliberately different design language from
 * the default Black Forest editorial page: a deep-green fintech hero with a
 * live ticker tape, a bento feature grid, and a full-width CTA band. No TOC
 * rails, no progress checklist, no sticky CTA — this template owns its own
 * anchor contract. Copy stays in the shared i18n catalogs (hero, markets,
 * confidence features, final CTA) so all nine locales keep working; the
 * brand's own voice comes through heroBadge / heroSubtitle overrides and the
 * brand tokens (accent, wordmark, glyph).
 */
export async function AgileLanding() {
  const instruments = getLandingInstruments();
  const t = await getTranslations("hero");
  const tFeat = await getTranslations("confidence.features");
  const tConf = await getTranslations("confidence");
  const tCta = await getTranslations("finalCta");
  const brand = await currentBrandProfile();
  const badge = brand.heroBadge || t("badge");
  const subtitle = brand.heroSubtitle || t("subtitle");
  const accent = safeBrandColor(brand.accentColor) || "#00644e";

  const features = [
    { key: "execution", icon: Zap, wide: true },
    { key: "charting", icon: CandlestickChart, wide: false },
    { key: "risk", icon: ShieldCheck, wide: false },
    { key: "security", icon: Lock, wide: false },
    { key: "devices", icon: MonitorSmartphone, wide: false },
    { key: "data", icon: Database, wide: true },
  ] as const;

  return (
    <>
      <Navbar />

      <main id="main-content" tabIndex={-1}>
        {/* ── Hero: deep-green band, headline + live ticker tape ─────────── */}
        <section
          id="hero"
          className="relative overflow-hidden bg-[#04231c] text-white"
          style={{ ["--color-brand" as string]: accent }}
        >
          {/* Ambient glow keyed to the brand accent */}
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{ background: `radial-gradient(60% 50% at 70% 10%, ${accent}55, transparent 70%)` }}
            aria-hidden="true"
          />
          <div className="relative max-w-7xl mx-auto px-4 lg:px-8 pt-16 pb-14 lg:pt-24 lg:pb-20">
            <div className="max-w-3xl">
              <span
                className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
                style={{ backgroundColor: `${accent}33`, color: "#7fe0c3" }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
                {badge}
              </span>
              <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight lg:text-6xl">
                {t.rich("title", {
                  accent: (chunks) => (
                    <span style={{ color: "#7fe0c3" }}>{chunks}</span>
                  ),
                })}
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/70">{subtitle}</p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link
                  href="/register"
                  className="rounded-lg px-7 py-3.5 font-semibold text-white shadow-card transition hover:brightness-110"
                  style={{ backgroundColor: accent }}
                >
                  {t("ctaPrimary")}
                </Link>
                <Link
                  href="/trade/XAUUSD"
                  className="rounded-lg border border-white/20 bg-white/5 px-7 py-3.5 font-mono text-sm font-semibold text-white/90 transition hover:bg-white/10"
                >
                  {t("ctaSecondary")}
                </Link>
              </div>
              <dl className="mt-12 flex flex-wrap gap-x-12 gap-y-4">
                {(["support", "markets", "execution"] as const).map((stat) => (
                  <div key={stat}>
                    <dt className="text-xs uppercase tracking-widest text-white/50">{t(`stats.${stat}`)}</dt>
                    <dd className="mt-1 text-2xl font-bold tnum" style={{ color: "#7fe0c3" }}>
                      {stat === "support" ? "24/7" : stat === "markets" ? "45+" : "0.0s"}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
          <TickerTape initial={instruments} />
        </section>

        {/* ── Markets: shared data island on the light canvas ────────────── */}
        <Markets />

        {/* ── Bento feature grid: same translated cards, new geometry ────── */}
        <section id="platform" className="scroll-mt-24 border-t border-border-soft bg-panel py-16 lg:py-24">
          <div className="max-w-7xl mx-auto px-4 lg:px-8">
            <div className="max-w-2xl">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-brand">
                {tConf("eyebrow")}
              </span>
              <h2 className="mt-2 text-3xl font-bold tracking-tight lg:text-4xl">{tConf("title")}</h2>
              <p className="mt-3 text-lg leading-relaxed text-text-muted">{tConf("subtitle")}</p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ key, icon: Icon, wide }) => {
                const title = tFeat(`${key}.title` as never);
                const desc = tFeat(`${key}.desc` as never);
                return (
                  <article
                    key={key}
                    className={`group rounded-xl border border-border bg-canvas p-6 transition hover:border-brand/50 hover:shadow-card ${wide ? "sm:col-span-2 lg:col-span-1 lg:row-span-1" : ""}`}
                  >
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
                      <Icon size={20} strokeWidth={1.75} aria-hidden />
                    </span>
                    <h3 className="mt-4 font-semibold">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-text-muted">{desc}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Final CTA: full-width accent band ──────────────────────────── */}
        <section id="final-cta" className="scroll-mt-24 px-4 py-20 text-center text-white lg:px-8" style={{ backgroundColor: accent }}>
          <div className="mx-auto max-w-3xl">
            <TrendingUp size={28} strokeWidth={1.75} className="mx-auto opacity-80" aria-hidden />
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight lg:text-4xl">{tCta("title")}</h2>
            <p className="mt-4 text-lg leading-relaxed text-white/80">{tCta("subtitle")}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/register"
                className="rounded-lg bg-white px-7 py-3.5 font-semibold transition hover:brightness-95"
                style={{ color: accent }}
              >
                {tCta("primary")}
              </Link>
              <Link
                href="/login"
                className="rounded-lg border border-white/40 px-7 py-3.5 font-semibold text-white transition hover:bg-white/10"
              >
                {tCta("secondary")}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
