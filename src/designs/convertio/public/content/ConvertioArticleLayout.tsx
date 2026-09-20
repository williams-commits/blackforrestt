"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useArticleCta } from "@/components/landing/ArticleCta";

/**
 * CONVERTIO article layout — the editorial interior page architecture.
 *
 * Soft-gray header band → white canvas body at editorial measure →
 * dark inverted closing CTA band. Typography follows the convertio system:
 * weight-400 display headings, body color for prose, blue accent links.
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
      {/* ── Header band — soft gray editorial plate ─────────────────────── */}
      <header style={{
        background: "var(--cv-surface-soft)",
        borderBottom: "1px solid var(--cv-hairline)",
        paddingTop: 72,
        paddingBottom: 72,
      }}>
        <div className="cv-container">
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 14px", borderRadius: 100,
            background: "var(--cv-primary-soft)",
            border: "1px solid var(--cv-primary-border)",
            fontSize: "0.6875rem", fontWeight: 600,
            letterSpacing: "0.06em", textTransform: "uppercase",
            color: "var(--cv-primary)",
            marginBottom: 20,
          }}>
            {eyebrow}
          </span>
          <h1 style={{
            fontFamily: "var(--cv-font-display)",
            fontSize: "clamp(2rem, 4vw, 3.25rem)",
            fontWeight: 400,
            letterSpacing: "-0.025em",
            lineHeight: 1.05,
            color: "var(--cv-ink)",
            maxWidth: 720,
          }}>
            {title}
          </h1>
          {description && (
            <p style={{
              fontSize: "1.125rem",
              lineHeight: 1.6,
              color: "var(--cv-body)",
              marginTop: 20,
              maxWidth: 560,
            }}>
              {description}
            </p>
          )}
        </div>
      </header>

      {/* ── Body — white canvas at editorial measure ────────────────────── */}
      <div className="cv-container" style={{ paddingTop: 72, paddingBottom: 72 }}>
        {sidebar ? (
          <div style={{ display: "grid", gap: 48, gridTemplateColumns: "minmax(0, 1fr) 280px" }}>
            <article className="prose-content" style={{ maxWidth: 720 }}>{children}</article>
            <aside style={{ position: "sticky", top: 96, alignSelf: "start" }}>{sidebar}</aside>
          </div>
        ) : (
          <article className="prose-content" style={{ maxWidth: 720, margin: "0 auto" }}>{children}</article>
        )}
      </div>

      {/* ── Closing CTA — dark inverted band ────────────────────────────── */}
      {closingCta && (
        <aside style={{
          background: "var(--cv-surface-dark)",
          position: "relative",
          overflow: "hidden",
          paddingTop: 72,
          paddingBottom: 72,
        }}>
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(ellipse 60% 50% at 50% 100%, rgba(0,82,255,0.15), transparent 70%)",
            pointerEvents: "none",
          }} />
          <div className="cv-container" style={{ position: "relative", textAlign: "center" }}>
            <h2 style={{
              fontFamily: "var(--cv-font-display)",
              fontSize: "clamp(1.75rem, 3vw, 2.75rem)",
              fontWeight: 400,
              letterSpacing: "-0.02em",
              color: "var(--cv-on-dark)",
            }}>
              {closingCta.title}
            </h2>
            <p style={{
              fontSize: "1rem",
              color: "var(--cv-on-dark-soft)",
              marginTop: 12,
              maxWidth: 420,
              margin: "12px auto 0",
            }}>
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
        <h2 style={{
          fontSize: "1.375rem",
          fontWeight: 400,
          fontFamily: "var(--cv-font-display)",
          letterSpacing: "-0.02em",
          color: "var(--cv-ink)",
          marginBottom: 20,
          paddingBottom: 12,
          borderBottom: "1px solid var(--cv-hairline)",
        }}>
          {title}
        </h2>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
    </section>
  );
}
