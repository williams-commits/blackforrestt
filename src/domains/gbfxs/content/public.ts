/**
 * GBFXS public (interior-page) content: the closing-CTA band provided to
 * public shells through the platform renderer.
 */
import { getTranslations } from "next-intl/server";
import type { ArticleClosingCta } from "@/content/contracts";

/** The interior-page closing CTA band (finalCta namespace). */
export async function gbfxsArticleCta(): Promise<ArticleClosingCta> {
  const t = await getTranslations("finalCta");
  return {
    title: t("title"),
    subtitle: t("subtitle"),
    primaryLabel: t("primary"),
    secondaryLabel: t("secondary"),
  };
}
