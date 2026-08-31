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

      /* Scroll reveal — disabled entirely for reduced-motion users. */
      .ag-reveal { opacity: 0; transform: translateY(14px); transition: opacity 450ms ease, transform 450ms ease; }
      .ag-reveal.ag-reveal-in { opacity: 1; transform: none; }
      @media (prefers-reduced-motion: reduce) {
        .ag-reveal { opacity: 1; transform: none; transition: none; }
        .ag-card-hover:hover { transform: none; }
        .ag-btn-primary:hover { transform: none; }
      }
    `}</style>
  );
}
