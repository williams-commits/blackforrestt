# __DOMAIN_KEY__ domain package

> Use the platform CLI to create domains. Do not manually copy domain packages.

## Identity
- **Key:** `__DOMAIN_KEY__` · **Host:** `__DOMAIN_HOST__` · **Trade host:** `__TRADE_HOST__`
- **Landing design:** `__LANDING_DESIGN__` · **Public design:** `__PUBLIC_DESIGN__`

## Content locations
| What | Where |
| --- | --- |
| Landing content | `content/landing.ts` (i18n namespace → typed contracts) |
| Public content | `content/public.ts` |
| Navigation/footer | `navigation.ts` |
| SEO defaults | `seo.ts` |
| Assets | `assets.ts` + `public/brands/__DOMAIN_KEY__/` |

## Commands
```
npm run domain:validate -- __DOMAIN_KEY__
npm run domain:doctor   -- __DOMAIN_KEY__
npm run domain:dev      -- __DOMAIN_KEY__
npm run domain:test     -- __DOMAIN_KEY__
npm run domain:deploy   -- __DOMAIN_KEY__
npm run domain:remove   -- __DOMAIN_KEY__ --confirm
```

## Architecture rules
- Domain → shared platform, shared contracts, selected design/content. NEVER Domain A → Domain B.
- Designs receive content via typed props (content = WHAT, design = HOW, domain = WHICH).
- Generated registries are read-only; regenerate with `npm run registry:generate`.

## DO
- Put per-domain copy in `content/` modules; keep presentation in designs.
- Run doctor after every structural change.

## DON'T
- Hardcode domain copy inside design packages.
- Edit generated files under `.generated/`.
- Manually edit Caddy config — `domain deploy` derives it from the manifest.
