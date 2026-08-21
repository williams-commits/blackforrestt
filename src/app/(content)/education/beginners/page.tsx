import { ArticleLayout, Section } from "@/components/landing/ArticleLayout";
import { getTranslations } from "next-intl/server";
import { contentMetadata } from "@/lib/seo";
import Link from "next/link";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("beginners");
  return contentMetadata("/education/beginners", t("metaTitle"));
}

export default async function BeginnersPage() {
  const t = await getTranslations("beginners");
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
        <p>{t("s2Intro")}</p>
        <ul className="list-disc pl-5 space-y-2 marker:text-brand">
          <li>{t("s2Item1")}</li>
          <li>{t("s2Item2")}</li>
          <li>{t("s2Item3")}</li>
        </ul>
      </Section>

      <Section title={t("s3Title")}>
        <p>{t("s3P1")}</p>
        <p>{t("s3P2")}</p>
      </Section>

      <Section title={t("s4Title")}>
        <p>{t("s4P1")}</p>
      </Section>

      <Section title={t("s5Title")}>
        <p>{t("s5P1")}</p>
        <p>{t("s5P2")}</p>
      </Section>

      <Section title={t("s6Title")}>
        <ul className="list-disc pl-5 space-y-2 marker:text-brand">
          <li>{t("s6Item1")}</li>
          <li>{t("s6Item2")}</li>
          <li>
            {t("s6Item3Prefix")}{" "}
            <Link href="/education/advanced" className="text-brand hover:underline">{t("s6Item3Link")}</Link>{" "}
            {t("s6Item3Suffix")}
          </li>
        </ul>
      </Section>
    </ArticleLayout>
  );
}
