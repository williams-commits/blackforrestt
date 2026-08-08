import { ArticleLayout } from "@/components/landing/ArticleLayout";
import { ContactForm } from "@/components/landing/ContactForm";
import { getTranslations } from "next-intl/server";
import { companyAddress, supportEmail } from "@/lib/branding";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("contact");
  return { title: t("metaTitle") };
}

/** Server component: reads branding env vars once and passes them to the client form. */
export default async function ContactPage() {
  const t = await getTranslations("contact");
  return (
    <ArticleLayout
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
    >
      <ContactForm address={companyAddress()} email={supportEmail()} />
    </ArticleLayout>
  );
}
