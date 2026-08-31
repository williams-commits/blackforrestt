# Per-brand landing trees

Each brand family owns its landing page **outright** in its own folder — its
own sections, components, styles and visual system — as if it were a separate
site hosted on the same server. Brands never import each other's files.

```
src/app/page.tsx                ← thin host dispatcher (landingTemplate switch)
src/app/(content)/layout.tsx    ← thin host dispatcher for interior pages
src/landing/
  blackforest/                  ← Black Forest Digital (blackforrestt.com)
    BlackForestLanding.tsx      ← composition only — sections come from the
                                    shared library in src/components/landing/*
  agile/                        ← Agile FGS (agilefgs.com)
    AgileLanding.tsx            ← composition
    AgileContentShell.tsx       ← interior-page chrome (navbar+footer+scope)
    AgileNavbar / AgileFooter / AgileStyles / Reveal / LivePricePanel /
    SectionBackdrop / sections/ ← fully brand-owned dark-institutional system
```

## What is shared (the "library")

Anything that is not a landing's visual identity stays shared and brand-aware:

- `src/components/**` — shared UI + the landing library
  (`Navbar`, `Footer`, `Hero`, `Markets`, `TradingPlayground`, …) used by the
  Black Forest landing, plus the brand-neutral primitives every tree consumes:
  - `useInstruments.ts` — the one live-instruments polling hook (all landing
    islands get their feed through it; brand trees never re-implement polling)
  - `Reveal.tsx` — scroll-reveal motion primitive (CSS lives in globals.css
    as `.reveal` / `.reveal-in`, reduced-motion safe)
  - `MarketIcons`, `ContactForm`, `ArticleLayout`, `InformersWidget`, …
- `src/lib/**`, `src/server/**` — branding, i18n, engine, payments, ledger…
- `src/messages/**` — catalogs (`agile.*` namespace serves the Agile landing)
- Backend resources — one database, Redis, dashboard (`/account`, `/trade`),
  admin console, APIs

## Interior (content) pages

The `(content)` routes (about, contact, tools, analytics, education, legal)
have **shared page bodies** (they are built exclusively from the global design
tokens) but **brand-owned chrome**: the layout dispatches on
`landingTemplate` exactly like the landing dispatcher. The primary brand gets
the light editorial `Navbar` + `Footer`; Agile gets `AgileContentShell`.

Agile's reskin works by token scope, not duplication: `AgileStyles` defines an
`.ag-scope` class that remaps the global `--color-*` / `--font-*` variables to
Agile's dark-institutional palette inside its subtree. Every shared component
underneath re-skins automatically — no product conditionals anywhere, and the
primary brand's root (light) tokens are untouched.

## Rules

1. **No cross-brand imports.** `src/landing/agile/**` must not import from
   `src/landing/blackforest/**` and vice versa.
2. **Landing folders import shared code, never the reverse.** App routes and
   shared components must not import from `src/landing/**` — only the host
   dispatchers (`src/app/page.tsx` and `src/app/(content)/layout.tsx`) do.
3. **Adding a brand** = new folder under `src/landing/<brand>/` + a
   `landingTemplate` key in `BRAND_OVERRIDES` + a case in both dispatchers.
4. **Shared visuals** live in `public/brands/<brand>/` — each brand's assets
   (e.g. `public/brands/agilefgs/backgrounds/`) belong to that brand only.
5. **Shared components stay generic.** A component in `src/components/**`
   must never branch on brand/product. Brand identity enters through tokens
   (scoped CSS variables), the brand profile, and brand-owned composition.
