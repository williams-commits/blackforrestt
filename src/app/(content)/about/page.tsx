import type { ReactNode } from "react";
import { ArticleLayout, Section } from "@/components/landing/ArticleLayout";
import { getTranslations } from "next-intl/server";
import { contentMetadata } from "@/lib/seo";
import { currentBrandProfile } from "@/lib/branding";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("about");
  return contentMetadata("/about", t("metaTitle"));
}

/** Line-style value icons — consistent with the app's inline-SVG convention. */
function ValueIcon({ name }: { name: string }): ReactNode {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-5 w-5",
    "aria-hidden": true,
  };
  switch (name) {
    case "speed":
      return (<svg {...common}><path d="M13 2L3 14h7l-1 8 10-12h-7z" /></svg>);
    case "transparency":
      return (<svg {...common}><circle cx="12" cy="12" r="3" /><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /></svg>);
    case "security":
      return (<svg {...common}><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" /><path d="M9 12l2 2 4-4" /></svg>);
    case "education":
      return (<svg {...common}><path d="M2 9l10-4 10 4-10 4z" /><path d="M6 11v5c0 1 2.5 2.5 6 2.5s6-1.5 6-2.5v-5" /></svg>);
    case "support":
      return (<svg {...common}><path d="M21 11.5a8.5 8.5 0 0 0-17 0" /><path d="M3 16v-2a2 2 0 0 1 2-2h1v6H5a2 2 0 0 1-2-2z" /><path d="M21 16v-2a2 2 0 0 0-2-2h-1v6h1a2 2 0 0 0 2-2z" /></svg>);
    case "access":
      return (<svg {...common}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>);
    default:
      return null;
  }
}

const VALUE_KEYS = ["speed", "transparency", "security", "education", "support", "access"] as const;
const STAT_DEFS = [
  { v: "8+", key: "s1" },
  { v: "<50ms", key: "s2" },
  { v: "24/7", key: "s3" },
  { v: "100%", key: "s4" },
] as const;

export default async function AboutPage() {
  const t = await getTranslations("about");
  const brandProfile = await currentBrandProfile();
  const company = brandProfile.legalName;
  const brand = brandProfile.name;
  const address = brandProfile.address;
  const tStats = await getTranslations("about.stats");
  const tValues = await getTranslations("about.values");

  return (
    <ArticleLayout
      eyebrow={t("eyebrow")}
      title={t("title", { brand })}
      description={t("description")}
    >
      {/* Stats band */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STAT_DEFS.map((s) => (
          <div key={s.key} className="bg-panel border border-border rounded-xl p-5 text-center">
            <div className="text-2xl font-extrabold text-brand tnum">{s.v}</div>
            <div className="text-xs text-text-muted mt-1">{tStats(s.key)}</div>
          </div>
        ))}
      </div>

      <Section title={t("storyTitle")}>
        <p>{t("storyP1", { company })}</p>
        <p>
          {address
            ? t("storyP2", { prefix: t("storyHq", { address }) })
            : t("storyP2", { prefix: t("storyPrefix") })}
        </p>
      </Section>

      <Section title={t("missionTitle")}>
        <p>{t("missionBody")}</p>
      </Section>

      <Section title={t("valuesTitle")}>
        <div className="grid sm:grid-cols-2 gap-4 not-prose">
          {VALUE_KEYS.map((key) => (
            <div key={key} className="flex gap-3 bg-canvas border border-border rounded-xl p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <ValueIcon name={key} />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-text">{tValues(`${key}.t`)}</h3>
                <p className="text-xs text-text-muted mt-0.5">{tValues(`${key}.d`)}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t("complianceTitle")}>
        <p>{t("complianceP1", { company })}</p>
        <p>{t("complianceP2")}</p>
      </Section>
    </ArticleLayout>
  );
}
