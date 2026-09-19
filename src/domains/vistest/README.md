# vistest domain package

> Use the platform CLI to create domains. Do not manually copy domain packages.

## Identity
- **Key:** `vistest` · **Host:** `vistest.localhost` · **Trade host:** `trade.vistest.localhost`
- **Landing design:** `convertio` · **Public design:** `convertio`

## Content locations
| What | Where |
| --- | --- |
| Landing content | `content/landing.ts` (i18n namespace → typed contracts) |
| Public content | `content/public.ts` |
| Navigation/footer | `navigation.ts` |
| SEO defaults | `seo.ts` |
| Assets | `assets.ts` + `public/brands/vistest/` |

## Commands
```
npm run domain:validate -- vistest
npm run domain:doctor   -- vistest
npm run domain:dev      -- vistest
npm run domain:test     -- vistest
npm run domain:deploy   -- vistest
npm run domain:remove   -- vistest --confirm
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
