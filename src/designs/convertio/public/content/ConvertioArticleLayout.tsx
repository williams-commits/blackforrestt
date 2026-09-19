"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useArticleCta } from "@/components/landing/ArticleCta";

/**
 * CONVERTIO article layout — elegant editorial page architecture.
 *
 * Light canvas, generous spacing, display-weight-400 headings, blue accent
 * links. The closing CTA band inverts to the dark canvas with a centered
 * pill CTA.
 */

interface Props {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  sidebar?: ReactNode;
}

export function ConvertioArticleLayout({ eyebrow, title, description, children, sidebar }: Props) {
  const closingCta = useArticleCta();

  return (
    <div>
      {/* Header band — soft gray editorial plate */}
      <header className="cv-section-soft" style={{ paddingTop: 64, paddingBottom: 64 }}>
        <div className="cv-container">
          <span className="cv-eyebrow">{eyebrow}</span>
          <h1 className="cv-display cv-display-lg" style={{ marginTop: 16, maxWidth: 720 }}>{title}</h1>
          {description && (
            <p className="cv-body-md" style={{ marginTop: 16, maxWidth: 560 }}>{description}</p>
          )}
        </div>
      </header>

      {/* Body — white canvas, editorial measure */}
      <div className="cv-container" style={{ paddingTop: 64, paddingBottom: 64 }}>
        {sidebar ? (
          <div style={{ display: "grid", gap: 48, gridTemplateColumns: "minmax(0, 1fr) 280px" }}>
            <article style={{ maxWidth: 720 }}>{children}</article>
            <aside style={{ position: "sticky", top: 96, alignSelf: "start" }}>{sidebar}</aside>
          </div>
        ) : (
          <article style={{ maxWidth: 720, margin: "0 auto" }}>{children}</article>
        )}
      </div>

      {/* Closing CTA — dark inverted band */}
      {closingCta && (
        <aside className="cv-section-dark" style={{ paddingTop: 64, paddingBottom: 64 }}>
          <div className="cv-container" style={{ textAlign: "center" }}>
            <h2 className="cv-display cv-display-md" style={{ color: "var(--cv-on-dark)" }}>
              {closingCta.title}
            </h2>
            <p className="cv-body-md" style={{ color: "var(--cv-on-dark-soft)", marginTop: 12, maxWidth: 420, margin: "12px auto 0" }}>
              {closingCta.subtitle}
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 32 }}>
              <Link href="/register" className="cv-btn cv-btn-primary">{closingCta.primaryLabel}</Link>
              <Link href="/login" className="cv-btn cv-btn-outline-dark">{closingCta.secondaryLabel}</Link>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}

export function ConvertioSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section>
      {title && (
        <h2 style={{ fontSize: "1.375rem", fontWeight: 600, color: "var(--cv-ink)", marginBottom: 20 }}>
          {title}
        </h2>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
    </section>
  );
}
