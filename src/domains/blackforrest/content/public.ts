/**
 * Blackforrest public content — the shared finalCta band is read directly
 * by the platform renderer for interior closing CTAs.
 */
import { getTranslations } from "next-intl/server";
import type { ArticleClosingCta } from "@/content/contracts";

/** The interior-page closing CTA band content. */
export async function blackforestArticleCta(): Promise<ArticleClosingCta> {
  const t = await getTranslations("finalCta");
  return {
    title: t("title"),
    subtitle: t("subtitle"),
    primaryLabel: t("primary"),
    secondaryLabel: t("secondary"),
  };
}
