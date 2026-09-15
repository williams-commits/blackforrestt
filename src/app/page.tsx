import { resolveCurrentDomain } from "@/domains/resolve";
import { landingDesignFor } from "@/landing/designs";

// Dynamic so branding values (support email, domain, brand name in the Footer
// and Hero card) are read from env at request time, not baked at build time.
export const dynamic = "force-dynamic";

/**
 * Public landing page — a thin host dispatcher.
 *
 *   request host → resolveCurrentDomain() → domain's landingDesign key
 *     → design registry (src/landing/designs.ts) → design component
 *
 * Each design owns its composition under src/landing/<design>/ and consumes
 * its domain's typed content contracts; everything else is shared platform
 * (src/components, src/lib, src/server, i18n, backend). Unknown design keys
 * fall back to the default design so a bad env value can never blank the site.
 */
export default async function HomePage() {
  const { host } = await resolveCurrentDomain();
  const Landing = landingDesignFor(host.landingDesign);
  return <Landing />;
}
