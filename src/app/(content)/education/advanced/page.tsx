import { ArticleLayout, Section } from "@/landing/composition";
import { getTranslations } from "next-intl/server";
import { contentMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("advanced");
  return contentMetadata("/education/advanced", t("metaTitle"));
}

export default async function AdvancedPage() {
  const t = await getTranslations("advanced");
  return (
    <ArticleLayout
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
    >
      <Section title={t("s1Title")}>
        <p>{t("s1P1")}</p>
        <p>{t("s1P2")}</p>
      </Section>

      <Section title={t("s2Title")}>
        <p>{t("s2P1")}</p>
        <div className="bg-panel border border-border rounded-lg p-4 text-center font-mono text-sm text-text not-prose mt-2">
          f* = (b·p − q) / b
        </div>
        <p>{t("s2P2")}</p>
      </Section>

      <Section title={t("s3Title")}>
        <p>{t("s3P1")}</p>
      </Section>

      <Section title={t("s4Title")}>
        <div className="bg-canvas border border-border rounded-xl p-5 not-prose">
          <p className="text-sm font-semibold text-text mb-3">{t("s4Intro")}</p>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-text-muted marker:text-brand">
            <li>{t("s4Item1")}</li>
            <li>{t("s4Item2")}</li>
            <li>{t("s4Item3")}</li>
            <li>{t("s4Item4")}</li>
            <li>{t("s4Item5")}</li>
            <li>{t("s4Item6")}</li>
          </ol>
        </div>
        <p>{t("s4P2")}</p>
      </Section>

      <Section title={t("s5Title")}>
        <p>{t("s5P1")}</p>
        <p>{t("s5P2")}</p>
      </Section>
    </ArticleLayout>
  );
}
