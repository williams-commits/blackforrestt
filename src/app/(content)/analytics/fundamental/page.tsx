import { ArticleLayout, Section } from "@/components/landing/ArticleLayout";
import { getTranslations } from "next-intl/server";
import { contentMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("fundamental");
  return contentMetadata("/analytics/fundamental", t("metaTitle"));
}

export default async function FundamentalPage() {
  const t = await getTranslations("fundamental");
  return (
    <ArticleLayout eyebrow={t("eyebrow")} title={t("title")} description={t("description")}>
      <Section title={t("s1Title")}>
        <p>{t("s1P1")}</p>
        <p>{t("s1P2")}</p>
      </Section>
      <Section title={t("s2Title")}>
        <div className="grid sm:grid-cols-3 gap-4 not-prose mt-2">
          {[
            { t: "card1T", d: "card1D" },
            { t: "card2T", d: "card2D" },
            { t: "card3T", d: "card3D" },
          ].map((c) => (
            <div key={c.t} className="bg-canvas border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-text">{t(c.t)}</h3>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">{t(c.d)}</p>
            </div>
          ))}
        </div>
      </Section>
      <Section title={t("s3Title")}>
        <p>{t("s3Intro")}</p>
        <ul className="list-disc pl-5 space-y-2 marker:text-brand">
          <li>{t("s3L1")}</li>
          <li>{t("s3L2")}</li>
          <li>{t("s3L3")}</li>
        </ul>
      </Section>
      <Section title={t("s4Title")}>
        <p>{t("s4Body")}</p>
      </Section>
    </ArticleLayout>
  );
}
