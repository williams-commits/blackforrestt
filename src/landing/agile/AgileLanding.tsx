import { Inter } from "next/font/google";
import { getTranslations } from "next-intl/server";
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
import { getLandingInstruments } from "@/lib/landingData";

/**
 * Agile FGS landing — the global trading desk.
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
 * brand profile. Functionality, routing, auth and links are unchanged.
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

  // Live counts per asset class for the bento's asset strip.
  const categoryCounts: Record<string, number> = {};
  for (const instrument of instruments) {
    categoryCounts[instrument.category] = (categoryCounts[instrument.category] ?? 0) + 1;
  }

  return (
    <div className={`ag-shell ag-scope ${inter.className}`}>
      <AgileStyles />
      <AgileNavbar />
      <main id="main-content" tabIndex={-1}>
        <Hero />
        <StatBar />
        <BentoSection categoryCounts={categoryCounts} />
        <MarketsSection
          initial={instruments}
          labels={{
            eyebrow: tMarkets("eyebrow"),
            title: tMarkets("title"),
            subtitle: tMarkets("subtitle"),
            cta: tMarkets("cta"),
            categories: {
              forex: tMarkets("categories.forex"),
              crypto: tMarkets("categories.crypto"),
              commodity: tMarkets("categories.commodity"),
              index: tMarkets("categories.index"),
              stock: tMarkets("categories.stock"),
            },
            empty: tMarkets("empty"),
            today: tMarkets("today"),
            updated: tMarkets("updated"),
            panels: tMarkets.raw("panels") as Record<string, { title: string; bullets: string[]; cta: string }>,
          }}
        />
        <MoversSection
          initial={instruments}
          labels={{
            eyebrow: tMovers("eyebrow"),
            title: tMovers("title"),
            subtitle: tMovers("subtitle"),
            metric: tMovers("metric"),
            last: tMovers("last"),
            cta: tMovers("cta"),
          }}
        />
        <IntelligenceSection />
        <ShowcaseSection />
        <TrustSection />
        <StepsBand />
        <TestimonialsSection />
        <FinalCta />
      </main>
      <AgileFooter />
    </div>
  );
}
