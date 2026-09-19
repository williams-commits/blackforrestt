import { Inter, JetBrains_Mono } from "next/font/google";

/**
 * Convertio scoped design tokens — the Coinbase-inspired palette + typography.
 *
 * Mounted by the landing and public shell inside a `.cv-scope` wrapper that
 * remaps the shared `--color-*` / `--font-*` variables so every shared
 * component underneath re-skins automatically. No product conditionals.
 *
 * ARCHITECTURE:
 *   Single brand blue (#0052ff) carries every primary CTA + wordmark.
 *   White canvas + soft gray bands + dark editorial heroes rotate as page rhythm.
 *   Display type stays at weight 400 (institutional calm, not urgency).
 *   Every number renders in JetBrains Mono (tabular data).
 *   CTA geometry: pill (100px). Card geometry: 24px radius.
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
      .cv-scope {
        /* ── Brand & Accent ─────────────────────────────────────────────── */
        --cv-primary: #0052ff;
        --cv-primary-active: #003ecc;
        --cv-primary-disabled: #a8b8cc;

        /* ── Surfaces ───────────────────────────────────────────────────── */
        --cv-canvas: #ffffff;
        --cv-surface-soft: #f7f7f7;
        --cv-surface-strong: #eef0f3;
        --cv-surface-dark: #0a0b0d;
        --cv-surface-dark-elevated: #16181c;

        /* ── Hairlines ──────────────────────────────────────────────────── */
        --cv-hairline: #dee1e6;
        --cv-hairline-soft: #eef0f3;

        /* ── Text ───────────────────────────────────────────────────────── */
        --cv-ink: #0a0b0d;
        --cv-body: #5b616e;
        --cv-muted: #7c828a;
        --cv-muted-soft: #a8acb3;
        --cv-on-primary: #ffffff;
        --cv-on-dark: #ffffff;
        --cv-on-dark-soft: #a8acb3;

        /* ── Trading Semantics ──────────────────────────────────────────── */
        --cv-up: #05b169;
        --cv-down: #cf202f;

        /* ── Typography ─────────────────────────────────────────────────── */
        --cv-font-display: var(--cv-inter), -apple-system, system-ui, "Segoe UI", sans-serif;
        --cv-font-sans: var(--cv-inter), -apple-system, system-ui, "Segoe UI", sans-serif;
        --cv-font-mono: var(--cv-mono), "SF Mono", monospace;

        /* Remap shared tokens so shared components re-skin */
        --color-brand: var(--cv-primary);
        --color-canvas: var(--cv-canvas);
        --color-text: var(--cv-ink);
        --color-text-muted: var(--cv-body);
        --color-border: var(--cv-hairline);
        --color-border-soft: var(--cv-hairline-soft);
        --color-up: var(--cv-up);
        --color-down: var(--cv-down);
        --font-sans: var(--cv-font-sans);
        --font-mono: var(--cv-font-mono);

        font-family: var(--cv-font-sans);
        background: var(--cv-canvas);
        color: var(--cv-ink);
      }

      /* ── Layout ────────────────────────────────────────────────────────── */
      .cv-container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 24px;
      }

      .cv-section {
        padding: 96px 0;
      }

      .cv-section-soft {
        padding: 96px 0;
        background: var(--cv-surface-soft);
      }

      .cv-section-dark {
        padding: 96px 0;
        background: var(--cv-surface-dark);
        color: var(--cv-on-dark);
      }

      /* ── Typography ────────────────────────────────────────────────────── */
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

      /* ── Buttons ───────────────────────────────────────────────────────── */
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
        transition: background 150ms ease;
        text-decoration: none;
        white-space: nowrap;
      }

      .cv-btn-primary {
        background: var(--cv-primary);
        color: var(--cv-on-primary);
      }

      .cv-btn-primary:active {
        background: var(--cv-primary-active);
      }

      .cv-btn-primary:disabled {
        background: var(--cv-primary-disabled);
        cursor: not-allowed;
      }

      .cv-btn-secondary-light {
        background: var(--cv-surface-strong);
        color: var(--cv-ink);
      }

      .cv-btn-secondary-dark {
        background: var(--cv-surface-dark-elevated);
        color: var(--cv-on-dark);
      }

      .cv-btn-outline-dark {
        background: transparent;
        color: var(--cv-on-dark);
        border: 1px solid rgba(255, 255, 255, 0.3);
      }

      .cv-btn-cta {
        height: 56px;
        padding: 16px 32px;
      }

      .cv-btn-text {
        background: transparent;
        color: var(--cv-primary);
        padding: 12px 8px;
        height: auto;
      }

      /* ── Cards ─────────────────────────────────────────────────────────── */
      .cv-card {
        background: var(--cv-canvas);
        border: 1px solid var(--cv-hairline);
        border-radius: 24px;
        padding: 32px;
      }

      .cv-card-dark {
        background: var(--cv-surface-dark-elevated);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 24px;
        padding: 32px;
        color: var(--cv-on-dark);
      }

      .cv-card:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
      }

      /* ── Badge ─────────────────────────────────────────────────────────── */
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

      /* ── Trading cells ─────────────────────────────────────────────────── */
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

      /* ── Asset row ─────────────────────────────────────────────────────── */
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

      /* ── Navigation ────────────────────────────────────────────────────── */
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
        background: var(--cv-surface-dark);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
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

      /* ── Footer ─────────────────────────────────────────────────────────── */
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

      /* ── Responsive ────────────────────────────────────────────────────── */
      @media (max-width: 640px) {
        .cv-display-mega { font-size: 2.5rem; }
        .cv-section, .cv-section-soft, .cv-section-dark { padding: 48px 0; }
        .cv-card { padding: 20px; border-radius: 16px; }
      }
    `}</style>
  );
}
