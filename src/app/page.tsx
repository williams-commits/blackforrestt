import { currentBrandProfile } from "@/lib/branding";
import { BlackForestLanding } from "@/landing/blackforest/BlackForestLanding";
import { AgileLanding } from "@/landing/agile/AgileLanding";

// Dynamic so branding values (support email, domain, brand name in the Footer
// and Hero card) are read from env at request time, not baked at build time.
export const dynamic = "force-dynamic";

/**
 * Public landing page — a thin host dispatcher. Each brand family owns its
 * landing outright under src/landing/<brand>/ (composition, sections, visual
 * system); everything else is shared library (src/components, src/lib,
 * src/server, i18n) and shared backend (db, redis, dashboard, admin). The
 * brand profile's `landingTemplate` (BRAND_OVERRIDES) picks the tree; unknown
 * keys fall back to the primary brand so a bad env value can never blank
 * the site.
 */
export default async function HomePage() {
  const brand = await currentBrandProfile();
  if (brand.landingTemplate === "agile") return <AgileLanding />;
  return <BlackForestLanding />;
}
