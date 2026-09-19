import Link from "next/link";
import type { LandingDesignProps } from "@/designs/contracts";
import type { LandingPageContent } from "@/content/contracts";
import { ConvertioStyles, convertioFonts } from "../ConvertioStyles";
import { getLandingInstruments } from "@/lib/landingData";
import { Reveal } from "@/components/landing/Reveal";
import type { InstrumentView } from "@/lib/types";

/**
 * CONVERTIO landing — the elegant institutional trading platform.
 *
 * Page rhythm (Coinbase-inspired band rotation):
 *   1. Full-bleed dark hero with floating product-UI mockup cards
 *   2. Soft-gray stats band
 *   3. White feature cards (3-up)
 *   4. Dark CTA band
 *   5. White footer
 *
 * All content arrives as typed props (content + brand). Live instruments
 * are fetched internally (data, not content). No domain imports.
 */

interface ConvertioContent extends LandingPageContent {
  // Narrowed required sections for this design
}

export async function ConvertioLanding({ content, brand }: LandingDesignProps) {
  const instruments = getLandingInstruments();
  const c = content.landing as ConvertioContent;

  return (
    <div className={`cv-scope ${convertioFonts}`}>
      <ConvertioStyles />
      <ConvertioNav brandName={brand.name} />

      <main id="main-content" tabIndex={-1}>
        {/* ── 1. Dark hero with product-UI mockup cards ──────────────────── */}
        <section className="cv-section-dark" style={{ paddingTop: 128, paddingBottom: 128 }}>
          <div className="cv-container">
            <div style={{ display: "grid", gap: 64, gridTemplateColumns: "1fr auto" }}>
              <Reveal>
                <h1 className="cv-display cv-display-mega" style={{ color: "var(--cv-on-dark)" }}>
                  {c.hero?.titleA ?? brand.name}
                </h1>
                <p className="cv-body-md" style={{ color: "var(--cv-on-dark-soft)", marginTop: 24, maxWidth: 480 }}>
                  {c.hero?.subtitle ?? "Trade with institutional-grade tools and institutional calm."}
                </p>
                <div style={{ display: "flex", gap: 12, marginTop: 40 }}>
                  <Link href="/register" className="cv-btn cv-btn-primary cv-btn-cta">
                    {c.hero?.ctaPrimaryLabel ?? "Get started"}
                  </Link>
                  <Link href="/login" className="cv-btn cv-btn-outline-dark cv-btn-cta">
                    {c.hero?.ctaSecondaryLabel ?? "Sign in"}
                  </Link>
                </div>
              </Reveal>

              {/* Floating product-UI mockup cards */}
              <Reveal delay={120}>
                <div style={{ position: "relative", width: 380 }}>
                  <ConvertioMockDashboard instruments={instruments} />
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── 2. Stats band (soft gray) ───────────────────────────────────── */}
        <section className="cv-section-soft">
          <div className="cv-container">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 48 }}>
              {(c.stats?.items ?? []).map((stat) => (
                <Reveal key={stat.label}>
                  <div className="cv-mono" style={{ fontSize: "3rem", fontWeight: 500, color: "var(--cv-ink)" }}>
                    {stat.value}
                  </div>
                  <div className="cv-eyebrow" style={{ marginTop: 8 }}>{stat.label}</div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── 3. Feature cards (white, 3-up) ──────────────────────────────── */}
        <section className="cv-section">
          <div className="cv-container">
            <Reveal>
              <span className="cv-eyebrow">{c.pillars?.eyebrow ?? "Platform"}</span>
              <h2 className="cv-display cv-display-lg" style={{ marginTop: 16, maxWidth: 640 }}>
                {c.pillars?.title ?? "Built for serious traders"}
              </h2>
              <p className="cv-body-md" style={{ marginTop: 16, maxWidth: 520 }}>
                {c.pillars?.subtitle ?? "Everything you need to trade with confidence."}
              </p>
            </Reveal>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 24, marginTop: 64 }}>
              {[
                { title: c.pillars?.all?.title ?? "All markets", desc: c.pillars?.all?.desc ?? "Forex, crypto, commodities, indices — one account." },
                { title: c.pillars?.speed?.title ?? "Fast execution", desc: c.pillars?.speed?.desc ?? "Millisecond routing with live quotes on every device." },
                { title: c.pillars?.security?.title ?? "Institutional security", desc: c.pillars?.security?.desc ?? "Segregated funds with bank-grade encryption." },
                { title: c.pillars?.pricing?.title ?? "Transparent pricing", desc: c.pillars?.pricing?.desc ?? "What you see is what you trade. No hidden fees." },
              ].map((card, i) => (
                <Reveal key={card.title} delay={i * 80}>
                  <div className="cv-card">
                    <span className="cv-mono" style={{ fontSize: "0.75rem", color: "var(--cv-primary)" }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginTop: 16 }}>{card.title}</h3>
                    <p className="cv-body-md" style={{ marginTop: 8, fontSize: "0.875rem" }}>{card.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── 4. Dark CTA band ─────────────────────────────────────────────── */}
        <section className="cv-section-dark">
          <div className="cv-container" style={{ textAlign: "center" }}>
            <Reveal>
              <h2 className="cv-display cv-display-md" style={{ color: "var(--cv-on-dark)" }}>
                {c.finalCta?.title ?? "Ready when you are."}
              </h2>
              <p className="cv-body-md" style={{ color: "var(--cv-on-dark-soft)", marginTop: 16, maxWidth: 440, margin: "16px auto 0" }}>
                {c.finalCta?.subtitle ?? "An account takes minutes. The markets are already moving."}
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 40 }}>
                <Link href="/register" className="cv-btn cv-btn-primary cv-btn-cta">
                  {c.finalCta?.ctaPrimaryLabel ?? "Get started"}
                </Link>
                <Link href="/login" className="cv-btn cv-btn-outline-dark cv-btn-cta">
                  {c.finalCta?.ctaSecondaryLabel ?? "Sign in"}
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <ConvertioFooter brand={brand} content={content} />
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function ConvertioNav({ brandName }: { brandName: string }) {
  return (
    <header className="cv-nav cv-nav-dark">
      <div className="cv-container" style={{ display: "flex", alignItems: "center", gap: 32, width: "100%" }}>
        <Link href="/" style={{ fontWeight: 600, fontSize: "1.125rem", color: "inherit", textDecoration: "none" }}>
          {brandName}
        </Link>
        <nav style={{ display: "flex", gap: 4, marginLeft: 24 }} aria-label="Primary">
          <Link href="/about" className="cv-nav-link">Company</Link>
          <Link href="/tools/informers" className="cv-nav-link">Tools</Link>
          <Link href="/analytics/news" className="cv-nav-link">Analytics</Link>
          <Link href="/education/beginners" className="cv-nav-link">Education</Link>
        </nav>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Link href="/login" className="cv-btn cv-btn-secondary-dark" style={{ height: 36, padding: "8px 16px", fontSize: "0.875rem" }}>
            Sign in
          </Link>
          <Link href="/register" className="cv-btn cv-btn-primary" style={{ height: 36, padding: "8px 16px", fontSize: "0.875rem" }}>
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}

function ConvertioMockDashboard({ instruments }: { instruments: InstrumentView[] }) {
  const visible = instruments.slice(0, 4);
  return (
    <div style={{ position: "relative" }}>
      {/* Main dashboard card */}
      <div className="cv-card-dark" style={{ width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <span className="cv-eyebrow" style={{ color: "var(--cv-on-dark-soft)" }}>Dashboard</span>
          <span className="cv-badge" style={{ background: "var(--cv-surface-dark)", color: "var(--cv-on-dark)" }}>LIVE</span>
        </div>
        <div>
          {visible.map((inst) => {
            const up = inst.changePct >= 0;
            return (
              <div key={inst.symbol} className="cv-asset-row" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <div className="cv-asset-icon" style={{ background: "var(--cv-surface-dark)" }}>
                  <span className="cv-mono" style={{ fontSize: "0.625rem", color: "var(--cv-on-dark)" }}>
                    {inst.symbol.slice(0, 2)}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--cv-on-dark)" }}>{inst.symbol}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--cv-on-dark-soft)" }}>{inst.name}</div>
                </div>
                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                  <div className="cv-price" style={{ color: "var(--cv-on-dark)" }}>
                    {inst.mid.toFixed(inst.digits)}
                  </div>
                  <div className={`cv-price-change ${up ? "cv-up" : "cv-down"}`}>
                    {up ? "+" : ""}{inst.changePct.toFixed(2)}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Secondary floating card (overlapping) */}
      <div
        className="cv-card-dark"
        style={{
          position: "absolute",
          bottom: -24,
          right: -24,
          width: 200,
          padding: 20,
          transform: "rotate(-2deg)",
          opacity: 0.9,
        }}
      >
        <span className="cv-eyebrow" style={{ color: "var(--cv-on-dark-soft)", fontSize: "0.625rem" }}>PORTFOLIO</span>
        <div className="cv-mono" style={{ fontSize: "1.5rem", fontWeight: 500, color: "var(--cv-on-dark)", marginTop: 8 }}>
          $12,847
        </div>
        <div className="cv-price-change cv-up" style={{ fontSize: "0.875rem", marginTop: 4 }}>+2.34%</div>
      </div>
    </div>
  );
}

function ConvertioFooter({ brand, content }: { brand: LandingDesignProps["brand"]; content: LandingDesignProps["content"] }) {
  const cols = content.footer.columns;
  return (
    <footer className="cv-footer">
      <div className="cv-container">
        <div style={{ display: "grid", gridTemplateColumns: "2fr repeat(3, 1fr)", gap: 48, marginBottom: 48 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: "1rem", color: "var(--cv-ink)" }}>{brand.name}</div>
            <p className="cv-body-sm" style={{ marginTop: 12, maxWidth: 240 }}>{content.footer.tagline}</p>
            <p className="cv-body-sm" style={{ marginTop: 16 }}>{content.footer.contact.supportEmail}</p>
          </div>
          {cols.map((col) => (
            <nav key={col.key} aria-label={col.label}>
              <h4 className="cv-footer-col-title">{col.label}</h4>
              {col.links.map((link) => (
                <Link key={link.href} href={link.href} className="cv-footer-link">{link.label}</Link>
              ))}
            </nav>
          ))}
        </div>
        <div style={{ borderTop: "1px solid var(--cv-hairline)", paddingTop: 24 }}>
          <p className="cv-legal">{content.footer.risk.paragraphs[0]}</p>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
            <span className="cv-legal">{content.footer.copyright}</span>
            <span className="cv-legal">{content.footer.trademarkLine}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
