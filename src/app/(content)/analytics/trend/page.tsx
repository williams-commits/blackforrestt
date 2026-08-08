import { ArticleLayout, Section } from "@/components/landing/ArticleLayout";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("trend");
  return { title: t("metaTitle") };
}

export default async function TrendPage() {
  const t = await getTranslations("trend");
  return (
    <ArticleLayout eyebrow={t("eyebrow")} title={t("title")} description={t("description")}>
      <Section title={t("s1Title")}>
        <p>{t("s1Body")}</p>
      </Section>
      <Section title={t("s2Title")}>
        <p>{t("s2Intro")}</p>
        <ul className="list-disc pl-5 space-y-2 marker:text-brand">
          <li>{t("s2L1")}</li>
          <li>{t("s2L2")}</li>
          <li>{t("s2L3")}</li>
        </ul>
      </Section>
      <Section title={t("s3Title")}>
        <p>{t("s3Body")}</p>
      </Section>
      <Section title={t("s4Title")}>
        <div className="bg-canvas border border-border rounded-xl p-5 not-prose">
          <p className="text-sm font-semibold text-text mb-3">{t("s4Heading")}</p>
          <ul className="list-disc pl-5 space-y-2 text-sm text-text-muted marker:text-brand">
            <li>{t("s4L1")}</li>
            <li>{t("s4L2")}</li>
            <li>{t("s4L3")}</li>
            <li>{t("s4L4")}</li>
            <li>{t("s4L5")}</li>
          </ul>
        </div>
      </Section>
      <Section title={t("s5Title")}>
        <p>{t("s5Body")}</p>
      </Section>
    </ArticleLayout>
  );
}
