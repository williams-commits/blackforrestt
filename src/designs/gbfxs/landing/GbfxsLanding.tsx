import { Inter } from "next/font/google";
import { getLandingInstruments } from "@/lib/landingData";
import { GbfxsStyles } from "../GbfxsStyles";
import { GbfxsNavbar } from "../GbfxsNavbar";
import { GbfxsFooter } from "../GbfxsFooter";
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
 * a fully custom visual system that consumes the gbfxs domain's typed content
 * contracts (src/content/contracts.ts, assembled in
 * src/domains/gbfxs/content.ts) — no section here fetches translations or
 * branding itself. A future design can render the same content objects with
 * a completely different composition.
 *
 * Narrative: cinematic hero with the live desk module and floor ticker →
 * the platform's real numbers as a ledger bar → the platform bento (why
 * this desk) → the institutional quote board → movers discovery → analysis
 * intelligence → the terminal showcase (device composition) → the trust
 * registry → numbered onboarding → client voices → the closing frame.
 *
 * Architecture: one section per component under landing/gbfxs/, a scoped
 * token sheet (GbfxsStyles) instead of long utility chains, scroll reveals
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

import type { LandingDesignProps } from "@/designs/contracts";
import type { HeroContent, LandingPageContent } from "@/content/contracts";

/** The gbfxs design requires the full landing contract (all sections). */
type GbfxsLandingPageContent = LandingPageContent & Required<
  Pick<LandingPageContent, "stats" | "pillars" | "movers" | "intelligence" | "showcase" | "trust" | "steps" | "testimonials">
> & {
  markets: { board: NonNullable<LandingPageContent["markets"]["board"]> };
  hero: HeroContent & Required<Pick<HeroContent, "titleA" | "titleB" | "trustLine" | "panel">>;
};

export async function GbfxsLanding({ content }: LandingDesignProps) {
  const navigation = content.navigation;
  const footer = content.footer;
  const narrowed = content.landing as GbfxsLandingPageContent;
  const instruments = getLandingInstruments();

  // Live counts per asset class for the bento's asset strip.
  const categoryCounts: Record<string, number> = {};
  for (const instrument of instruments) {
    categoryCounts[instrument.category] = (categoryCounts[instrument.category] ?? 0) + 1;
  }

  return (
    <div className={`ag-shell ag-scope ${inter.className}`}>
      <GbfxsStyles />
      <GbfxsNavbar content={navigation} />
      <main id="main-content" tabIndex={-1}>
        <Hero content={narrowed.hero} instruments={instruments} />
        <StatBar content={narrowed.stats} />
        <BentoSection content={narrowed.pillars} categoryCounts={categoryCounts} />
        <MarketsSection initial={instruments} content={narrowed.markets.board} />
        <MoversSection initial={instruments} content={narrowed.movers} />
        <IntelligenceSection content={narrowed.intelligence} />
        <ShowcaseSection content={narrowed.showcase} />
        <TrustSection content={narrowed.trust} />
        <StepsBand content={narrowed.steps} />
        <TestimonialsSection content={narrowed.testimonials} />
        <FinalCta content={narrowed.finalCta} />
      </main>
      <GbfxsFooter content={footer} />
    </div>
  );
}
