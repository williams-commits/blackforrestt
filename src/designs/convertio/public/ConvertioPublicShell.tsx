import type { ReactNode } from "react";
import Link from "next/link";
import type { PublicDesignProps } from "@/designs/contracts";
import { ConvertioStyles, convertioFonts } from "../ConvertioStyles";
import { ArticleCtaProvider } from "@/components/landing/ArticleCta";

/**
 * CONVERTIO public shell — elegant white-canvas chrome for every interior
 * marketing route.
 *
 * Light sticky nav with blur backdrop + brand-blue CTA pill, generous content
 * area, editorial footer with registration summary + risk strip.
 */
export async function ConvertioPublicShell({ children, brand, navigation, footer, articleCta }: PublicDesignProps) {
  return (
    <div className={`cv-scope ${convertioFonts}`} style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <ConvertioStyles />

      {/* ── Top nav (light, sticky, blur) ─────────────────────────────────── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--cv-hairline)",
        height: 64,
      }}>
        <div className="cv-container" style={{ display: "flex", alignItems: "center", gap: 32, height: "100%" }}>
          <Link href="/" style={{
            fontWeight: 600, fontSize: "1.125rem", color: "var(--cv-ink)",
            textDecoration: "none", letterSpacing: "-0.02em",
          }}>
            {brand.name}
          </Link>

          <nav style={{ display: "flex", gap: 4 }} aria-label={navigation.ariaLabel}>
            {navigation.groups.map((group) => (
              <Link
                key={group.key}
                href={group.links[0]?.href ?? "/"}
                style={{
                  fontSize: "0.875rem", fontWeight: 500,
                  color: "var(--cv-body)",
                  textDecoration: "none",
                  padding: "8px 12px", borderRadius: 8,
                  transition: "color 100ms ease",
                }}
              >
                {group.label}
              </Link>
            ))}
          </nav>

          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <Link href={navigation.loginHref} style={{
              color: "var(--cv-ink)", fontSize: "0.875rem", fontWeight: 500,
              textDecoration: "none", padding: "8px 16px", borderRadius: 8,
            }}>
              {navigation.loginLabel}
            </Link>
            <Link href={navigation.registerHref} className="cv-btn cv-btn-primary" style={{ height: 36, padding: "8px 20px", fontSize: "0.875rem" }}>
              {navigation.registerLabel}
            </Link>
          </div>
        </div>
      </header>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <ArticleCtaProvider value={articleCta}>
        <main id="main-content" tabIndex={-1} style={{ flex: 1 }}>{children}</main>
      </ArticleCtaProvider>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="cv-footer">
        <div className="cv-container">
          <div style={{ display: "grid", gridTemplateColumns: "2fr repeat(3, 1fr)", gap: 48, marginBottom: 48 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: "1rem", color: "var(--cv-ink)" }}>{brand.name}</div>
              <p style={{ fontSize: "0.875rem", color: "var(--cv-muted)", marginTop: 12, maxWidth: 240, lineHeight: 1.5 }}>
                {footer.tagline}
              </p>
              <address style={{ marginTop: 16, fontSize: "0.875rem", color: "var(--cv-body)", fontStyle: "normal" }}>
                {footer.contact.address && <>{footer.contact.address}<br /></>}
                <a href={`mailto:${footer.contact.supportEmail}`} style={{ color: "var(--cv-primary)", textDecoration: "none" }}>
                  {footer.contact.supportEmail}
                </a>
              </address>
              {footer.registrationSummary && (
                <p style={{
                  marginTop: 16,
                  paddingLeft: 12,
                  borderLeft: "2px solid var(--cv-primary)",
                  fontSize: "0.75rem",
                  color: "var(--cv-muted)",
                  lineHeight: 1.5,
                }}>
                  {footer.registrationSummary}
                </p>
              )}
            </div>

            {footer.columns.map((col) => (
              <nav key={col.key} aria-label={col.label}>
                <h4 className="cv-footer-col-title">{col.label}</h4>
                <ul style={{ listStyle: "none", padding: 0 }}>
                  {col.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="cv-footer-link">{link.label}</Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>

          {/* Risk + legal strip */}
          <div style={{ borderTop: "1px solid var(--cv-hairline)", paddingTop: 24 }}>
            <p style={{ fontSize: "0.75rem", color: "var(--cv-muted)", lineHeight: 1.6, marginBottom: 8 }}>
              <strong style={{ color: "var(--cv-body)" }}>{footer.risk.heading}</strong> {footer.risk.paragraphs[0]}
            </p>
            {footer.risk.paragraphs.slice(1).map((p, i) => (
              <p key={i} style={{ fontSize: "0.75rem", color: "var(--cv-muted)", lineHeight: 1.6, marginBottom: 8 }}>{p}</p>
            ))}
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--cv-hairline-soft)" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--cv-muted)" }}>{footer.copyright}</span>
              <span style={{ fontSize: "0.75rem", color: "var(--cv-muted)" }}>{footer.trademarkLine}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
