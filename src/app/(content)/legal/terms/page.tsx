import { ArticleLayout, Section } from "@/landing/composition";
import { getTranslations } from "next-intl/server";
import { contentMetadata } from "@/lib/seo";
import { currentBrandProfile } from "@/lib/branding";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("terms");
  return contentMetadata("/legal/terms", t("metaTitle"));
}

export default async function TermsPage() {
  const t = await getTranslations("terms");
  const brandProfile = await currentBrandProfile();
  const company = brandProfile.legalName;
  const email = brandProfile.supportEmail;
  const address = brandProfile.address;
  const brand = brandProfile.name;
  const tm = brandProfile.trademark;
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
