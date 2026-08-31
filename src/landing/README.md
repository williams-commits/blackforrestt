# Per-brand landing trees

Each brand family owns its landing page **outright** in its own folder — its
own sections, components, styles and visual system — as if it were a separate
site hosted on the same server. Brands never import each other's files.

```
src/app/page.tsx                ← thin host dispatcher (landingTemplate switch)
src/landing/
  blackforest/                  ← Black Forest Digital (blackforrestt.com)
    BlackForestLanding.tsx      ← composition only — sections come from the
                                    shared library in src/components/landing/*
  agile/                        ← Agile FGS (agilefgs.com)
    AgileLanding.tsx            ← composition
    AgileNavbar / AgileFooter / AgileStyles / Reveal / LivePricePanel /
    SectionBackdrop / sections/ ← fully brand-owned dark-institutional system
```

## What is shared (the "library")

Anything that is not a landing's visual identity stays shared and brand-aware:

- `src/components/**` — shared UI + the original landing library
  (`Navbar`, `Footer`, `Hero`, `Markets`, `TradingPlayground`, …) used by the
  Black Forest landing and the content pages of **all** brands
- `src/lib/**`, `src/server/**` — branding, i18n, engine, payments, ledger…
- `src/messages/**` — catalogs (`agile.*` namespace serves the Agile landing)
- Backend resources — one database, Redis, dashboard (`/account`, `/trade`),
  admin console, APIs

## Rules

1. **No cross-brand imports.** `src/landing/agile/**` must not import from
   `src/landing/blackforest/**` and vice versa.
2. **Landing folders import shared code, never the reverse.** App routes and
   shared components must not import from `src/landing/**` — only
   `src/app/page.tsx` (the dispatcher) does.
3. **Adding a brand** = new folder under `src/landing/<brand>/` + a
   `landingTemplate` key in `BRAND_OVERRIDES` + a case in the dispatcher.
4. **Shared visuals** live in `public/brands/<brand>/` — each brand's assets
   (e.g. `public/brands/agilefgs/backgrounds/`) belong to that brand only.
