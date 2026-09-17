import Link from "next/link";
import type { LandingDesignProps } from "@/designs/contracts";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Markets } from "@/components/landing/Markets";
import { TradingPlayground } from "@/components/landing/TradingPlayground";
import { ConfidenceSection } from "@/components/landing/ConfidenceSection";
import { TableOfContents } from "@/components/landing/TableOfContents";
import { ProgressChecklist } from "@/components/landing/ProgressChecklist";
import { StickyCta } from "@/components/landing/StickyCta";
import { Footer } from "@/components/landing/Footer";
import { getLandingInstruments } from "@/lib/landingData";
import type { FinalCtaContent } from "@/content/contracts";

// Dynamic rendering is forced by src/app/page.tsx (the host dispatcher) —
// branding values are read from env at request time, not build time.

/**
 * The DEFAULT landing design (Black Forest editorial architecture): serif hero, sticky TOC
 * rail, progress checklist, playground + markets, confidence section.
 * Composed from the shared landing library (@/components/landing/*); this
 * folder owns composition only. ALL copy is assembled ONCE from the
 * blackforest domain content package and flows down as typed contracts.
 * Selected whenever a domain's landingDesign is "default" or unknown.
 */
export async function DefaultLanding({ content }: LandingDesignProps) {
  const { landing, navigation, footer } = content;
  const instruments = getLandingInstruments();
  const SECTIONS = landing.sections ?? [];
  // The hero is intentionally omitted from the manifest: it's always visible
  // at the top, so it would be marked "read" instantly and add noise.

  return (
    <>
      <Navbar content={navigation} />
      <main id="main-content" tabIndex={-1}>
        <Hero content={landing.hero} />

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
                    {landing.playground!.eyebrow}
                  </span>
                  <h2 className="mt-2 text-3xl lg:text-4xl font-bold tracking-tight">
                    {landing.playground!.title}
                  </h2>
                  <p className="font-prose mt-3 text-lg leading-relaxed text-text-muted">
                    {landing.playground!.subtitle}
                  </p>
                </div>
                <TradingPlayground initial={instruments} content={landing.playground!} />
              </section>

              <Markets content={landing.markets.editorial!} />
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
        <ConfidenceSection content={landing.confidence!} />

        {/* Final CTA — also the hide-anchor for StickyCta */}
        <FinalCta content={landing.finalCta} />
      </main>

      <Footer content={footer} />
      <StickyCta content={landing.stickyCta!} />
    </>
  );
}

function FinalCta({ content }: { content: FinalCtaContent }) {
  return (
    <section id="final-cta" className="scroll-mt-24 py-20 bg-canvas border-t border-border-soft">
      <div className="max-w-4xl mx-auto px-4 lg:px-8 text-center">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-brand">
          {content.eyebrow}
        </span>
        <h2 className="mt-2 text-3xl lg:text-4xl font-bold tracking-tight">
          {content.title}
        </h2>
        <p className="font-prose mt-4 text-lg leading-relaxed text-text-muted max-w-xl mx-auto">
          {content.subtitle}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/register"
            className="px-6 py-3 rounded-lg bg-brand text-white font-semibold hover:brightness-110 transition shadow-card"
          >
            {content.ctaPrimaryLabel}
          </Link>
          <Link
            href="/login"
            className="px-6 py-3 rounded-lg bg-canvas border border-border font-semibold hover:bg-panel transition"
          >
            {content.ctaSecondaryLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
