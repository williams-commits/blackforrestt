import { Inter } from "next/font/google";
import { getTranslations } from "next-intl/server";
import { AgileStyles } from "./AgileStyles";
import { AgileNavbar } from "./AgileNavbar";
import { AgileFooter } from "./AgileFooter";
import { Hero, BenefitsStrip, ValueCards } from "./sections/Top";
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
import { getLandingInstruments } from "@/lib/landingData";

/**
 * Agile FGS landing template — premium dark-institutional fintech design.
 * Composition: slim navbar → cinematic hero with a live terminal panel →
 * benefits strip → value cards → markets dashboard → top movers →
 * intelligence band → product showcase → trust triptych → onboarding steps →
 * final CTA → institutional footer.
 *
 * Architecture: one section per component under landing/agile/, a scoped
 * token sheet (AgileStyles) instead of long utility chains, scroll reveals
 * via the Reveal primitive (reduced-motion safe). All live data comes from
 * the real /api/instruments feed; all trust copy comes from the real brand
 * profile. Functionality, routing, auth and links are unchanged.
 */

// Scoped sharp geometric sans — the primary brand keeps Montserrat; the
// Agile template renders in Inter for its crisper institutional voice.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-agile-inter",
});

export async function AgileLanding() {
  const instruments = getLandingInstruments();
  const tMarkets = await getTranslations("agile.markets");
  const tMovers = await getTranslations("agile.movers");

  return (
    <div className={`ag-shell ag-scope ${inter.className}`}>
      <AgileStyles />
      <AgileNavbar />
      <main id="main-content" tabIndex={-1}>
        <Hero />
        <BenefitsStrip />
        <ValueCards />
        <MarketsSection
          initial={instruments}
          labels={{
            eyebrow: tMarkets("eyebrow"),
            title: tMarkets("title"),
            subtitle: tMarkets("subtitle"),
            cta: tMarkets("cta"),
            categories: {
              all: "All",
              forex: "Currencies",
              crypto: "Crypto",
              commodity: "Commodities",
              index: "Indices",
            },
            trade: "Trade",
          }}
        />
        <MoversSection
          initial={instruments}
          labels={{
            eyebrow: tMovers("eyebrow"),
            title: tMovers("title"),
            subtitle: tMovers("subtitle"),
            metric: tMovers("metric"),
            cta: tMovers("cta"),
          }}
        />
        <IntelligenceSection />
        <ShowcaseSection />
        <TrustSection />
        <StepsBand />
        <TestimonialsSection />
        {/* Color bridge: the charcoal steps/testimonials bands melt into the
            deep-green final CTA through a stepped midpoint — pure background,
            no content, so every band keeps its structure. */}
        <FinalCta />
      </main>
      <AgileFooter />
    </div>
  );
}
