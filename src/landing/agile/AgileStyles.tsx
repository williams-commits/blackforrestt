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

      .ag-section { padding-block: 6rem; }
      @media (min-width: 1024px) { .ag-section { padding-block: 8.5rem; } }

      .ag-card {
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.028), rgba(255, 255, 255, 0) 42%), var(--ag-card);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
      }
      .ag-card-hover { transition: border-color 220ms ease, transform 220ms ease, background-color 220ms ease; }
      .ag-card-hover:hover { border-color: rgba(99, 232, 145, 0.38); transform: translateY(-2px); }

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
        font-size: 11.5px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase;
        color: var(--ag-accent);
      }
      /* Hero display scale — the one place the type gets genuinely large. */
      .ag-display {
        font-size: clamp(2.75rem, 5.6vw, 4.75rem);
        font-weight: 800; letter-spacing: -0.032em; line-height: 1.03;
        color: var(--ag-text);
      }
      .ag-h2 {
        font-size: clamp(2rem, 3.3vw, 2.9rem);
        font-weight: 700; letter-spacing: -0.024em; line-height: 1.08; color: var(--ag-text);
      }
      .ag-sub { color: var(--ag-text-2); font-size: 1.125rem; line-height: 1.65; }

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

        The variable remap below is paired with direct scoped rules for the
        token utilities: the utilities then resolve to the Agile palette even
        in browsers/embedded views where custom-property inheritance from a
        mid-tree scope misbehaves. Belt and braces — the palette may never
        leak light-theme values onto the dark canvas.
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
        font-family: var(--font-agile-inter), Inter, -apple-system, "Segoe UI", Roboto, sans-serif;
      }
      /* Direct scoped utility rules — the guaranteed palette layer. */
      .ag-scope .bg-canvas { background-color: #0d100f; }
      .ag-scope .bg-panel { background-color: #151a17; }
      .ag-scope .bg-panel-2 { background-color: #181c1a; }
      .ag-scope .border-border { border-color: rgba(255, 255, 255, 0.12); }
      .ag-scope .border-border-soft { border-color: rgba(255, 255, 255, 0.07); }
      .ag-scope .text-text { color: #f1f3ef; }
      .ag-scope .text-text-muted { color: #a7ada8; }
      .ag-scope .text-text-faint { color: #747a75; }
      .ag-scope .text-brand { color: #63e891; }
      .ag-scope .text-up { color: #63e891; }
      .ag-scope .text-down { color: #ff6b6b; }
      .ag-scope .bg-brand-soft { background-color: rgba(99, 232, 145, 0.12); }
      .ag-scope .border-brand { border-color: rgba(99, 232, 145, 0.5); }
      .ag-scope .border-up\/30 { border-color: rgba(99, 232, 145, 0.3); }
      .ag-scope .bg-up\/10 { background-color: rgba(99, 232, 145, 0.08); }
      /* Variant forms (hover/focus) of the same utilities — the palette must
         hold through interaction states, not just resting states. */
      .ag-scope .hover\:bg-panel:hover,
      .ag-scope .hover\:bg-panel-2:hover { background-color: #1b211d; }
      .ag-scope .hover\:text-text:hover { color: #f1f3ef; }
      .ag-scope .hover\:text-brand:hover { color: #63e891; }
      .ag-scope .focus\:border-brand:focus,
      .ag-scope .focus-visible\:border-brand:focus-visible { border-color: #63e891; }

      /* Filled accent/status surfaces get dark ink — white text fails
         contrast on Agile's bright green/red fills. */
      .ag-scope .bg-brand,
      .ag-scope .bg-up,
      .ag-scope .bg-down {
        color: #0d100f;
      }
      /* Shared token-card patterns (stats bands, fact grids, form cards —
         anything built as "rounded-xl border bg-panel/bg-canvas") take the
         landing's card surface: 12px radius + the soft top-light gradient.
         Applies only inside the Agile scope; the primary brand is untouched. */
      .ag-scope .rounded-xl {
        border-radius: 12px;
        border-color: rgba(255, 255, 255, 0.08);
        background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.028), rgba(255, 255, 255, 0) 42%);
      }
      .ag-scope .rounded-lg { border-color: rgba(255, 255, 255, 0.1); }

      /* Long-form prose in the Agile voice: Inter at a comfortable measure,
         softer body tone than headings for dark-canvas readability. */
      .ag-scope .prose-content {
        font-family: var(--font-agile-inter), Inter, -apple-system, "Segoe UI", Roboto, sans-serif;
        font-size: 15.5px;
        line-height: 1.75;
        color: #c3c9c4;
      }
      .ag-scope .prose-content a { color: #63e891; }
      .ag-scope .prose-content strong,
      .ag-scope .prose-content b { color: #f1f3ef; }
      .ag-scope .marker\:text-brand::marker { color: #63e891; }

      /* Metric numerals (stat bands, hero numbers) render in the landing's
         ledger grammar: large, tight, mint. Only this scale class is used
         for stat numerals inside the content scope. */
      .ag-scope .text-2xl {
        font-size: 2.25rem;
        letter-spacing: -0.02em;
      }

      /* Interior page furniture — header band + closing CTA (see
         AgileArticleLayout / AgileContentShell). */
      .ag-page-band { position: relative; overflow: hidden; }
      .ag-page-cta { border-top: 1px solid rgba(255, 255, 255, 0.1); }

      /* ─── Trading-desk surface system ──────────────────────────────────── */

      /* Mesh gradient — layered radial washes used as section ambience (the
         premium-fintech depth device; replaces flat bands). */
      .ag-mesh {
        background:
          radial-gradient(42% 56% at 12% 8%, rgba(38, 59, 51, 0.55), transparent 68%),
          radial-gradient(36% 48% at 88% 22%, rgba(99, 232, 145, 0.06), transparent 66%),
          radial-gradient(40% 52% at 70% 96%, rgba(38, 59, 51, 0.42), transparent 70%);
      }

      /* Chart gridlines — the terminal's graph-paper texture as section
         ambience; pair with a radial mask so the grid dissolves at the edges. */
      .ag-gridlines {
        background-image:
          linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
        background-size: 44px 44px;
      }

      /* Hairline frame with mint catchlights — the terminal-panel device. */
      .ag-frame {
        position: relative;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 14px;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0) 46%),
          #101412;
        box-shadow: 0 30px 80px -32px rgba(0, 0, 0, 0.9);
      }
      .ag-frame::before,
      .ag-frame::after {
        content: "";
        position: absolute;
        left: 6%;
        right: 6%;
        height: 1px;
        pointer-events: none;
        background: linear-gradient(90deg, transparent, rgba(99, 232, 145, 0.5) 26%, rgba(255, 255, 255, 0.28) 52%, rgba(99, 232, 145, 0.5) 78%, transparent);
      }
      .ag-frame::before { top: 0; }
      .ag-frame::after { bottom: 0; }

      /* Bento grid — asymmetric platform cards. */
      .ag-bento {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      @media (min-width: 1024px) {
        .ag-bento {
          gap: 1.25rem;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          grid-template-areas:
            "terminal terminal execution security"
            "assets   assets   global    global";
        }
        .ag-bento-terminal { grid-area: terminal; }
        .ag-bento-execution { grid-area: execution; }
        .ag-bento-security { grid-area: security; }
        .ag-bento-assets { grid-area: assets; }
        .ag-bento-global { grid-area: global; }
      }
      .ag-bento-cell {
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.028), rgba(255, 255, 255, 0) 44%),
          #121614;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 14px;
        transition: border-color 220ms ease, transform 220ms ease;
      }
      .ag-bento-cell:hover { border-color: rgba(99, 232, 145, 0.35); transform: translateY(-2px); }

      /* Live ticker marquee — infinite horizontal scroll. */
      .ag-ticker {
        position: relative;
        overflow: hidden;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        background: #0a0d0b;
      }
      .ag-ticker::before,
      .ag-ticker::after {
        content: "";
        position: absolute;
        top: 0;
        bottom: 0;
        width: 72px;
        z-index: 1;
        pointer-events: none;
      }
      .ag-ticker::before { left: 0; background: linear-gradient(90deg, #0a0d0b, transparent); }
      .ag-ticker::after { right: 0; background: linear-gradient(270deg, #0a0d0b, transparent); }
      .ag-ticker-track {
        display: flex;
        width: max-content;
        animation: ag-marquee 46s linear infinite;
      }
      .ag-ticker:hover .ag-ticker-track { animation-play-state: paused; }
      .ag-ticker-row {
        display: flex;
        align-items: center;
        padding-block: 0.8rem;
      }
      .ag-ticker-item {
        display: inline-flex;
        align-items: center;
        gap: 0.55rem;
        padding-inline: 1.4rem;
        font-family: var(--font-agile-inter), Inter, sans-serif;
        font-size: 13px;
        font-variant-numeric: tabular-nums;
        color: #f1f3ef;
        border-right: 1px solid rgba(255, 255, 255, 0.07);
        transition: color 150ms ease;
      }
      .ag-ticker-item:hover { color: #63e891; }
      .ag-ticker-item .tnum { color: #a7ada8; }
      @keyframes ag-marquee {
        from { transform: translateX(0); }
        to { transform: translateX(-50%); }
      }
      @media (prefers-reduced-motion: reduce) {
        .ag-ticker-track { animation: none; }
      }

      /* Numbered editorial steps — 01 / 02 / 03. */
      .ag-stepnum {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.18em;
        color: #63e891;
        font-variant-numeric: tabular-nums;
      }

      /* Carousel track — snap scrolling with the scrollbar fully suppressed
         on every engine (the affordance lives in the arrows and dots). */
      .ag-carousel {
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      .ag-carousel::-webkit-scrollbar {
        display: none;
        height: 0;
        width: 0;
      }

      /* Featured bento cell — the deep-green accent surface used to vary
         carousel/bento rhythm against the standard charcoal cells. */
      .ag-cell-accent {
        background:
          radial-gradient(120% 130% at 85% -10%, rgb(23, 27, 25), transparent 55%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0) 46%),
          #1a2a23;
        border-color: rgba(99, 232, 145, 0.22);
      }

      /* Globe animation — data flows along the arcs while the trading-centre
         nodes pulse on staggered beats. Fully disabled for reduced motion. */
      .ag-globe-arc {
        stroke-dasharray: 46 260;
        animation: ag-arcflow 3.4s linear infinite;
      }
      @keyframes ag-arcflow {
        from { stroke-dashoffset: 306; }
        to { stroke-dashoffset: 0; }
      }
      .ag-globe-node {
        animation: ag-nodepulse 2.6s ease-in-out infinite;
        transform-origin: center;
        transform-box: fill-box;
      }
      @keyframes ag-nodepulse {
        0%, 100% { opacity: 0.75; transform: scale(1); }
        45% { opacity: 1; transform: scale(1.28); }
      }
      @media (prefers-reduced-motion: reduce) {
        .ag-globe-arc,
        .ag-globe-node { animation: none; }
        .ag-globe-arc { stroke-dasharray: none; }
      }

      /* Interior numbered sections — CSS counters give every content page's
         sections a 01 / 02 / 03 index with zero API changes. */
      .ag-scope .prose-content { counter-reset: agsec; }
      .ag-scope .prose-content > section { counter-increment: agsec; }
      .ag-scope .prose-content > section > h2::before {
        content: counter(agsec, decimal-leading-zero);
        margin-right: 0.75rem;
        color: #63e891;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
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
