/**
 * Landing content assembly — i18n catalogs + brand profile → typed contracts.
 * Replace the placeholder strings with the domain's own catalog namespace.
 */
import { getTranslations } from "next-intl/server";
import type { LandingPageContent } from "@/content/contracts";

export async function vistestLandingContent(): Promise<LandingPageContent> {
  const t = await getTranslations("vistest");
  return {
    domain: "vistest",
    hero: {
      badge: t("badge"),
      subtitle: t("subtitle"),
      ctaPrimaryLabel: t("ctaPrimary"),
      ctaSecondaryLabel: t("ctaSecondary"),
    },
    finalCta: {
      eyebrow: t("finalCta.eyebrow"),
      title: t("finalCta.title"),
      subtitle: t("finalCta.subtitle"),
      ctaPrimaryLabel: t("ctaPrimary"),
      ctaSecondaryLabel: t("ctaSecondary"),
    },
    markets: {},
  };
}
