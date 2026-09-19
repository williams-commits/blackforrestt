/**
 * vistest domain package barrel + content loaders
 * (DomainContentLoaders contract — consumed by the generated registry).
 *
 * The CLI leaves the THROWING loaders below: replace them with real
 * assembly copied from the gbfxs/blackforrest packages (they compile but
 * fail fast until a developer wires the content).
 */
import type { BrandProfile } from "@/lib/branding";
import type { DomainContentLoaders } from "@/content/contracts";
import { vistestLandingContent } from "./content/landing";
import { vistestNavigationContent, vistestFooterContent } from "./navigation";
import { vistestArticleCta } from "./content/public";
export { VISTEST_DOMAIN } from "./domain.config";
export { vistestLandingContent } from "./content/landing";
export { vistestNavigationContent, vistestFooterContent } from "./navigation";
export { vistestArticleCta } from "./content/public";
export { VISTEST_SEO } from "./seo";
export { VISTEST_ASSETS } from "./assets";

export const contentLoaders: DomainContentLoaders = {
  async landing(brand: BrandProfile) {
    const [landing, navigation, footer] = await Promise.all([
      vistestLandingContent(),
      vistestNavigationContent(),
      vistestFooterContent(),
    ]);
    return { landing, navigation, footer };
  },
  async publicChrome(brand: BrandProfile) {
    const [navigation, footer, articleCta] = await Promise.all([
      vistestNavigationContent(),
      vistestFooterContent(),
      vistestArticleCta(),
    ]);
    return { navigation, footer, articleCta };
  },
};
