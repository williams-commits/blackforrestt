import Link from "next/link";
import type { PublicDesignProps } from "@/designs/contracts";
import { ConvertioStyles, convertioFonts } from "../ConvertioStyles";
import { ArticleCtaProvider } from "@/components/landing/ArticleCta";
import { ConvertioFooter } from "@/designs/convertio/ConvertioFooter";

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

      <ConvertioFooter brand={brand} footer={footer} />
    </div>
  );
}
