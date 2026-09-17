/**
 * __DOMAIN_KEY__ domain package barrel + content loaders
 * (DomainContentLoaders contract — consumed by the generated registry).
 *
 * The CLI leaves the THROWING loaders below: replace them with real
 * assembly copied from the gbfxs/blackforrest packages (they compile but
 * fail fast until a developer wires the content).
 */
import type { BrandProfile } from "@/lib/branding";
import type { DomainContentLoaders } from "@/content/contracts";
import { __DOMAIN_KEY__LandingContent } from "./content/landing";
import { __DOMAIN_KEY__NavigationContent, __DOMAIN_KEY__FooterContent } from "./navigation";
import { __DOMAIN_KEY__ArticleCta } from "./content/public";
export { __DOMAIN_KEY___DOMAIN } from "./domain.config";
export { __DOMAIN_KEY__LandingContent } from "./content/landing";
export { __DOMAIN_KEY__NavigationContent, __DOMAIN_KEY__FooterContent } from "./navigation";
export { __DOMAIN_KEY__ArticleCta } from "./content/public";
export { __DOMAIN_KEY___SEO } from "./seo";
export { __DOMAIN_KEY___ASSETS } from "./assets";

export const contentLoaders: DomainContentLoaders = {
  async landing(brand: BrandProfile) {
    const [landing, navigation, footer] = await Promise.all([
      __DOMAIN_KEY__LandingContent(),
      __DOMAIN_KEY__NavigationContent(),
      __DOMAIN_KEY__FooterContent(),
    ]);
    return { landing, navigation, footer };
  },
  async publicChrome(brand: BrandProfile) {
    const [navigation, footer, articleCta] = await Promise.all([
      __DOMAIN_KEY__NavigationContent(),
      __DOMAIN_KEY__FooterContent(),
      __DOMAIN_KEY__ArticleCta(),
    ]);
    return { navigation, footer, articleCta };
  },
};
