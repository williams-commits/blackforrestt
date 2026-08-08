import { ArticleLayout, Section } from "@/components/landing/ArticleLayout";
import { getTranslations } from "next-intl/server";
import { companyLegalName, supportEmail, companyAddress } from "@/lib/branding";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("privacy");
  return { title: t("metaTitle") };
}

export default async function PrivacyPage() {
  const t = await getTranslations("privacy");
  const company = companyLegalName();
  const email = supportEmail();
  const address = companyAddress();
  return (
    <ArticleLayout eyebrow={t("eyebrow")} title={t("title")} description={t("description", { company })}>
      <Section title={t("s1Title")}>
        <p>{t("s1Intro")}</p>
        <ul className="list-disc pl-5 space-y-1 marker:text-brand">
          <li>{t("s1Item1")}</li>
          <li>{t("s1Item2")}</li>
          <li>{t("s1Item3")}</li>
          <li>{t("s1Item4")}</li>
        </ul>
      </Section>
      <Section title={t("s2Title")}>
        <ul className="list-disc pl-5 space-y-1 marker:text-brand">
          <li>{t("s2Item1")}</li>
          <li>{t("s2Item2")}</li>
          <li>{t("s2Item3")}</li>
          <li>{t("s2Item4")}</li>
        </ul>
      </Section>
      <Section title={t("s3Title")}>
        <p>{t("s3Body")}</p>
      </Section>
      <Section title={t("s4Title")}>
        <p>{t("s4Body")}</p>
      </Section>
      <Section title={t("s5Title")}>
        <p>{t("s5Body")}</p>
      </Section>
      <Section title={t("s6Title")}>
        <p>{t("s6Body", { email })}</p>
      </Section>
      <Section title={t("s7Title")}>
        <p>{t("s7Body")}</p>
      </Section>
      <Section title={t("s8Title")}>
        <p>{t("s8Body", { company, address, email })}</p>
      </Section>
    </ArticleLayout>
  );
}
