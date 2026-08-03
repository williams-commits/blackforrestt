import Link from "next/link";

interface Props {
  eyebrow: string;
  title: string;
  description: string;
  bullets?: string[];
  cta?: { label: string; href: string };
}

/**
 * A reusable content/coming-soon page used for the marketing routes that aren't
 * fully built out yet (Tools, Analytics, Education). Presents the page's intent
 * with a clean hero, a benefit list, and a CTA, so the route is never a dead
 * 404.
 */
export function ContentPage({ eyebrow, title, description, bullets, cta }: Props) {
  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-8 py-20">
      <span className="text-xs font-semibold uppercase tracking-widest text-brand">{eyebrow}</span>
      <h1 className="mt-2 text-4xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-4 text-lg text-text-muted">{description}</p>

      {bullets && (
        <ul className="mt-8 space-y-3">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-3">
              <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-up/15 text-up flex items-center justify-center text-[10px]">✓</span>
              <span className="text-sm text-text">{b}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-10 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-soft text-brand text-sm font-medium">
        <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
        Content coming soon
      </div>

      {cta && (
        <div className="mt-6">
          <Link
            href={cta.href}
            className="inline-block px-5 py-2.5 rounded-lg bg-brand text-white text-sm font-semibold hover:brightness-110 transition"
          >
            {cta.label}
          </Link>
        </div>
      )}
    </div>
  );
}
