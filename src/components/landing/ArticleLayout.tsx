import type { ReactNode } from "react";

interface Props {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  sidebar?: ReactNode;
}

/**
 * Rich article layout for the marketing content pages. A hero header followed
 * by a main column + optional sidebar, used by Tools / Analytics / Education /
 * About pages.
 */
export function ArticleLayout({ eyebrow, title, description, children, sidebar }: Props) {
  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 py-12">
      <header className="max-w-3xl mb-10">
        <span className="text-xs font-semibold uppercase tracking-widest text-brand">{eyebrow}</span>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight">{title}</h1>
        {description && <p className="mt-4 text-lg text-text-muted">{description}</p>}
      </header>

      {sidebar ? (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_280px] gap-10">
          <article className="prose-content space-y-6">{children}</article>
          <aside className="space-y-4 lg:sticky lg:top-24 self-start">{sidebar}</aside>
        </div>
      ) : (
        <article className="prose-content max-w-3xl space-y-6">{children}</article>
      )}
    </div>
  );
}

/** A styled section block used inside articles. */
export function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section>
      {title && <h2 className="text-xl font-bold mb-3">{title}</h2>}
      <div className="text-[15px] leading-relaxed text-text-muted space-y-3">{children}</div>
    </section>
  );
}
