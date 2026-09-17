/**
 * Landing runtime composition — the ONLY place that resolves
 * domain → content + design → rendered landing.
 *
 *   request host → resolveCurrentDomain() → landingBundle + design manifest
 *     → <Landing content={bundle} brand={brand} />
 */
import { resolveCurrentDomain } from "@/platform/resolve";
import { landingDesignFor } from "@/designs/registry";
import { landingBundle } from "@/platform/render/content";

export async function renderLanding() {
  const domain = await resolveCurrentDomain();
  const [content, Landing] = await Promise.all([
    landingBundle(domain.host.domain.key, domain.brand),
    landingDesignFor(domain.host.landingDesign),
  ]);
  return <Landing content={content} brand={domain.brand} />;
}
