import Link from "next/link";
import type { BrandProfile } from "@/lib/branding";
import type { FooterContent } from "@/content/contracts";

/**
 * Convertio footer — the single implementation shared by the landing and the
 * public shell (previously duplicated: inline-styled copy in the shell, a
 * slightly poorer variant in the landing). Renders the brand block (tagline,
 * address, support email, registration summary), the link columns, and the
 * full risk + legal strip from the typed FooterContent contract.
 */
export function ConvertioFooter({ brand, footer }: { brand: BrandProfile; footer: FooterContent }) {
  return (
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
  );
}
