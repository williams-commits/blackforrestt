import { currentBrandProfile } from "@/lib/branding";
import { DefaultLanding } from "@/components/landing/templates/DefaultLanding";
import { AgileLanding } from "@/components/landing/templates/AgileLanding";

// Dynamic so branding values (support email, domain, brand name in the Footer
// and Hero card) are read from env at request time, not baked at build time.
export const dynamic = "force-dynamic";

/**
 * Public landing page — a thin dispatcher. The brand profile's
 * `landingTemplate` (BRAND_OVERRIDES) selects the composition; every template
 * owns its own section manifest, anchors and visual system while sharing the
 * brand-aware Navbar/Footer and the i18n catalogs. Unknown keys fall back to
 * the default template so a bad env value can never blank the site.
 */
export default async function HomePage() {
  const brand = await currentBrandProfile();
  if (brand.landingTemplate === "agile") return <AgileLanding />;
  return <DefaultLanding />;
}
