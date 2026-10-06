/**
 * GBFXS domain package. The manifest is the public surface; the loaders
 * implement DomainContentLoaders for the platform renderer (via the
 * generated content registry).
 */
import { gbfxsLandingContent } from "./content/landing";
import { gbfxsNavigationContent, gbfxsFooterContent } from "./navigation";
import { gbfxsArticleCta } from "./content/public";
import type { BrandProfile } from "@/lib/branding";
import type { DomainContentLoaders } from "@/content/contracts";
export { GBFXS_DOMAIN } from "./domain.config";
export { gbfxsLandingContent, type GbfxsLandingPageContent } from "./content/landing";
export { gbfxsNavigationContent, gbfxsFooterContent } from "./navigation";
export { gbfxsArticleCta } from "./content/public";
export { GBFXS_SEO } from "./seo";
export { GBFXS_ASSETS } from "./assets";

export const contentLoaders: DomainContentLoaders = {
  async landing(brand: BrandProfile) {
    const [landing, navigation, footer] = await Promise.all([
      gbfxsLandingContent(brand),
      gbfxsNavigationContent(true),
      gbfxsFooterContent(brand),
    ]);
    return { landing, navigation, footer };
  },
  async publicChrome(brand: BrandProfile) {
    const [navigation, footer, articleCta] = await Promise.all([
      gbfxsNavigationContent(false),
      gbfxsFooterContent(brand),
      gbfxsArticleCta(),
    ]);
    return { navigation, footer, articleCta };
  },
};
