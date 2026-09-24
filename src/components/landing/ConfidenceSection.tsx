import Link from "next/link";
import type { ConfidenceContent } from "@/content/contracts";

/**
 * "Everything you need to trade with confidence" — platform capabilities +
 * education, unified. Serif prose intros paired with mono labels and data.
 * ALL copy arrives as the typed ConfidenceContent contract.
 */
export function ConfidenceSection({ content }: { content: ConfidenceContent }) {
  return (
    <section id="confidence" className="scroll-mt-28 py-16 lg:py-24 border-t border-border-soft bg-panel">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="max-w-2xl">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-brand">
            {content.eyebrow}
          </span>
          <h2 className="mt-2 text-3xl lg:text-4xl font-bold tracking-tight">
            {content.title}
          </h2>
          <p className="font-prose mt-4 text-lg leading-relaxed text-text-muted">
            {content.subtitle}
          </p>
        </div>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {content.features.map((feature) => (
            <div key={feature.title} className="rounded-xl border border-border bg-canvas p-6">
              <div className="text-[10px] font-mono uppercase tracking-widest text-text-faint">
                {feature.label}
              </div>
              <h3 className="mt-1.5 font-semibold text-lg">{feature.title}</h3>
              <p className="font-prose mt-2 text-sm leading-relaxed text-text-muted">{feature.desc}</p>
            </div>
          ))}
        </div>

        {/* Education row */}
        <div className="mt-12 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-brand">
              {content.education.eyebrow}
            </span>
            <h3 className="mt-2 text-2xl font-bold tracking-tight">
              {content.education.title}
            </h3>
            <p className="font-prose mt-3 text-text-muted leading-relaxed">
              {content.education.subtitle}
            </p>
            <ul className="mt-6 space-y-2.5 text-sm">
              {content.education.bullets.map((bullet) => (
                <li key={bullet} className="flex items-center gap-2.5">
                  <span className="h-5 w-5 rounded-full bg-up/15 text-up flex items-center justify-center text-[10px] font-mono">
                    ✓
                  </span>
                  <span className="text-text">{bullet}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/education/beginners"
              className="inline-block mt-8 px-5 py-2.5 rounded-lg bg-brand text-white text-sm font-semibold hover:brightness-110 transition"
            >
              {content.education.ctaLabel}
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {content.education.cards.map((card) => (
              <EduCard key={card.title} tag={card.tag} title={card.title} desc={card.desc} />
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
