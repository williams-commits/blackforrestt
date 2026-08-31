/**
 * Scoped design tokens for the Agile dark-institutional landing template.
 * Rendered once at the template root — every section composes these classes
 * instead of repeating long Tailwind chains, so the palette lives in exactly
 * one place. Deliberately does NOT touch the global token system (the light
 * theme serves the primary brand and all shared shells).
 */
export function AgileStyles() {
  return (
    <style>{`
      .ag-shell {
        --ag-bg: #0d100f;
        --ag-bg-2: #111513;
        --ag-bg-3: #181c1a;
        --ag-card: #151a17;
        --ag-green: #263b33;
        --ag-green-2: #2d463b;
        --ag-accent: #63e891;
        --ag-accent-2: #4fd17a;
        --ag-text: #f1f3ef;
        --ag-text-2: #a7ada8;
        --ag-muted: #747a75;
        --ag-border: rgba(255, 255, 255, 0.12);
        --ag-negative: #ff6b6b;
        background: var(--ag-bg);
        color: var(--ag-text);
        font-family: var(--font-agile-inter), Inter, -apple-system, "Segoe UI", Roboto, sans-serif;
      }
      .ag-container { margin-inline: auto; width: 100%; max-width: 1280px; padding-inline: 1.25rem; }
      @media (min-width: 1024px) { .ag-container { padding-inline: 2.5rem; } }

      .ag-section { padding-block: 5rem; }
      @media (min-width: 1024px) { .ag-section { padding-block: 7rem; } }

      .ag-card {
        background: var(--ag-card);
        border: 1px solid var(--ag-border);
        border-radius: 10px;
      }
      .ag-card-hover { transition: border-color 200ms ease, transform 200ms ease, background-color 200ms ease; }
      .ag-card-hover:hover { border-color: rgba(99, 232, 145, 0.45); transform: translateY(-2px); }

      /* Frosted glass over the photo bands: used for panels/tiles that float
         on SectionBackdrop plates. Solid fallback where backdrop-filter is
         unsupported so text never sits on raw imagery. */
      .ag-glass {
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.02) 38%, rgba(0, 0, 0, 0.12));
        backdrop-filter: blur(24px) saturate(1.25);
        -webkit-backdrop-filter: blur(24px) saturate(1.25);
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 12px;
        box-shadow: 0 24px 60px -28px rgba(0, 0, 0, 0.85);
      }
      .ag-glass-tile {
        background: rgba(17, 21, 19, 0.5);
        backdrop-filter: blur(18px) saturate(1.15);
        -webkit-backdrop-filter: blur(18px) saturate(1.15);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 10px;
      }
      .ag-glass-tile.ag-card-hover:hover { border-color: rgba(99, 232, 145, 0.5); }
      @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
        .ag-glass { background: rgba(17, 21, 19, 0.92); }
        .ag-glass-tile { background: rgba(17, 21, 19, 0.92); }
      }

      /* Clipped accent border — replaces the panel's full hairline with two
         framing lines that fade out at each end (viewfinder aesthetic).
         Deliberately ordered after .ag-glass so it neutralizes its border. */
      .ag-clip-border { border-color: transparent; }
      .ag-clip-border::before,
      .ag-clip-border::after {
        content: "";
        position: absolute;
        left: 9%;
        right: 9%;
        height: 1px;
        pointer-events: none;
        background: linear-gradient(
          90deg,
          transparent,
          rgba(99, 232, 145, 0.6) 22%,
          rgba(255, 255, 255, 0.32) 50%,
          rgba(99, 232, 145, 0.6) 78%,
          transparent
        );
      }
      .ag-clip-border::before { top: 0; }
      .ag-clip-border::after { bottom: 0; }

      .ag-btn {
        display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
        border-radius: 8px; padding: 0.75rem 1.75rem;
        font-size: 15px; font-weight: 600; line-height: 1; cursor: pointer;
        transition: filter 200ms ease, transform 200ms ease, background-color 200ms ease;
        min-height: 44px;
      }
      .ag-btn-primary { background: var(--ag-accent); color: #0d100f; }
      .ag-btn-primary:hover { filter: brightness(1.08); transform: translateY(-1px); }
      .ag-btn-ghost { background: transparent; color: var(--ag-text); border: 1px solid var(--ag-border); }
      .ag-btn-ghost:hover { background: rgba(255, 255, 255, 0.06); }

      .ag-eyebrow {
        font-size: 12px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase;
        color: var(--ag-accent);
      }
      .ag-h2 { font-size: 1.875rem; font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; color: var(--ag-text); }
      @media (min-width: 1024px) { .ag-h2 { font-size: 2.75rem; } }
      .ag-sub { color: var(--ag-text-2); font-size: 1.075rem; line-height: 1.65; }

      .ag-up { color: var(--ag-accent); }
      .ag-down { color: var(--ag-negative); }

      /*
        Content-page scope — Agile's dark-institutional reskin of the SHARED
        design tokens. Shared content components (ArticleLayout, ContactForm,
        tables, …) are built exclusively on the global --color-*/--font-*
        tokens; remapping those variables inside this scope re-skins every
        content page for the Agile brand with zero product conditionals and
        zero duplicated components. Blackforrest keeps the root (light) token
        values — the two identities never touch.
      */
      .ag-scope {
        --color-canvas: #0d100f;
        --color-panel: #151a17;
        --color-panel-2: #181c1a;
        --color-panel-3: #1f2421;
        --color-border: rgba(255, 255, 255, 0.12);
        --color-border-soft: rgba(255, 255, 255, 0.07);
        --color-brand: #63e891;
        --color-brand-soft: rgba(99, 232, 145, 0.12);
        --color-text: #f1f3ef;
        --color-text-muted: #a7ada8;
        --color-text-faint: #747a75;
        --color-up: #63e891;
        --color-down: #ff6b6b;
        --color-surface-dark: #15181a;
        --shadow-panel: 0 1px 2px rgba(0, 0, 0, 0.5);
        --shadow-card: 0 18px 44px rgba(0, 0, 0, 0.55);
        /* Agile's typographic voice: geometric sans everywhere — the serif
           editorial voice belongs to the primary brand. */
        --font-sans: var(--font-agile-inter), Inter, -apple-system, "Segoe UI", Roboto, sans-serif;
        --font-serif: var(--font-agile-inter), Inter, -apple-system, "Segoe UI", Roboto, sans-serif;
      }
      /* Filled accent/status surfaces get dark ink — white text fails
         contrast on Agile's bright green/red fills. */
      .ag-scope .bg-brand,
      .ag-scope .bg-up,
      .ag-scope .bg-down {
        color: #0d100f;
      }

      /* Reduced motion — hovers/transitions only; scroll reveals are handled
         globally by the .reveal utilities in globals.css. */
      @media (prefers-reduced-motion: reduce) {
        .ag-card-hover:hover { transform: none; }
        .ag-btn-primary:hover { transform: none; }
      }
    `}</style>
  );
}
