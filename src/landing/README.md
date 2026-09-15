# Per-design landing trees + the design registry

```
src/app/page.tsx                ← thin host dispatcher (design registry)
src/app/(content)/layout.tsx    ← thin host dispatcher for public shells
src/landing/
  designKeys.ts                 ← design key registry (pure data, test-safe)
  designs.ts                    ← key → component mappings (landing + public
                                   shells); TypeScript enforces key coverage
  composition.tsx               ← client-side public-design dispatcher
                                   (ArticleLayout/Section architecture)
  blackforest/                  ← DEFAULT design (Black Forest Digital)
    BlackForestLanding.tsx      ← composition; sections from the shared
                                   library in src/components/landing/*
    DefaultPublicShell.tsx      ← Navbar+Footer shell for (content) routes
  agile/                        ← CUSTOM design exemplar (Global Forex
                                   Services): brand-owned dark-institutional
                                   system that consumes the agile domain's
                                   typed content contracts
src/domains/<key>/              ← domain configs + typed content assembly
src/content/contracts.ts        ← the typed content models both consume
```

A landing page is CONTENT + DESIGN + PAGE COMPOSITION:

- **Content** — typed contracts (`src/content/contracts.ts`), assembled per
  domain by `src/domains/<key>/content.ts` from the i18n catalogs + brand
  profile. Locale-aware, presentation-free.
- **Design** — the trees in this folder. The agile tree receives typed
  content as props and never calls next-intl itself (enforced by
  `npm run test:domains`). The default tree's shared-library sections still
  resolve catalogs directly (documented incremental debt — see
  `src/content/README.md`).
- **Composition** — each design owns its section ordering and architecture;
  designs are never required to render every section a contract describes.

## What is shared (the platform library)

Anything that is not a landing's visual identity stays shared and design-aware:

- `src/components/**` — shared UI + the landing section library used by the
  default design, plus the brand-neutral primitives every tree consumes:
  - `useInstruments.ts` — the one live-instruments polling hook
  - `Reveal.tsx` — scroll-reveal motion primitive (`.reveal` / `.reveal-in`)
  - `MarketIcons`, `ContactForm`, `ArticleLayout`, `InformersWidget`, …
- `src/lib/**`, `src/server/**`, `src/domains/registry.ts` — branding, host
  resolution, engine, payments, ledger…
- `src/messages/**` — the i18n catalogs (content STORAGE; access flows
  through the domain content packages)
- Backend resources — one database, Redis, dashboard (`/account`, `/trade`),
  admin console, APIs

## Interior (public) pages

The `(content)` routes (about, contact, tools, analytics, education, legal)
have **shared page bodies** with **design-owned presentation at two layers**:

1. **Shell** — the `(content)` layout resolves the domain's `publicDesign`
   and renders the registered shell (default: light editorial Navbar+Footer;
   agile: `AgileContentShell` — own navbar/footer, Inter, scoped tokens).
2. **Architecture** — pages compose through `src/landing/composition.tsx`
   (`ArticleLayout` / `Section`), which dispatches on the brand context's
   `publicDesign`. Page files import from the dispatcher, never a design.

The agile reskin works by token scope, not duplication: `AgileStyles` defines
an `.ag-scope` class remapping the global `--color-*` / `--font-*` variables
inside its subtree, so shared components re-skin automatically.

## Rules (enforced by tests/domains.test.ts)

1. **No cross-design imports.** `src/landing/agile/**` must not import from
   `src/landing/blackforest/**` and vice versa.
2. **Route through the registry.** App routes import `@/landing/designs`
   (host dispatchers) or `@/landing/composition` — never a design tree
   directly. (Embeddable surfaces use the shared, self-styled
   `@/components/landing/TickerStrip`.)
3. **Adding a design** = new folder under `src/landing/<design>/` + key in
   `designKeys.ts` + components in `designs.ts`.
4. **Adding a domain** = copy `src/domains/_template/`, register in
   `src/domains/registry.ts`, select existing or new designs. See
   `.platform/workflows/new-domain.md`.
5. **Design assets** live in `public/brands/<domain>/`.
6. **Shared components stay generic.** A component in `src/components/**`
   must never branch on brand/product — identity enters through tokens, the
   brand profile, and design-owned composition.
