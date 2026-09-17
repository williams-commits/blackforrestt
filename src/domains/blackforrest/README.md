# Blackforrest domain package

Domain family for Black Forest Digital (`blackforrestt.com`) — the platform's
primary/default family. Created by the platform architecture; new domains via:

    npm run domain:create -- --key <key> --host <host>

## Identity
- **Key:** `blackforrest` · **Brand:** Black Forest Digital · **Host:** blackforrestt.com
- **Landing design:** `default` (editorial) · **Public design:** `default`

## Layout
| Path | Purpose |
| --- | --- |
| `domain.config.ts` | Manifest — hosts, brand defaults, design selection (selectors only) |
| `content/landing.ts` | Landing content assembly |
| `content/sections.ts` | Section manifest (TOC/anchors) |
| `content/public.ts` | Interior closing-CTA content |
| `navigation.ts` | Navigation + footer chrome content |
| `seo.ts` / `assets.ts` | SEO defaults + asset registry |
| `landing.ts` / `public.ts` / `index.ts` | Barrels (contentLoaders implements DomainContentLoaders) |

## Lifecycle
```
npm run domain:validate -- blackforrest
npm run domain:doctor   -- blackforrest
npm run domain:dev      -- blackforrest
npm run domain:test     -- blackforrest
npm run domain:deploy   -- blackforrest
```

## Rules
- Domain packages import shared platform/contracts only — never another domain.
- Designs receive content via typed props; they never import this package.
- Generated registries are read-only: `npm run registry:generate`.
