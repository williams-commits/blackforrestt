import { InformersWidget } from "@/components/landing/InformersWidget";
import { getTranslations } from "next-intl/server";
import { contentMetadata } from "@/lib/seo";
import { brandDomain } from "@/lib/branding";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("informers");
  return contentMetadata("/tools/informers", t("metaTitle"));
}

/** Server component: reads the brand domain once and passes it to the client widget. */
export default function InformersPage() {
  return <InformersWidget domain={brandDomain()} />;
}
