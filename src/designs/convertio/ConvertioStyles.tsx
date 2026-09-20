import { Inter, JetBrains_Mono } from "next/font/google";

/**
 * Convertio scoped design tokens — the Coinbase-inspired palette + typography.
 *
 * Mounted by the landing and public shell inside a `.cv-scope` wrapper.
 * This scope remaps EVERY global CSS variable that shared components use
 * (bg-panel, text-brand, border-border, text-text, etc.), so all shared
 * interior-page bodies re-skin automatically — same approach as the gbfxs
 * `.ag-scope`, but with the convertio palette.
 *
 * ARCHITECTURE:
 *   Single brand blue (#0052ff) — every CTA, link, brand accent.
 *   White canvas + soft gray bands + dark editorial heroes.
 *   Display type at weight 400. Numbers in JetBrains Mono.
 *   CTA geometry: pill (100px). Cards: 24px radius.
 */

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--cv-inter",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--cv-mono",
});

export const convertioFonts = `${inter.variable} ${mono.variable}`;

export function ConvertioStyles() {
  return (
    <style>{`
      /* ══════════════════════════════════════════════════════════════════
         TOKEN DEFINITIONS
         ══════════════════════════════════════════════════════════════════ */
      .cv-scope {
        /* Brand */
        --cv-primary: #0052ff;
        --cv-primary-active: #003ecc;
        --cv-primary-soft: rgba(0, 82, 255, 0.06);
        --cv-primary-border: rgba(0, 82, 255, 0.25);

        /* Surfaces */
        --cv-canvas: #ffffff;
        --cv-surface-soft: #f7f7f7;
        --cv-surface-strong: #eef0f3;
        --cv-surface-dark: #0a0b0d;
        --cv-surface-dark-elevated: #16181c;

        /* Hairlines */
        --cv-hairline: #dee1e6;
        --cv-hairline-soft: #eef0f3;

        /* Text */
        --cv-ink: #0a0b0d;
        --cv-body: #5b616e;
        --cv-muted: #7c828a;
        --cv-muted-soft: #a8acb3;
        --cv-on-primary: #ffffff;
        --cv-on-dark: #ffffff;
        --cv-on-dark-soft: #a8acb3;

        /* Trading semantics */
        --cv-up: #05b169;
        --cv-down: #cf202f;

        /* Typography */
        --cv-font-display: var(--cv-inter), -apple-system, system-ui, "Segoe UI", sans-serif;
        --cv-font-sans: var(--cv-inter), -apple-system, system-ui, "Segoe UI", sans-serif;
        --cv-font-mono: var(--cv-mono), "SF Mono", monospace;

        /* ══════════════════════════════════════════════════════════════════
           GLOBAL TOKEN REMAPS — re-skin every shared component inside scope
           ══════════════════════════════════════════════════════════════════ */

        /* Surfaces the shared components use */
        --color-canvas: var(--cv-canvas);
        --color-panel: var(--cv-surface-soft);
        --color-panel-2: var(--cv-surface-strong);
        --color-panel-3: var(--cv-hairline);
        --color-surface-dark: var(--cv-surface-dark);

        /* Borders */
        --color-border: var(--cv-hairline);
        --color-border-soft: var(--cv-hairline-soft);

        /* Brand (the single accent) */
        --color-brand: var(--cv-primary);
        --color-brand-soft: var(--cv-primary-soft);

        /* Text */
        --color-text: var(--cv-ink);
        --color-text-muted: var(--cv-body);
        --color-text-faint: var(--cv-muted);

        /* Trading */
        --color-up: var(--cv-up);
        --color-down: var(--cv-down);

        /* Typography */
        --font-sans: var(--cv-font-sans);
        --font-serif: var(--cv-font-sans);
        --font-mono: var(--cv-font-mono);

        /* Shape + depth (convertio = more rounded, softer shadows) */
        --radius-panel: 12px;
        --shadow-panel: 0 1px 2px rgba(10, 11, 13, 0.04);
        --shadow-card: 0 4px 12px rgba(10, 11, 13, 0.06);

        font-family: var(--cv-font-sans);
        background: var(--cv-canvas);
        color: var(--cv-ink);
      }

      /* ══════════════════════════════════════════════════════════════════
         LAYOUT
         ══════════════════════════════════════════════════════════════════ */
      .cv-container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 24px;
      }

      .cv-section { padding: 96px 0; }
      .cv-section-soft { padding: 96px 0; background: var(--cv-surface-soft); }
      .cv-section-dark {
        padding: 96px 0;
        background: var(--cv-surface-dark);
        color: var(--cv-on-dark);
      }

      /* ══════════════════════════════════════════════════════════════════
         TYPOGRAPHY
         ══════════════════════════════════════════════════════════════════ */
      .cv-display {
        font-family: var(--cv-font-display);
        font-weight: 400;
        letter-spacing: -0.025em;
        line-height: 1.0;
        color: inherit;
      }
      .cv-display-mega { font-size: clamp(2.5rem, 5vw, 5rem); }
      .cv-display-lg { font-size: clamp(2rem, 4vw, 3.25rem); }
      .cv-display-md { font-size: clamp(1.75rem, 3vw, 2.75rem); }
      .cv-display-sm { font-size: clamp(1.5rem, 2.5vw, 2.25rem); }

      .cv-body-md {
        font-size: 1rem;
        font-weight: 400;
        line-height: 1.5;
        color: var(--cv-body);
      }
      .cv-body-sm {
        font-size: 0.875rem;
        font-weight: 400;
        line-height: 1.5;
        color: var(--cv-muted);
      }
      .cv-mono {
        font-family: var(--cv-font-mono);
        font-weight: 500;
        font-variant-numeric: tabular-nums;
      }
      .cv-eyebrow {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--cv-muted);
      }

      /* ══════════════════════════════════════════════════════════════════
         BUTTONS
         ══════════════════════════════════════════════════════════════════ */
      .cv-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font-family: var(--cv-font-sans);
        font-size: 1rem;
        font-weight: 600;
        border-radius: 100px;
        padding: 12px 24px;
        height: 44px;
        cursor: pointer;
        transition: background 150ms ease, transform 100ms ease;
        text-decoration: none;
        white-space: nowrap;
      }
      .cv-btn-primary { background: var(--cv-primary); color: var(--cv-on-primary); }
      .cv-btn-primary:active { background: var(--cv-primary-active); transform: scale(0.98); }
      .cv-btn-primary:disabled { background: #a8b8cc; cursor: not-allowed; }
      .cv-btn-secondary-light { background: var(--cv-surface-strong); color: var(--cv-ink); }
      .cv-btn-secondary-dark { background: var(--cv-surface-dark-elevated); color: var(--cv-on-dark); }
      .cv-btn-outline-dark {
        background: transparent;
        color: var(--cv-on-dark);
        border: 1px solid rgba(255, 255, 255, 0.3);
      }
      .cv-btn-cta { height: 56px; padding: 16px 32px; }
      .cv-btn-text { background: transparent; color: var(--cv-primary); padding: 12px 8px; height: auto; }

      /* ══════════════════════════════════════════════════════════════════
         CARDS
         ══════════════════════════════════════════════════════════════════ */
      .cv-card {
        background: var(--cv-canvas);
        border: 1px solid var(--cv-hairline);
        border-radius: 24px;
        padding: 32px;
        transition: box-shadow 200ms ease;
      }
      .cv-card:hover { box-shadow: 0 4px 12px rgba(10, 11, 13, 0.06); }
      .cv-card-dark {
        background: var(--cv-surface-dark-elevated);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 24px;
        padding: 32px;
        color: var(--cv-on-dark);
      }

      /* ══════════════════════════════════════════════════════════════════
         BADGES / PILLS
         ══════════════════════════════════════════════════════════════════ */
      .cv-badge {
        display: inline-flex;
        align-items: center;
        padding: 6px 14px;
        border-radius: 100px;
        background: var(--cv-surface-strong);
        color: var(--cv-ink);
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      /* ══════════════════════════════════════════════════════════════════
         TRADING
         ══════════════════════════════════════════════════════════════════ */
      .cv-up { color: var(--cv-up); }
      .cv-down { color: var(--cv-down); }
      .cv-price {
        font-family: var(--cv-font-mono);
        font-weight: 500;
        font-size: 1.125rem;
        font-variant-numeric: tabular-nums;
      }
      .cv-price-change {
        font-family: var(--cv-font-mono);
        font-weight: 500;
        font-size: 1rem;
        font-variant-numeric: tabular-nums;
      }
      .cv-asset-row {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px 0;
        border-bottom: 1px solid var(--cv-hairline);
      }
      .cv-asset-row:last-child { border-bottom: none; }
      .cv-asset-icon {
        width: 32px;
        height: 32px;
        border-radius: 9999px;
        background: var(--cv-surface-strong);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      /* ══════════════════════════════════════════════════════════════════
         NAVIGATION
         ══════════════════════════════════════════════════════════════════ */
      .cv-nav {
        background: var(--cv-canvas);
        border-bottom: 1px solid var(--cv-hairline);
        height: 64px;
        display: flex;
        align-items: center;
        position: sticky;
        top: 0;
        z-index: 50;
      }
      .cv-nav-dark {
        background: rgba(10, 11, 13, 0.85);
        backdrop-filter: blur(16px);
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        color: var(--cv-on-dark);
      }
      .cv-nav-link {
        font-size: 0.875rem;
        font-weight: 500;
        color: inherit;
        text-decoration: none;
        padding: 8px 12px;
        border-radius: 8px;
        transition: opacity 150ms ease;
      }
      .cv-nav-link:hover { opacity: 0.7; }

      /* ══════════════════════════════════════════════════════════════════
         FOOTER
         ══════════════════════════════════════════════════════════════════ */
      .cv-footer {
        background: var(--cv-canvas);
        border-top: 1px solid var(--cv-hairline);
        padding: 64px 0 32px;
      }
      .cv-footer-col-title {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--cv-ink);
        margin-bottom: 16px;
      }
      .cv-footer-link {
        font-size: 0.875rem;
        font-weight: 400;
        color: var(--cv-body);
        text-decoration: none;
        display: block;
        padding: 4px 0;
      }
      .cv-footer-link:hover { color: var(--cv-primary); }
      .cv-legal {
        font-size: 0.75rem;
        color: var(--cv-muted);
        line-height: 1.5;
      }

      /* ══════════════════════════════════════════════════════════════════
         SHARED COMPONENT RESKIN — re-style shared classes inside .cv-scope
         (these target the utility classes the (content) page bodies use)
         ══════════════════════════════════════════════════════════════════ */

      /* Panel + card surfaces */
      .cv-scope .bg-panel { background: var(--cv-surface-soft); }
      .cv-scope .bg-panel-2 { background: var(--cv-surface-strong); }
      .cv-scope .bg-canvas { background: var(--cv-canvas); }
      .cv-scope .border { border-color: var(--cv-hairline); }
      .cv-scope .border-border { border-color: var(--cv-hairline); }
      .cv-scope .border-border-soft { border-color: var(--cv-hairline-soft); }
      .cv-scope .rounded-xl { border-radius: 16px; }
      .cv-scope .rounded-lg { border-radius: 12px; }
      .cv-scope .shadow-panel { box-shadow: var(--shadow-panel); }
      .cv-scope .shadow-card { box-shadow: var(--shadow-card); }

      /* Brand colors */
      .cv-scope .text-brand { color: var(--cv-primary); }
      .cv-scope .bg-brand { background: var(--cv-primary); color: var(--cv-on-primary); }
      .cv-scope .bg-brand-soft { background: var(--cv-primary-soft); color: var(--cv-primary); }
      .cv-scope .border-brand { border-color: var(--cv-primary); }
      .cv-scope .ring-brand { --tw-ring-color: var(--cv-primary); }

      /* Text colors */
      .cv-scope .text-text { color: var(--cv-ink); }
      .cv-scope .text-text-muted { color: var(--cv-body); }
      .cv-scope .text-text-faint { color: var(--cv-muted); }

      /* Trading colors */
      .cv-scope .text-up { color: var(--cv-up); }
      .cv-scope .text-down { color: var(--cv-down); }
      .cv-scope .bg-up { background: var(--cv-up); }
      .cv-scope .bg-down { background: var(--cv-down); }

      /* Typography */
      .cv-scope .font-prose { font-family: var(--cv-font-sans); }
      .cv-scope .font-mono { font-family: var(--cv-font-mono); }
      .cv-scope .tnum { font-family: var(--cv-font-mono); font-variant-numeric: tabular-nums; }

      /* Focus states */
      .cv-scope .focus-visible\\:outline-brand:focus-visible { outline-color: var(--cv-primary); }

      /* Prose body (article content inside interior pages) */
      .cv-scope .prose-content h1,
      .cv-scope .prose-content h2,
      .cv-scope .prose-content h3 { font-family: var(--cv-font-display); font-weight: 400; letter-spacing: -0.02em; }
      .cv-scope .prose-content h1 { font-size: 2rem; color: var(--cv-ink); }
      .cv-scope .prose-content h2 { font-size: 1.5rem; color: var(--cv-ink); }
      .cv-scope .prose-content h3 { font-size: 1.25rem; color: var(--cv-ink); }
      .cv-scope .prose-content p { font-size: 1rem; line-height: 1.7; color: var(--cv-body); }
      .cv-scope .prose-content a { color: var(--cv-primary); text-decoration: underline; }
      .cv-scope .prose-content li { color: var(--cv-body); line-height: 1.7; }
      .cv-scope .prose-content strong { color: var(--cv-ink); font-weight: 600; }

      /* Table styling */
      .cv-scope .table { border-collapse: collapse; }
      .cv-scope .table th {
        font-size: 0.6875rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--cv-muted);
        padding: 12px 16px;
        border-bottom: 1px solid var(--cv-hairline);
      }
      .cv-scope .table td {
        padding: 14px 16px;
        border-bottom: 1px solid var(--cv-hairline-soft);
        color: var(--cv-ink);
        font-size: 0.9375rem;
      }

      /* Form inputs */
      .cv-scope .input {
        border-radius: 12px;
        border: 1px solid var(--cv-hairline);
        padding: 14px 16px;
        font-size: 1rem;
        color: var(--cv-ink);
        background: var(--cv-canvas);
        transition: border-color 150ms ease;
      }
      .cv-scope .input:focus {
        outline: none;
        border-color: var(--cv-primary);
        border-width: 2px;
      }

      /* ══════════════════════════════════════════════════════════════════
         RESPONSIVE
         ══════════════════════════════════════════════════════════════════ */
      @media (max-width: 640px) {
        .cv-display-mega { font-size: 2.5rem; }
        .cv-section, .cv-section-soft, .cv-section-dark { padding: 48px 0; }
        .cv-card { padding: 20px; border-radius: 16px; }
        .cv-card-dark { padding: 20px; border-radius: 16px; }
      }
    `}</style>
  );
}
