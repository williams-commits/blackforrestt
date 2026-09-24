import Link from "next/link";
import { ConvertioFooter } from "@/designs/convertio/ConvertioFooter";
import type { LandingDesignProps } from "@/designs/contracts";
import type { LandingPageContent } from "@/content/contracts";
import { ConvertioStyles, convertioFonts } from "../ConvertioStyles";
import { getLandingInstruments } from "@/lib/landingData";
import { Reveal } from "@/components/landing/Reveal";
import type { InstrumentView } from "@/lib/types";

/**
 * CONVERTIO landing — the elegant institutional trading platform.
 *
 * Visual language: Coinbase-inspired — white canvas, a single brand-blue
 * accent, weight-400 display type, pill CTAs, dark-hero band rotation with
 * floating product-UI mockup cards.
 *
 * Section rhythm:
 *   1. Full-bleed dark hero with dashboard mockup + live prices
 *   2. Trust strip (regulators + stats)
 *   3. Feature cards (3-up with icons)
 *   4. Live markets table (real instruments)
 *   5. How it works (3-step)
 *   6. Dark CTA band
 *   7. Footer
 */
export async function ConvertioLanding({ content, brand }: LandingDesignProps) {
  const instruments = getLandingInstruments();
  const c = content.landing as ConvertioLandingContent;

  return (
    <div className={`cv-scope ${convertioFonts}`}>
      <ConvertioStyles />
      <ConvertioNav brand={brand} content={content} />

      <main id="main-content" tabIndex={-1}>
        <ConvertioHero content={c} brand={brand} instruments={instruments} />
        <ConvertioStats content={c} />
        <ConvertioFeatures content={c} />
        <ConvertioMarkets instruments={instruments} content={c} />
        <ConvertioSteps content={c} />
        <ConvertioCta content={c} />
      </main>

      <ConvertioFooter brand={brand} footer={content.footer} />
    </div>
  );
}

type ConvertioLandingContent = LandingPageContent;

/* ══════════════════════════════════════════════════════════════════════════
   NAV
   ══════════════════════════════════════════════════════════════════════════ */
function ConvertioNav({ brand, content }: { brand: LandingDesignProps["brand"]; content: LandingDesignProps["content"] }) {
  const nav = content.navigation;
  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 50,
      background: "rgba(10,11,13,0.85)",
      backdropFilter: "blur(16px)",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
    }}>
      <div className="cv-container" style={{ display: "flex", alignItems: "center", height: 64, gap: 32 }}>
        <Link href="/" style={{
          fontWeight: 600, fontSize: "1.125rem", color: "#fff",
          textDecoration: "none", letterSpacing: "-0.02em",
        }}>
          {brand.name}
        </Link>

        <nav style={{ display: "flex", gap: 4 }} aria-label={nav.ariaLabel}>
          {nav.groups.slice(0, 4).map((group) => (
            <div key={group.key} style={{ position: "relative" }}>
              <Link href={group.links[0]?.href ?? "/"} className="cv-nav-link" style={{ color: "var(--cv-on-dark-soft)" }}>
                {group.label}
              </Link>
            </div>
          ))}
        </nav>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <Link href={nav.loginHref} style={{
            color: "var(--cv-on-dark)", fontSize: "0.875rem", fontWeight: 500,
            textDecoration: "none", padding: "8px 16px", borderRadius: 8,
          }}>
            {nav.loginLabel}
          </Link>
          <Link href={nav.registerHref} className="cv-btn cv-btn-primary" style={{ height: 36, padding: "8px 20px", fontSize: "0.875rem" }}>
            {nav.registerLabel}
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   1. DARK HERO — with dashboard mockup + floating cards
   ══════════════════════════════════════════════════════════════════════════ */
function ConvertioHero({ content, brand, instruments }: {
  content: ConvertioLandingContent;
  brand: LandingDesignProps["brand"];
  instruments: InstrumentView[];
}) {
  const hero = content.hero;
  const badge = hero?.badge ?? "Now live";
  const title = (hero?.titleA ?? brand.name).trim();
  const subtitle = hero?.subtitle ?? "The trusted platform for trading crypto, forex, and more.";

  return (
    <section style={{
      background: "#0a0b0d",
      position: "relative",
      overflow: "hidden",
      paddingTop: 120,
      paddingBottom: 120,
    }}>
      {/* Subtle gradient mesh */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,82,255,0.12), transparent 70%)",
        pointerEvents: "none",
      }} />

      <div className="cv-container" style={{ position: "relative" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 80,
          alignItems: "center",
        }}>
          {/* Left: headline + CTAs */}
          <Reveal>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "6px 16px", borderRadius: 100,
              background: "rgba(0,82,255,0.12)", border: "1px solid rgba(0,82,255,0.25)",
              marginBottom: 32,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#0052ff" }} />
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#7aa2ff", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                {badge}
              </span>
            </div>

            <h1 style={{
              fontFamily: "var(--cv-font-display)",
              fontSize: "clamp(2.75rem, 5vw, 4.5rem)",
              fontWeight: 400,
              lineHeight: 1.0,
              letterSpacing: "-0.03em",
              color: "#fff",
              maxWidth: 520,
            }}>
              {title}
            </h1>

            <p style={{
              fontSize: "1.125rem",
              lineHeight: 1.6,
              color: "var(--cv-on-dark-soft)",
              marginTop: 24,
              maxWidth: 440,
            }}>
              {subtitle}
            </p>

            <div style={{ display: "flex", gap: 12, marginTop: 40 }}>
              <Link href="/register" className="cv-btn cv-btn-primary cv-btn-cta">
                {hero?.ctaPrimaryLabel ?? "Get started"}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
              <Link href="/login" className="cv-btn cv-btn-outline-dark cv-btn-cta">
                {hero?.ctaSecondaryLabel ?? "Sign in"}
              </Link>
            </div>

            {/* Micro trust */}
            <div style={{ display: "flex", gap: 24, marginTop: 40, flexWrap: "wrap" }}>
              {["Segregated funds", "Bank-grade security", "24/7 support"].map((item) => (
                <span key={item} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.8125rem", color: "var(--cv-on-dark-soft)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#05b169" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  {item}
                </span>
              ))}
            </div>
          </Reveal>

          {/* Right: dashboard mockup */}
          <Reveal delay={150}>
            <ConvertioDashboard instruments={instruments} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   DASHBOARD MOCKUP — the floating product-UI card stack
   ══════════════════════════════════════════════════════════════════════════ */
function ConvertioDashboard({ instruments }: { instruments: InstrumentView[] }) {
  const visible = instruments.slice(0, 5);
  return (
    <div style={{ position: "relative" }}>
      {/* Main dashboard card */}
      <div style={{
        background: "#16181c",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 24,
        padding: 28,
        boxShadow: "0 40px 80px -20px rgba(0,0,0,0.6)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <span style={{ fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--cv-on-dark-soft)" }}>
              Portfolio
            </span>
            <div style={{ fontFamily: "var(--cv-font-mono)", fontSize: "2rem", fontWeight: 500, color: "#fff", marginTop: 4 }}>
              $48,294.<span style={{ color: "var(--cv-on-dark-soft)" }}>16</span>
            </div>
          </div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 12px", borderRadius: 100,
            background: "rgba(5,177,105,0.12)", border: "1px solid rgba(5,177,105,0.2)",
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#05b169" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 6l-9.5 9.5-5-5L1 18" /><path d="M17 6h6v6" />
            </svg>
            <span style={{ fontFamily: "var(--cv-font-mono)", fontSize: "0.8125rem", fontWeight: 500, color: "#05b169" }}>
              +12.4%
            </span>
          </div>
        </div>

        {/* Sparkline chart */}
        <div style={{ marginBottom: 20, height: 80 }}>
          <svg viewBox="0 0 300 80" style={{ width: "100%", height: "100%" }} preserveAspectRatio="none">
            <defs>
              <linearGradient id="cv-hero-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(0,82,255,0.3)" />
                <stop offset="100%" stopColor="rgba(0,82,255,0)" />
              </linearGradient>
            </defs>
            <path
              d="M0,60 C20,55 30,50 45,52 C60,54 70,42 85,44 C100,46 110,38 125,40 C140,42 150,30 165,32 C180,34 190,28 205,26 C220,24 230,18 245,16 C260,14 275,12 300,8 L300,80 L0,80 Z"
              fill="url(#cv-hero-grad)"
            />
            <path
              d="M0,60 C20,55 30,50 45,52 C60,54 70,42 85,44 C100,46 110,38 125,40 C140,42 150,30 165,32 C180,34 190,28 205,26 C220,24 230,18 245,16 C260,14 275,12 300,8"
              fill="none"
              stroke="#0052ff"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="300" cy="8" r="4" fill="#0052ff" />
          </svg>
        </div>

        {/* Asset rows */}
        <div>
          {visible.map((inst) => {
            const up = inst.changePct >= 0;
            return (
              <div key={inst.symbol} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 0",
                borderBottom: `1px solid rgba(255,255,255,0.04)`,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: "rgba(255,255,255,0.04)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <span style={{ fontFamily: "var(--cv-font-mono)", fontSize: "0.5625rem", fontWeight: 600, color: "var(--cv-on-dark-soft)" }}>
                    {inst.symbol.slice(0, 3)}
                  </span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#fff" }}>{inst.symbol}</div>
                  <div style={{ fontSize: "0.6875rem", color: "var(--cv-on-dark-soft)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {inst.name}
                  </div>
                </div>
                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                  <div style={{ fontFamily: "var(--cv-font-mono)", fontSize: "0.8125rem", fontWeight: 500, color: "#fff" }}>
                    {inst.mid.toFixed(inst.digits)}
                  </div>
                  <div style={{
                    fontFamily: "var(--cv-font-mono)", fontSize: "0.6875rem", fontWeight: 500,
                    color: up ? "#05b169" : "#cf202f",
                  }}>
                    {up ? "+" : ""}{inst.changePct.toFixed(2)}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating secondary card — overlapping */}
      <div style={{
        position: "absolute",
        bottom: -32,
        right: -20,
        width: 220,
        background: "#16181c",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 20,
        padding: 20,
        transform: "rotate(-2deg)",
        boxShadow: "0 20px 40px -10px rgba(0,0,0,0.5)",
      }}>
        <span style={{ fontSize: "0.625rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--cv-on-dark-soft)" }}>
          Order filled
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <span style={{ fontFamily: "var(--cv-font-mono)", fontSize: "1.25rem", fontWeight: 500, color: "#05b169" }}>
            BUY 0.5
          </span>
          <span style={{ fontFamily: "var(--cv-font-mono)", fontSize: "0.8125rem", color: "var(--cv-on-dark-soft)" }}>
            BTC @ 67,240
          </span>
        </div>
        <div style={{
          marginTop: 12, height: 4, borderRadius: 2,
          background: "rgba(255,255,255,0.04)",
          overflow: "hidden",
        }}>
          <div style={{ width: "72%", height: "100%", borderRadius: 2, background: "#0052ff" }} />
        </div>
        <span style={{ fontSize: "0.625rem", color: "var(--cv-on-dark-soft)", marginTop: 6, display: "block" }}>
          Portfolio · 72% of target
        </span>
      </div>

      {/* Floating tertiary card */}
      <div style={{
        position: "absolute",
        top: -20,
        left: -16,
        padding: "10px 16px",
        background: "#16181c",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 100,
        display: "flex", alignItems: "center", gap: 8,
        boxShadow: "0 12px 24px -8px rgba(0,0,0,0.4)",
      }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#0052ff", animation: "pulse 2s infinite" }} />
        <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "#fff" }}>Live markets</span>
        <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   2. STATS / TRUST STRIP (soft gray)
   ══════════════════════════════════════════════════════════════════════════ */
function ConvertioStats({ content }: { content: ConvertioLandingContent }) {
  const stats = content.stats?.items ?? [
    { value: "45+", label: "Instruments" },
    { value: "<1s", label: "Execution" },
    { value: "24/7", label: "Markets" },
    { value: "9", label: "Languages" },
  ];
  return (
    <section className="cv-section-soft" style={{ paddingTop: 64, paddingBottom: 64 }}>
      <div className="cv-container">
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 48,
        }}>
          {stats.map((stat, i) => (
            <Reveal key={stat.label} delay={i * 80}>
              <div style={{ textAlign: "center" }}>
                <div style={{
                  fontFamily: "var(--cv-font-mono)",
                  fontSize: "clamp(2.5rem, 4vw, 3.5rem)",
                  fontWeight: 500,
                  color: "var(--cv-ink)",
                  letterSpacing: "-0.02em",
                }}>
                  {stat.value}
                </div>
                <div style={{
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: "var(--cv-muted)",
                  marginTop: 4,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}>
                  {stat.label}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   3. FEATURES (white, 3-up with icons)
   ══════════════════════════════════════════════════════════════════════════ */
const FEATURE_ICONS = [
  // All markets (globe)
  <svg key="1" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>,
  // Fast execution (zap)
  <svg key="2" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>,
  // Security (shield)
  <svg key="3" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>,
  // Pricing (tag)
  <svg key="4" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.83z" /><circle cx="7" cy="7" r="1" />
  </svg>,
  // Devices (monitor)
  <svg key="5" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
  </svg>,
  // API (code)
  <svg key="6" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />
  </svg>,
];

function ConvertioFeatures({ content }: { content: ConvertioLandingContent }) {
  const pillars = content.pillars;
  const features = [
    { icon: 0, title: pillars?.all?.title ?? "Every market", desc: pillars?.all?.desc ?? "Forex, crypto, commodities, indices, and stocks — all on one account." },
    { icon: 1, title: pillars?.speed?.title ?? "Fast execution", desc: pillars?.speed?.desc ?? "Millisecond order routing with live quotes streamed to every device." },
    { icon: 2, title: pillars?.security?.title ?? "Institutional security", desc: pillars?.security?.desc ?? "Segregated client funds with bank-grade encryption and cold storage." },
    { icon: 3, title: pillars?.pricing?.title ?? "Transparent pricing", desc: pillars?.pricing?.desc ?? "What you see is what you trade. No hidden fees or spreads." },
    { icon: 4, title: "Any device", desc: "Trade from your browser, phone, or tablet with full feature parity." },
    { icon: 5, title: "Developer API", desc: "REST and WebSocket APIs for automated trading strategies." },
  ];

  return (
    <section className="cv-section">
      <div className="cv-container">
        <Reveal>
          <div style={{ maxWidth: 640 }}>
            <span className="cv-eyebrow">{pillars?.eyebrow ?? "Platform"}</span>
            <h2 className="cv-display cv-display-lg" style={{ marginTop: 16 }}>
              {pillars?.title ?? "Built for serious traders"}
            </h2>
            <p className="cv-body-md" style={{ marginTop: 16 }}>
              {pillars?.subtitle ?? "Everything you need to trade with confidence, from your first position to your thousandth."}
            </p>
          </div>
        </Reveal>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 24,
          marginTop: 64,
        }}>
          {features.map((feature, i) => (
            <Reveal key={feature.title} delay={i * 60}>
              <div className="cv-card">
                <div style={{
                  width: 48, height: 48,
                  borderRadius: 14,
                  background: "var(--cv-surface-strong)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--cv-primary)",
                  marginBottom: 20,
                }}>
                  {FEATURE_ICONS[feature.icon]}
                </div>
                <h3 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--cv-ink)", marginBottom: 8 }}>
                  {feature.title}
                </h3>
                <p className="cv-body-md" style={{ fontSize: "0.875rem" }}>
                  {feature.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   4. LIVE MARKETS TABLE (real instruments)
   ══════════════════════════════════════════════════════════════════════════ */
function ConvertioMarkets({ instruments, content }: { instruments: InstrumentView[]; content: ConvertioLandingContent }) {
  const markets = content.markets;
  const visible = instruments.slice(0, 8);
  return (
    <section className="cv-section-soft">
      <div className="cv-container">
        <Reveal>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 48 }}>
            <div>
              <span className="cv-eyebrow">{markets?.board?.eyebrow ?? "Live markets"}</span>
              <h2 className="cv-display cv-display-md" style={{ marginTop: 12 }}>
                {markets?.board?.title ?? "Trade the world's markets"}
              </h2>
            </div>
            <Link href="/register" className="cv-btn cv-btn-primary" style={{ height: 40, padding: "10px 24px", fontSize: "0.875rem" }}>
              {markets?.board?.ctaLabel ?? "Start trading"}
            </Link>
          </div>
        </Reveal>

        <Reveal delay={80}>
          <div style={{
            background: "var(--cv-canvas)",
            border: "1px solid var(--cv-hairline)",
            borderRadius: 24,
            overflow: "hidden",
          }}>
            {visible.map((inst, i) => {
              const up = inst.changePct >= 0;
              return (
                <Link key={inst.symbol} href={`/trade/${inst.symbol}`} style={{
                  display: "flex", alignItems: "center", gap: 16,
                  padding: "16px 24px",
                  textDecoration: "none",
                  borderBottom: i < visible.length - 1 ? "1px solid var(--cv-hairline-soft)" : "none",
                  transition: "background 100ms ease",
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: "var(--cv-surface-strong)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <span style={{ fontFamily: "var(--cv-font-mono)", fontSize: "0.625rem", fontWeight: 600, color: "var(--cv-body)" }}>
                      {inst.symbol.slice(0, 3)}
                    </span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--cv-ink)" }}>{inst.symbol}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--cv-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {inst.name}
                    </div>
                  </div>
                  <div style={{ marginLeft: "auto", textAlign: "right" }}>
                    <div style={{ fontFamily: "var(--cv-font-mono)", fontSize: "1rem", fontWeight: 500, color: "var(--cv-ink)" }}>
                      {inst.mid.toFixed(inst.digits)}
                    </div>
                  </div>
                  <div style={{
                    fontFamily: "var(--cv-font-mono)",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: up ? "var(--cv-up)" : "var(--cv-down)",
                    width: 80,
                    textAlign: "right",
                  }}>
                    {up ? "+" : ""}{inst.changePct.toFixed(2)}%
                  </div>
                </Link>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   5. HOW IT WORKS (3-step, numbered)
   ══════════════════════════════════════════════════════════════════════════ */
function ConvertioSteps({ content }: { content: ConvertioLandingContent }) {
  const steps = content.steps?.steps ?? [
    { title: "Create your account", desc: "Sign up in minutes with just your email. No minimum deposit to start." },
    { title: "Fund and verify", desc: "Deposit via bank transfer, card, or crypto. KYC verification is built-in." },
    { title: "Start trading", desc: "Access all markets from one dashboard with professional tools." },
  ];

  return (
    <section className="cv-section">
      <div className="cv-container">
        <Reveal>
          <div style={{ textAlign: "center", maxWidth: 560, margin: "0 auto 64px" }}>
            <span className="cv-eyebrow">{content.steps?.eyebrow ?? "Get started"}</span>
            <h2 className="cv-display cv-display-lg" style={{ marginTop: 16 }}>
              {content.steps?.title ?? "Three steps to your first trade"}
            </h2>
          </div>
        </Reveal>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32 }}>
          {steps.map((step, i) => (
            <Reveal key={step.title} delay={i * 100}>
              <div style={{ position: "relative", padding: "0 8px" }}>
                {/* Connector line */}
                {i < steps.length - 1 && (
                  <div style={{
                    position: "absolute", top: 24, right: -32, width: 64,
                    height: 1,
                    background: "linear-gradient(90deg, var(--cv-hairline), transparent)",
                  }} />
                )}
                <div style={{
                  width: 48, height: 48,
                  borderRadius: "50%",
                  border: "2px solid var(--cv-primary)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--cv-font-mono)",
                  fontSize: "0.875rem", fontWeight: 600,
                  color: "var(--cv-primary)",
                  marginBottom: 20,
                }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--cv-ink)", marginBottom: 8 }}>
                  {step.title}
                </h3>
                <p className="cv-body-md" style={{ fontSize: "0.875rem" }}>
                  {step.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   6. DARK CTA BAND
   ══════════════════════════════════════════════════════════════════════════ */
function ConvertioCta({ content }: { content: ConvertioLandingContent }) {
  const cta = content.finalCta;
  return (
    <section style={{
      background: "#0a0b0d",
      position: "relative",
      overflow: "hidden",
      paddingTop: 120,
      paddingBottom: 120,
    }}>
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse 60% 50% at 50% 100%, rgba(0,82,255,0.15), transparent 70%)",
        pointerEvents: "none",
      }} />
      <div className="cv-container" style={{ position: "relative", textAlign: "center" }}>
        <Reveal>
          <h2 style={{
            fontFamily: "var(--cv-font-display)",
            fontSize: "clamp(2.25rem, 4vw, 3.5rem)",
            fontWeight: 400,
            lineHeight: 1.0,
            letterSpacing: "-0.03em",
            color: "#fff",
            maxWidth: 640,
            margin: "0 auto",
          }}>
            {cta?.title ?? "Ready when you are."}
          </h2>
          <p style={{
            fontSize: "1.125rem",
            color: "var(--cv-on-dark-soft)",
            marginTop: 20,
            maxWidth: 440,
            margin: "20px auto 0",
          }}>
            {cta?.subtitle ?? "An account takes minutes. The markets are already moving."}
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 40 }}>
            <Link href="/register" className="cv-btn cv-btn-primary cv-btn-cta">
              {cta?.ctaPrimaryLabel ?? "Get started"}
            </Link>
            <Link href="/login" className="cv-btn cv-btn-outline-dark cv-btn-cta">
              {cta?.ctaSecondaryLabel ?? "Sign in"}
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
