import { Inter } from "next/font/google";
import { currentBrandProfile } from "@/lib/branding";
import { agileFooterContent, agileLandingContent, agileNavigationContent } from "@/domains/agile/content";
import { getLandingInstruments } from "@/lib/landingData";
import { AgileStyles } from "./AgileStyles";
import { AgileNavbar } from "./AgileNavbar";
import { AgileFooter } from "./AgileFooter";
import { Hero, StatBar } from "./sections/Top";
import { BentoSection } from "./sections/Bento";
import { MarketsSection } from "./sections/Markets";
import { MoversSection } from "./sections/Middle";
import {
  IntelligenceSection,
  ShowcaseSection,
  TrustSection,
  StepsBand,
  FinalCta,
} from "./sections/Bottom";
import { TestimonialsSection } from "./sections/Testimonials";

/**
 * Global Forex Services landing — the global trading desk. The AGILE design:
 * a fully custom visual system that consumes the agile domain's typed content
 * contracts (src/content/contracts.ts, assembled in
 * src/domains/agile/content.ts) — no section here fetches translations or
 * branding itself. A future design can render the same content objects with
 * a completely different composition.
 *
 * Narrative: cinematic hero with the live desk module and floor ticker →
 * the platform's real numbers as a ledger bar → the platform bento (why
 * this desk) → the institutional quote board → movers discovery → analysis
 * intelligence → the terminal showcase (device composition) → the trust
 * registry → numbered onboarding → client voices → the closing frame.
 *
 * Architecture: one section per component under landing/agile/, a scoped
 * token sheet (AgileStyles) instead of long utility chains, scroll reveals
 * via the shared Reveal primitive (reduced-motion safe). All live data comes
 * from the real /api/instruments feed; all trust copy comes from the real
 * brand profile.
 */

// Scoped sharp geometric sans — the primary brand keeps Montserrat; the
// Agile template renders in Inter for its crisper institutional voice.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-agile-inter",
});

export async function AgileLanding() {
  const brand = await currentBrandProfile();
  const [content, navigation, footer, instruments] = await Promise.all([
    agileLandingContent(brand),
    agileNavigationContent(true),
    agileFooterContent(brand),
    Promise.resolve(getLandingInstruments()),
  ]);

  // Live counts per asset class for the bento's asset strip.
  const categoryCounts: Record<string, number> = {};
  for (const instrument of instruments) {
    categoryCounts[instrument.category] = (categoryCounts[instrument.category] ?? 0) + 1;
  }

  return (
    <div className={`ag-shell ag-scope ${inter.className}`}>
      <AgileStyles />
      <AgileNavbar content={navigation} />
      <main id="main-content" tabIndex={-1}>
        <Hero content={content.hero} instruments={instruments} />
        <StatBar content={content.stats} />
        <BentoSection content={content.pillars} categoryCounts={categoryCounts} />
        <MarketsSection initial={instruments} content={content.markets.board} />
        <MoversSection initial={instruments} content={content.movers} />
        <IntelligenceSection content={content.intelligence} />
        <ShowcaseSection content={content.showcase} />
        <TrustSection content={content.trust} />
        <StepsBand content={content.steps} />
        <TestimonialsSection content={content.testimonials} />
        <FinalCta content={content.finalCta} />
      </main>
      <AgileFooter content={footer} />
    </div>
  );
}
