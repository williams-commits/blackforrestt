import { ArticleLayout, Section } from "@/components/landing/ArticleLayout";
import { getTranslations } from "next-intl/server";
import { contentMetadata } from "@/lib/seo";
import { supportEmail } from "@/lib/branding";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("kyc");
  return contentMetadata("/legal/kyc", t("metaTitle"));
}

export default async function KycPage() {
  const t = await getTranslations("kyc");
  const email = supportEmail();
  return (
    <ArticleLayout eyebrow={t("eyebrow")} title={t("title")} description={t("description")}>
      <Section title={t("s1Title")}><p>{t("s1Body")}</p></Section>
      <Section title={t("s2Title")}>
        <ul className="list-disc pl-5 space-y-1 marker:text-brand">
          <li>{t("s2Item1")}</li>
          <li>{t("s2Item2")}</li>
          <li>{t("s2Item3")}</li>
        </ul>
      </Section>
      <Section title={t("s3Title")}>
        <ol className="list-decimal pl-5 space-y-1 marker:text-brand">
          <li>{t("s3Item1")}</li>
          <li>{t("s3Item2")}</li>
          <li>{t("s3Item3")}</li>
        </ol>
      </Section>
      <Section title={t("s4Title")}><p>{t("s4Body")}</p></Section>
      <Section title={t("s5Title")}><p>{t("s5Body")}</p></Section>
      <Section title={t("s6Title")}><p>{t("s6Body")}</p></Section>
      <Section title={t("s7Title")}><p>{t("s7Body", { email })}</p></Section>
    </ArticleLayout>
  );
}
