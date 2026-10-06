import { familyTradeHost } from "@/platform/registry";
import { InformersWidget } from "@/components/landing/InformersWidget";
import { ArticleLayout } from "@/platform/composition";
import { getTranslations } from "next-intl/server";
import { contentMetadata } from "@/lib/seo";
import { currentBrandProfile } from "@/lib/branding";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("informers");
  return contentMetadata("/tools/informers", t("metaTitle"));
}

/** Server component: the embed snippets must point at the REQUESTING brand
 *  family (gbfxs.com visitors get gbfxs.com embeds), not the canonical
 *  primary domain. The page frame comes from the brand dispatcher so each
 *  family renders in its own page architecture. */
export default async function InformersPage() {
  const brand = await currentBrandProfile();
  const t = await getTranslations("informers");
  // /widgets/ticker lives on the extracted trade app — embeds point at the
  // family's trade host (trade.<domain>), not the marketing origin.
  const tradeHost = familyTradeHost(brand.domain);
  return (
    <ArticleLayout eyebrow={t("eyebrow")} title={t("title")} description={t("description")}>
      <InformersWidget domain={`https://${tradeHost ?? brand.domain}`} />
    </ArticleLayout>
  );
}
