/**
 * Blackforrest domain package. The manifest is the public surface; the
 * loaders implement DomainContentLoaders for the platform renderer.
 */
import { blackforestLandingContent } from "./content/landing";
import { blackforestLandingSections } from "./content/sections";
import { blackforestNavigationContent, blackforestFooterContent } from "./navigation";
import { blackforestArticleCta } from "./content/public";
import type { BrandProfile } from "@/lib/branding";
import type { DomainContentLoaders } from "@/content/contracts";
export { BLACKFOREST_DOMAIN } from "./domain.config";
export { blackforestLandingContent } from "./content/landing";
export { blackforestLandingSections } from "./content/sections";
export { blackforestNavigationContent, blackforestFooterContent } from "./navigation";
export { blackforestArticleCta } from "./content/public";
export { BLACKFOREST_SEO } from "./seo";
export { BLACKFOREST_ASSETS } from "./assets";

export const contentLoaders: DomainContentLoaders = {
  async landing(brand: BrandProfile) {
    const [landing, navigation, footer] = await Promise.all([
      blackforestLandingContent(brand),
      blackforestNavigationContent(),
      blackforestFooterContent(brand),
    ]);
    landing.sections = await blackforestLandingSections();
    return { landing, navigation, footer };
  },
  async publicChrome(brand: BrandProfile) {
    const [navigation, footer, articleCta] = await Promise.all([
      blackforestNavigationContent(),
      blackforestFooterContent(brand),
      blackforestArticleCta(),
    ]);
    return { navigation, footer, articleCta };
  },
};
