/**
 * Landing content assembly — uses the DOMAIN'S OWN brand identity for the
 * hero, with shared translations only for CTA labels. Replace with your
 * domain's own namespace when you have custom copy.
 */
import { getTranslations } from "next-intl/server";
import type { BrandProfile } from "@/lib/branding";
import type { LandingPageContent } from "@/content/contracts";

export async function __DOMAIN_KEY__LandingContent(brand: BrandProfile): Promise<LandingPageContent> {
  const tCta = await getTranslations("finalCta");
  return {
    domain: "__DOMAIN_KEY__",
    hero: {
      badge: `${brand.name} — Now live`,
      titleA: brand.name,
      subtitle: `Trade crypto, forex, commodities and more on ${brand.name}. Institutional-grade tools with transparent pricing.`,
      ctaPrimaryLabel: tCta("primary"),
      ctaSecondaryLabel: "Launch Platform →",
      stats: [
        { value: "45+", label: "Instruments" },
        { value: "<1s", label: "Execution" },
        { value: "24/7", label: "Markets" },
        { value: "9", label: "Languages" },
      ],
    },
    finalCta: {
      eyebrow: tCta("eyebrow"),
      title: `Ready when you are.`,
      subtitle: `An account takes minutes. The markets are already moving.`,
      ctaPrimaryLabel: tCta("primary"),
      ctaSecondaryLabel: tCta("secondary"),
    },
    markets: {},
  };
}
