import { ArticleLayout, Section } from "@/components/landing/ArticleLayout";
import { getTranslations } from "next-intl/server";
import { contentMetadata } from "@/lib/seo";
import { companyLegalName, supportEmail } from "@/lib/branding";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("aml");
  return contentMetadata("/legal/aml", t("metaTitle"));
}

export default async function AmlPage() {
  const t = await getTranslations("aml");
  const company = companyLegalName();
  const email = supportEmail();
  return (
    <ArticleLayout eyebrow={t("eyebrow")} title={t("title")} description={t("description", { company })}>
      <Section title={t("s1Title")}><p>{t("s1Body")}</p></Section>
      <Section title={t("s2Title")}><p>{t("s2Body")}</p></Section>
      <Section title={t("s3Title")}><p>{t("s3Body")}</p></Section>
      <Section title={t("s4Title")}><p>{t("s4Body")}</p></Section>
      <Section title={t("s5Title")}><p>{t("s5Body")}</p></Section>
      <Section title={t("s6Title")}><p>{t("s6Body")}</p></Section>
      <Section title={t("s7Title")}><p>{t("s7Body")}</p></Section>
      <Section title={t("s8Title")}><p>{t("s8Body", { email })}</p></Section>
    </ArticleLayout>
  );
}
