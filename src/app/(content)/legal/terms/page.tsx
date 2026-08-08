import { ArticleLayout, Section } from "@/components/landing/ArticleLayout";
import { getTranslations } from "next-intl/server";
import { companyLegalName, supportEmail, companyAddress, brandName, brandTrademark } from "@/lib/branding";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("terms");
  return { title: t("metaTitle") };
}

export default async function TermsPage() {
  const t = await getTranslations("terms");
  const company = companyLegalName();
  const email = supportEmail();
  const address = companyAddress();
  const brand = brandName();
  const tm = brandTrademark();
  return (
    <ArticleLayout eyebrow={t("eyebrow")} title={t("title")} description={t("description", { brand })}>
      <Section title={t("s1Title")}><p>{t("s1Body")}</p></Section>
      <Section title={t("s2Title")}><p>{t("s2Body")}</p></Section>
      <Section title={t("s3Title")}><p>{t("s3Body")}</p></Section>
      <Section title={t("s4Title")}><p>{t("s4Body")}</p></Section>
      <Section title={t("s5Title")}><p>{t("s5Body")}</p></Section>
      <Section title={t("s6Title")}><p>{t("s6Body")}</p></Section>
      <Section title={t("s7Title")}><p>{t("s7Body", { company, tm })}</p></Section>
      <Section title={t("s8Title")}><p>{t("s8Body", { company })}</p></Section>
      <Section title={t("s9Title")}><p>{t("s9Body")}</p></Section>
      <Section title={t("s10Title")}><p>{t("s10Body", { company, address, email })}</p></Section>
    </ArticleLayout>
  );
}
