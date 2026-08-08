import Link from "next/link";
import { getTranslations } from "next-intl/server";

const FEATURE_KEYS = ["execution", "charting", "risk", "security", "devices", "data"] as const;
const BULLET_KEYS = ["b1", "b2", "b3", "b4"] as const;
const CARD_KEYS = ["guides", "vod", "analysis", "calendar"] as const;

/**
 * "Everything you need to trade with confidence" — platform capabilities +
 * education, unified. Serif prose intros paired with mono labels and data.
 */
export async function ConfidenceSection() {
  const t = await getTranslations("confidence");
  const tFeat = await getTranslations("confidence.features");
  const tEdu = await getTranslations("confidence.education");

  return (
    <section id="confidence" className="scroll-mt-24 py-16 lg:py-24 border-t border-border-soft bg-panel">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="max-w-2xl">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-brand">
            {t("eyebrow")}
          </span>
          <h2 className="mt-2 text-3xl lg:text-4xl font-bold tracking-tight">
            {t("title")}
          </h2>
          <p className="font-prose mt-4 text-lg leading-relaxed text-text-muted">
            {t("subtitle")}
          </p>
        </div>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURE_KEYS.map((key) => (
            <div key={key} className="rounded-xl border border-border bg-canvas p-6">
              <div className="text-[10px] font-mono uppercase tracking-widest text-text-faint">
                {tFeat(`${key}.label`)}
              </div>
              <h3 className="mt-1.5 font-semibold text-lg">{tFeat(`${key}.title`)}</h3>
              <p className="font-prose mt-2 text-sm leading-relaxed text-text-muted">{tFeat(`${key}.desc`)}</p>
            </div>
          ))}
        </div>

        {/* Education row */}
        <div className="mt-12 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-brand">
              {tEdu("eyebrow")}
            </span>
            <h3 className="mt-2 text-2xl font-bold tracking-tight">
              {tEdu("title")}
            </h3>
            <p className="font-prose mt-3 text-text-muted leading-relaxed">
              {tEdu("subtitle")}
            </p>
            <ul className="mt-6 space-y-2.5 text-sm">
              {BULLET_KEYS.map((key) => (
                <li key={key} className="flex items-center gap-2.5">
                  <span className="h-5 w-5 rounded-full bg-up/15 text-up flex items-center justify-center text-[10px] font-mono">
                    ✓
                  </span>
                  <span className="text-text">{tEdu(`bullets.${key}`)}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/education/beginners"
              className="inline-block mt-8 px-5 py-2.5 rounded-lg bg-brand text-white text-sm font-semibold hover:brightness-110 transition"
            >
              {tEdu("start")}
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {CARD_KEYS.map((key) => (
              <EduCard key={key} tag={tEdu(`cards.${key}.tag`)} title={tEdu(`cards.${key}.title`)} desc={tEdu(`cards.${key}.desc`)} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function EduCard({ tag, title, desc }: { tag: string; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-border bg-canvas p-5">
      <div className="text-[10px] font-mono uppercase tracking-widest text-text-faint">{tag}</div>
      <h4 className="mt-1.5 font-semibold">{title}</h4>
      <p className="font-prose mt-1 text-xs text-text-muted leading-relaxed">{desc}</p>
    </div>
  );
}
