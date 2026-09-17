# GBFXS domain package

Domain family for Global Forex Services (`gbfxs.com`). Created by the
platform architecture — do NOT manually copy domain packages; use:

    npm run domain:create -- --key <key> --host <host>

## Identity
- **Key:** `gbfxs` · **Brand:** Global Forex Services · **Host:** gbfxs.com
- **Landing design:** `gbfxs` (dark institutional) · **Public design:** `gbfxs`

## Layout
| Path | Purpose |
| --- | --- |
| `domain.config.ts` | Manifest — hosts, brand defaults, design selection (selectors only) |
| `content/landing.ts` | Landing content assembly (i18n catalogs → typed contracts) |
| `content/public.ts` | Interior closing-CTA content |
| `navigation.ts` | Navigation + footer chrome content |
| `seo.ts` / `assets.ts` | SEO defaults + asset registry |
| `landing.ts` / `public.ts` / `index.ts` | Barrels (contentLoaders implements DomainContentLoaders) |

## Lifecycle
```
npm run domain:validate -- gbfxs
npm run domain:doctor   -- gbfxs
npm run domain:dev      -- gbfxs
npm run domain:test     -- gbfxs
npm run domain:deploy   -- gbfxs
```

## Rules
- Domain packages import shared platform/contracts only — never another domain.
- Designs receive content via typed props; they never import this package.
- Generated registries are read-only: `npm run registry:generate`.
