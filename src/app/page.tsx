import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Markets } from "@/components/landing/Markets";
import { TradingPlayground } from "@/components/landing/TradingPlayground";
import { ConfidenceSection } from "@/components/landing/ConfidenceSection";
import { TableOfContents, type TocItem } from "@/components/landing/TableOfContents";
import { ProgressChecklist } from "@/components/landing/ProgressChecklist";
import { StickyCta } from "@/components/landing/StickyCta";
import { Footer } from "@/components/landing/Footer";
import { absoluteTradeUrl } from "@/lib/branding";
import { getLandingInstruments } from "@/lib/landingData";

// Dynamic so branding values (support email, domain, brand name in the Footer
// and Hero card) are read from env at request time, not baked at build time.
export const dynamic = "force-dynamic";

/** Section manifest — single source of truth for TOC + progress checklist.
 *  The hero is intentionally omitted: it's always visible at the top, so it
 *  would be marked "read" instantly and add noise to the list. */
const SECTIONS: TocItem[] = [
  { id: "playground", labelKey: "playground" },
  { id: "market-forex", labelKey: "forex" },
  { id: "market-crypto", labelKey: "crypto" },
  { id: "market-commodity", labelKey: "commodity" },
  { id: "market-index", labelKey: "index" },
  { id: "confidence", labelKey: "confidence" },
  { id: "final-cta", labelKey: "finalCta" },
];

/** Public landing page for Black Forest Digital. */
export default async function HomePage() {
  const instruments = getLandingInstruments();
  const tPlay = await getTranslations("playground");

  return (
    <>
      <Navbar />
      <main id="main-content" tabIndex={-1}>
        <Hero />

        {/* Sticky-rail layout: TOC on the left, content centre, progress right. */}
        <div className="relative">
          <div className="max-w-7xl mx-auto px-4 lg:px-8 grid lg:grid-cols-[200px_minmax(0,1fr)_240px] gap-8">
            {/* Left rail: TOC (sticky, desktop) */}
            <aside className="hidden lg:block py-8">
              <TableOfContents items={SECTIONS} />
            </aside>

            {/* Centre column: playground + markets */}
            <div className="min-w-0 py-8 lg:py-12">
              {/* Mobile TOC strip */}
              <div className="lg:hidden mb-8">
                <TableOfContents items={SECTIONS} />
              </div>

              <section id="playground" className="scroll-mt-24 mb-16 lg:mb-24">
                <div className="max-w-2xl mb-6">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-brand">
                    {tPlay("eyebrow")}
                  </span>
                  <h2 className="mt-2 text-3xl lg:text-4xl font-bold tracking-tight">
                    {tPlay("title")}
                  </h2>
                  <p className="font-prose mt-3 text-lg leading-relaxed text-text-muted">
                    {tPlay("subtitle")}
                  </p>
                </div>
                <TradingPlayground initial={instruments} />
              </section>

              <Markets />
            </div>

            {/* Right rail: progress checklist (sticky, desktop) */}
            <aside className="hidden lg:block py-8">
              <div className="sticky top-24 space-y-4">
                <ProgressChecklist items={SECTIONS} />
              </div>
            </aside>
          </div>
        </div>

        {/* Confidence (features + education) — full width */}
        <ConfidenceSection />

        {/* Final CTA — also the hide-anchor for StickyCta */}
        <FinalCta />
      </main>

      <Footer />
      <StickyCta />
    </>
  );
}

async function FinalCta() {
  const t = await getTranslations("finalCta");
  return (
    <section id="final-cta" className="scroll-mt-24 py-20 bg-canvas border-t border-border-soft">
      <div className="max-w-4xl mx-auto px-4 lg:px-8 text-center">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-brand">
          {t("eyebrow")}
        </span>
        <h2 className="mt-2 text-3xl lg:text-4xl font-bold tracking-tight">
          {t("title")}
        </h2>
        <p className="font-prose mt-4 text-lg leading-relaxed text-text-muted max-w-xl mx-auto">
          {t("subtitle")}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={absoluteTradeUrl("/register")}
            className="px-6 py-3 rounded-lg bg-brand text-white font-semibold hover:brightness-110 transition shadow-card"
          >
            {t("primary")}
          </Link>
          <Link
            href={absoluteTradeUrl("/login")}
            className="px-6 py-3 rounded-lg bg-canvas border border-border font-semibold hover:bg-panel transition"
          >
            {t("secondary")}
          </Link>
        </div>
      </div>
    </section>
  );
}
