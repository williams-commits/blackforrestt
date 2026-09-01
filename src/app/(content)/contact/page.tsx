import { ArticleLayout } from "@/landing/composition";
import { ContactForm } from "@/components/landing/ContactForm";
import { getTranslations } from "next-intl/server";
import { contentMetadata } from "@/lib/seo";
import { currentBrandProfile } from "@/lib/branding";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("contact");
  return contentMetadata("/contact", t("metaTitle"));
}

/** Server component: reads branding env vars once and passes them to the client form. */
export default async function ContactPage() {
  const t = await getTranslations("contact");
  const brand = await currentBrandProfile();
  return (
    <ArticleLayout
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
    >
      <ContactForm address={brand.address} email={brand.supportEmail} />
    </ArticleLayout>
  );
}
