/**
 * __DOMAIN_KEY__ domain package barrel + content loaders
 * (DomainContentLoaders contract — consumed by the generated registry).
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
      __DOMAIN_KEY__LandingContent(brand),
      __DOMAIN_KEY__NavigationContent(),
      __DOMAIN_KEY__FooterContent(brand),
    ]);
    return { landing, navigation, footer };
  },
  async publicChrome(brand: BrandProfile) {
    const [navigation, footer, articleCta] = await Promise.all([
      __DOMAIN_KEY__NavigationContent(),
      __DOMAIN_KEY__FooterContent(brand),
      __DOMAIN_KEY__ArticleCta(),
    ]);
    return { navigation, footer, articleCta };
  },
};
