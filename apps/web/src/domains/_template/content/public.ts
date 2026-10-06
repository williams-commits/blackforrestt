/** Public (interior-page) content: closing CTA band. */
import { getTranslations } from "next-intl/server";
import type { ArticleClosingCta } from "@/content/contracts";

export async function __DOMAIN_KEY__ArticleCta(): Promise<ArticleClosingCta> {
  const t = await getTranslations("finalCta");
  return { title: t("title"), subtitle: t("subtitle"), primaryLabel: t("primary"), secondaryLabel: t("secondary") };
}
