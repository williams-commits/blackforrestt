import type { ReactNode } from "react";
import Link from "next/link";
import type { PublicDesignProps } from "@/designs/contracts";
import { ConvertioStyles, convertioFonts } from "../ConvertioStyles";
import { ArticleCtaProvider } from "@/components/landing/ArticleCta";

/**
 * CONVERTIO public shell — elegant white-canvas chrome for every interior
 * marketing route. Light top nav, clean content area, editorial footer.
 */
export async function ConvertioPublicShell({ children, brand, navigation, footer, articleCta }: PublicDesignProps) {
  return (
    <div className={`cv-scope ${convertioFonts}`} style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <ConvertioStyles />

      {/* Top nav (light) */}
      <header className="cv-nav">
        <div className="cv-container" style={{ display: "flex", alignItems: "center", gap: 32, width: "100%" }}>
          <Link href="/" style={{ fontWeight: 600, fontSize: "1.125rem", color: "var(--cv-ink)", textDecoration: "none" }}>
            {brand.name}
          </Link>
          <nav style={{ display: "flex", gap: 4 }} aria-label={navigation.ariaLabel}>
            {navigation.groups.map((group) => (
              <Link key={group.key} href={group.links[0]?.href ?? "/"} className="cv-nav-link">
                {group.label}
              </Link>
            ))}
          </nav>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <Link href={navigation.loginHref} className="cv-btn cv-btn-secondary-light" style={{ height: 36, padding: "8px 16px", fontSize: "0.875rem" }}>
              {navigation.loginLabel}
            </Link>
            <Link href={navigation.registerHref} className="cv-btn cv-btn-primary" style={{ height: 36, padding: "8px 16px", fontSize: "0.875rem" }}>
              {navigation.registerLabel}
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <ArticleCtaProvider value={articleCta}>
        <main id="main-content" tabIndex={-1} style={{ flex: 1 }}>{children}</main>
      </ArticleCtaProvider>

      {/* Footer */}
      <footer className="cv-footer">
        <div className="cv-container">
          <div style={{ display: "grid", gridTemplateColumns: "2fr repeat(3, 1fr)", gap: 48, marginBottom: 48 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: "1rem", color: "var(--cv-ink)" }}>{brand.name}</div>
              <p className="cv-body-sm" style={{ marginTop: 12, maxWidth: 240 }}>{footer.tagline}</p>
              <p className="cv-body-sm" style={{ marginTop: 16 }}>{footer.contact.supportEmail}</p>
            </div>
            {footer.columns.map((col) => (
              <nav key={col.key} aria-label={col.label}>
                <h4 className="cv-footer-col-title">{col.label}</h4>
                {col.links.map((link) => (
                  <Link key={link.href} href={link.href} className="cv-footer-link">{link.label}</Link>
                ))}
              </nav>
            ))}
          </div>
          <div style={{ borderTop: "1px solid var(--cv-hairline)", paddingTop: 24 }}>
            <p className="cv-legal">{footer.risk.paragraphs[0]}</p>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
              <span className="cv-legal">{footer.copyright}</span>
              <span className="cv-legal">{footer.trademarkLine}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
