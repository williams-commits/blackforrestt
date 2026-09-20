/**
 * Scoped design tokens for the Agile dark-institutional landing template.
 * Rendered once at the template root — every section composes these classes
 * instead of repeating long Tailwind chains, so the palette lives in exactly
 * one place. Deliberately does NOT touch the global token system (the light
 * theme serves the primary brand and all shared shells).
 */
export function GbfxsStyles() {
  return (
    <style>{`
      html:has(.ag-shell),
      body:has(.ag-shell) { margin: 0; }
      .ag-shell,
      .ag-shell *,
      .ag-shell *::before,
      .ag-shell *::after { box-sizing: border-box; }
      .ag-shell {
        min-height: 100vh;
        --ag-bg: #0b0b0d;
        --ag-bg-2: #101013;
        --ag-bg-3: #18181b;
        --ag-card: #1c1c20;
        --ag-yellow-deep: #2a2108;
        --ag-yellow-soft: #3a2d0b;
        --ag-accent: #f0b90b;
        --ag-accent-bright: #f8d56a;
        --ag-text: #eaecef;
        --ag-text-2: #b9b9bd;
        --ag-muted: #85858a;
        --ag-border: rgba(255, 255, 255, 0.12);
        --ag-border-soft: rgba(255, 255, 255, 0.08);
        --ag-focus: 0 0 0 3px rgba(240, 185, 11, 0.28);
        --ag-negative: #f6465d;
        background: var(--ag-bg);
        color: var(--ag-text);
        font-family: var(--cv-inter), -apple-system, system-ui, "Segoe UI", sans-serif;
      }
      .ag-container { margin-inline: auto; width: 100%; max-width: 1280px; padding-inline: 1.25rem; }
      @media (min-width: 1024px) { .ag-container { padding-inline: 2.5rem; } }

      .ag-section { padding-block: 6rem; }
      @media (min-width: 1024px) { .ag-section { padding-block: 8.5rem; } }

      .ag-card {
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.028), rgba(255, 255, 255, 0) 42%), var(--ag-card);
        border: 1px solid var(--ag-border-soft);
        border-radius: 12px;
      }
      .ag-card-hover { transition: border-color 220ms ease, transform 220ms ease, background-color 220ms ease; }
      .ag-card-hover:hover { border-color: rgba(240, 185, 11, 0.48); transform: translateY(-2px); }

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
        background: rgba(19, 19, 22, 0.5);
        backdrop-filter: blur(18px) saturate(1.15);
        -webkit-backdrop-filter: blur(18px) saturate(1.15);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 10px;
      }
      .ag-glass-tile.ag-card-hover:hover { border-color: rgba(240, 185, 11, 0.55); }
      @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
        .ag-glass { background: rgba(19, 19, 22, 0.92); }
        .ag-glass-tile { background: rgba(19, 19, 22, 0.92); }
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
          rgba(240, 185, 11, 0.7) 22%,
          rgba(255, 255, 255, 0.32) 50%,
          rgba(240, 185, 11, 0.7) 78%,
          transparent
        );
      }
      .ag-clip-border::before { top: 0; }
      .ag-clip-border::after { bottom: 0; }

      .ag-btn {
        display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
        border-radius: 6px; padding: 0.75rem 1.75rem;
        /* font-size: 15px; */ font-weight: 600; line-height: 1; cursor: pointer;
        transition: filter 200ms ease, transform 200ms ease, background-color 200ms ease;
        /* min-height: 44px; */
      }
      .ag-btn-primary { background: var(--ag-accent); color: #0d0d0f; }
      .ag-btn-primary:hover { filter: brightness(1.08); transform: translateY(-1px); }
      /* Ink button — the dark counterpart for yellow surfaces, where the
         yellow primary would disappear into the background. */
      .ag-btn-ink { background: #0d0d0f; color: #f1f3ef; }
      .ag-btn-ink:hover { background: #232327; transform: translateY(-1px); }
      .ag-btn-ghost { background: transparent; color: var(--ag-text); border: 1px solid var(--ag-border); }
      .ag-btn-ghost:hover { background: rgba(255, 255, 255, 0.06); }
      .ag-btn:focus-visible,
      .ag-shell a:focus-visible,
      .ag-shell button:focus-visible { outline: none; box-shadow: var(--ag-focus); }

      .ag-eyebrow {
        font-size: 11.5px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase;
        color: var(--ag-accent-bright);
      }
      /* Ink eyebrow — the same type voice for surfaces where the accent IS
         the background (yellow panels/bands); the accent-bright default
         would vanish into it. */
      .ag-eyebrow-ink { color: rgba(13, 13, 15, 0.66); }
      /* Hero display scale — the one place the type gets genuinely large. */
      .ag-display {
        font-size: clamp(2.75rem, 5.6vw, 4.75rem);
        font-weight: 400; letter-spacing: -0.032em; line-height: 1.03;
        color: var(--ag-text);
      }
      .ag-h2 {
        font-size: clamp(2rem, 3.3vw, 2.9rem);
        font-weight: 400; letter-spacing: -0.024em; line-height: 1.08; color: var(--ag-text);
      }
      .ag-sub { color: var(--ag-text-2); font-size: 1.125rem; line-height: 1.65; }
      /* Ink-on-yellow text ramp — overrides for the ag-* voice classes on
         accent-yellow surfaces (declared after them so same-specificity
         source order wins without !important). */
      .ag-ink-h2 { color: #0d0d0f; }
      .ag-ink-sub { color: rgba(13, 13, 15, 0.76); }
      .ag-ink-text { color: rgba(13, 13, 15, 0.84); }
      .ag-ink-faint { color: rgba(13, 13, 15, 0.58); }

      .ag-up { color: #0ecb81; }
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
        --font-mono: var(--cv-mono), "SF Mono", monospace;
        --color-canvas: #0d0d0f;
        --color-panel: #151517;
        --color-panel-2: #1b1b1e;
        --color-panel-3: #232327;
        --color-border: rgba(255, 255, 255, 0.12);
        --color-border-soft: rgba(255, 255, 255, 0.07);
        --color-brand: #f0b90b;
        --color-brand-soft: rgba(240, 185, 11, 0.14);
        --color-text: #f1f3ef;
        --color-text-muted: #a9a9ae;
        --color-text-faint: #75757b;
        --color-up: #0ecb81;
        --color-down: #f6465d;
        --color-surface-dark: #151517;
        --shadow-panel: 0 1px 2px rgba(0, 0, 0, 0.5);
        --shadow-card: 0 18px 44px rgba(0, 0, 0, 0.55);
        /* Agile's typographic voice: geometric sans everywhere — the serif
           editorial voice belongs to the primary brand. */
        --font-sans: var(--cv-inter), -apple-system, system-ui, "Segoe UI", sans-serif;
        --font-serif: var(--cv-inter), -apple-system, system-ui, "Segoe UI", sans-serif;
        font-family: var(--cv-inter), -apple-system, system-ui, "Segoe UI", sans-serif;
      }
      /* Direct scoped utility rules — the guaranteed palette layer. */
      .ag-scope .bg-canvas { background-color: #0d0d0f; }
      .ag-scope .bg-panel { background-color: #151517; }
      .ag-scope .bg-panel-2 { background-color: #1b1b1e; }
      .ag-scope .border-border { border-color: rgba(255, 255, 255, 0.12); }
      .ag-scope .border-border-soft { border-color: rgba(255, 255, 255, 0.07); }
      .ag-scope .text-text { color: #f1f3ef; }
      .ag-scope .text-text-muted { color: #a9a9ae; }
      .ag-scope .text-text-faint { color: #75757b; }
      .ag-scope .text-brand { color: #f0b90b; }
      .ag-scope .text-up { color: #0ecb81; }
      .ag-scope .text-down { color: #ff6b6b; }
      .ag-scope .bg-brand-soft { background-color: rgba(240, 185, 11, 0.14); }
      .ag-scope .border-brand { border-color: rgba(240, 185, 11, 0.55); }
      .ag-scope .border-up\/30 { border-color: rgba(14, 203, 129, 0.3); }
      .ag-scope .bg-up\/10 { background-color: rgba(14, 203, 129, 0.08); }
      /* Variant forms (hover/focus) of the same utilities — the palette must
         hold through interaction states, not just resting states. */
      .ag-scope .hover\:bg-panel:hover,
      .ag-scope .hover\:bg-panel-2:hover { background-color: #222225; }
      .ag-scope .hover\:text-text:hover { color: #f1f3ef; }
      .ag-scope .hover\:text-brand:hover { color: #f0b90b; }
      .ag-scope .focus\:border-brand:focus,
      .ag-scope .focus-visible\:border-brand:focus-visible { border-color: #f0b90b; }

      /* Filled accent/status surfaces get dark ink — white text fails
         contrast on Agile's bright green/red fills. */
      .ag-scope .bg-brand,
      .ag-scope .bg-up,
      .ag-scope .bg-down {
        color: #0d0d0f;
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
        font-family: var(--cv-inter), -apple-system, system-ui, "Segoe UI", sans-serif;
        font-size: 15.5px;
        line-height: 1.75;
        color: #c3c9c4;
      }
      .ag-scope .prose-content a { color: #f0b90b; }
      .ag-scope .prose-content strong,
      .ag-scope .prose-content b { color: #f1f3ef; }
      .ag-scope .marker\:text-brand::marker { color: #f0b90b; }

      /* Metric numerals (stat bands, hero numbers) render in the landing's
        ledger grammar: large and tight. Only this scale class is used
         for stat numerals inside the content scope. */
      .ag-scope .text-2xl {
        font-size: 2.25rem;
        letter-spacing: -0.02em;
      }

      /* Interior page furniture — header band + closing CTA (see
         GbfxsArticleLayout / GbfxsPublicShell). */
      .ag-page-band { position: relative; overflow: hidden; }
      .ag-page-cta { border-top: 1px solid rgba(255, 255, 255, 0.1); }

      /* ─── Trading-desk surface system ──────────────────────────────────── */

      /* Mesh gradient — layered warm-black washes used as section ambience. */
      .ag-mesh {
        background:
          radial-gradient(42% 56% at 12% 8%, rgba(58, 45, 11, 0.5), transparent 68%),
          radial-gradient(36% 48% at 88% 22%, rgba(240, 185, 11, 0.07), transparent 66%),
          radial-gradient(40% 52% at 70% 96%, rgba(42, 33, 8, 0.48), transparent 70%);
      }

      /* Hairline frame with yellow catchlights — the terminal-panel device. */
      .ag-frame {
        position: relative;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 14px;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0) 46%),
          #11100d;
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
        background: linear-gradient(90deg, transparent, rgba(240, 185, 11, 0.58) 26%, rgba(255, 255, 255, 0.28) 52%, rgba(240, 185, 11, 0.58) 78%, transparent);
      }
      .ag-frame::before { top: 0; }
      .ag-frame::after { bottom: 0; }

      /* Bento grid — asymmetric platform cards. */
      .ag-bento {
        display: grid;
        gap: 1rem;
        grid-template-columns: minmax(0, 1fr);
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
          #21201d;
        /* border: 1px solid rgba(255, 255, 255, 0.08); */
        border-radius: 14px;
        transition: border-color 220ms ease, transform 220ms ease;
      }
      .ag-bento-cell:hover { border-color: rgba(240, 185, 11, 0.42); transform: translateY(-2px); }
      @media (max-width: 639px) {
        .ag-bento { gap: 0.75rem; }
        .ag-bento-cell { border-radius: 12px; }
        .ag-bento-cell.p-8 { padding: 1.25rem; }
        .ag-bento-cell.p-7 { padding: 1.125rem; }
        .ag-bento-global { grid-column: auto; }
      }

      /* Numbered editorial steps — 01 / 02 / 03. */
      .ag-stepnum {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.18em;
        color: #f0b90b;
        font-variant-numeric: tabular-nums;
      }
      /* Ink variant for yellow surfaces. */
      .ag-stepnum-ink { color: rgba(13, 13, 15, 0.55); }

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

      /* Featured bento cell — the warm-black accent surface used to vary
         carousel/bento rhythm against the standard charcoal cells. */
      .ag-cell-accent {
        background:
          radial-gradient(120% 130% at 85% -10%, rgb(23, 27, 25), transparent 55%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0) 46%),
          #211b0b;
        border-color: rgba(240, 185, 11, 0.24);
      }

      /* Yellow feature surface — the GBFXS statement panels: solid brand
         yellow with a soft white top-light so large flats still read as a
         lit plane, not a sticker. Pair with the ag-ink-* text ramp and
         ag-btn-ink; dark ink keeps AA contrast on #f0b90b. */
      .ag-cell-yellow {
        background:
          radial-gradient(120% 130% at 85% -10%, rgba(255, 255, 255, 0.28), transparent 58%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.09), rgba(0, 0, 0, 0) 46%),
          #f0b90b;
        border-color: rgba(13, 13, 15, 0.1);
      }
      /* Bento hover keeps the lift but swaps the (invisible-on-yellow) accent
         border for an ink hairline. */
      .ag-bento-cell.ag-cell-yellow:hover { border-color: rgba(13, 13, 15, 0.24); }

      /* Living charts — a short bright segment travels along the smooth
         line (layered as a duplicate of the base path), and the close
         marker breathes. Both are decorative motion only. */
      .ag-chart-live {
        stroke-dasharray: 26 340;
        animation: ag-chart-drift 5.2s linear infinite;
      }
      @keyframes ag-chart-drift {
        from { stroke-dashoffset: 366; }
        to { stroke-dashoffset: 0; }
      }
      .ag-chart-pulse {
        animation: ag-dot-pulse 2.6s ease-in-out infinite;
        transform-box: fill-box;
        transform-origin: center;
      }
      @keyframes ag-dot-pulse {
        0%, 100% { opacity: 0.55; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.5); }
      }

      /* Floating product chips — the real instrument tokens drift over the
         bento terminal chart on organic multi-axis paths (vertical bob +
         lateral sway + a whisper of rotation). Two phase variants with
         different durations keep the field from moving in lockstep; per-chip
         animation-delay staggers entry. */
      .ag-float-a { animation: ag-float-a 6s ease-in-out infinite; }
      .ag-float-b { animation: ag-float-b 7.4s ease-in-out infinite; }
      @keyframes ag-float-a {
        0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); }
        28% { transform: translate3d(2.5px, -9px, 0) rotate(1.6deg); }
        55% { transform: translate3d(-1.5px, -4px, 0) rotate(-0.6deg); }
        80% { transform: translate3d(1px, -7px, 0) rotate(0.9deg); }
      }
      @keyframes ag-float-b {
        0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); }
        32% { transform: translate3d(-3px, -6px, 0) rotate(-1.8deg); }
        60% { transform: translate3d(2px, -11px, 0) rotate(0.7deg); }
        85% { transform: translate3d(-1px, -3px, 0) rotate(-0.4deg); }
      }
      /* Chip entrance —fade+rise once on mount, then the drift loop runs. */
      .ag-float-a, .ag-float-b { will-change: transform; }

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
        color: #f0b90b;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }

      /* Reduced motion — hovers/transitions only; scroll reveals are handled
         globally by the .reveal utilities in globals.css. */
      @media (prefers-reduced-motion: reduce) {
        .ag-card-hover:hover { transform: none; }
        .ag-btn-primary:hover { transform: none; }
        .ag-float-a, .ag-float-b { animation: none; }
        .ag-chart-live, .ag-chart-pulse { animation: none; }
        .ag-chart-live { stroke-dasharray: none; }
      }
    `}</style>
  );
}
