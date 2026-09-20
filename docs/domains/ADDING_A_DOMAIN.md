# Adding a Domain

The canonical onboarding method is the **platform CLI**. Manual copying of
domain packages is NOT the workflow.

> If adding a new domain requires manually editing multiple unrelated central
> files, the architecture is considered broken.

## The complete lifecycle

```bash
# 1. Create (transactional — rolls back everything on any failure)
npm run platform -- domain create \
  --key=example \
  --host=example.com \
  --trade-host=trade.example.com \
  --design=default \
  --public-design=default

# 2. Edit content (the generated README inside the package explains every file)
#    src/domains/example/content/…  navigation.ts  seo.ts  assets.ts

# 3. Select/create designs (see "Custom designs" below — optional)

# 4. Add assets
#    public/brands/example/og.png …

# 5. Validate
npm run domain:validate -- example

# 6. Diagnose (full health check)
npm run domain:doctor -- example

# 7. Develop locally
npm run domain:dev -- example
#    → visit http://example.localhost:3000 (Chromium/macOS resolve *.localhost)

# 8. Test
npm run domain:test -- example

# 9. Deploy ONLY this domain
npm run domain:deploy -- example          # --dry-run to preview first
npm run domain:deploy -- example --apply  # ON the deployment host: recreates
#                                          caddy + live health-checks the apex

# 10. Remove (safe — refuses while references remain; --confirm required)
npm run domain:remove -- example --confirm
```

## What you NEVER do

- No manual edits to `src/domains/.generated/` or `src/designs/.generated/`
  (read-only; `npm run registry:generate` owns them).
- No numbered environment slots (`DOMAIN_2`, `TRADE_DOMAIN_3`…). Domains are
  data-driven manifests.
- No manual Caddy configuration — `domain deploy` derives routing from the
  manifest (per-domain site files under `deploy/caddy/render/sites/`).
- No copying the application, CRM, backend, or trading stack.
- No cross-domain imports (`example` must never import `gbfxs`).

## Reusable designs (shipped)

Designs are platform-level and reusable by ANY domain — selecting one is a
manifest line, not a fork:

| Design | Look | Fonts | Accent |
| --- | --- | --- | --- |
| `default` | Black Forest trading platform baseline | Inter + JetBrains Mono | platform default |
| `gbfxs` | Global Forex Services — dark, dense, market-first | Inter + JetBrains Mono (shared with convertio) | `#f0b90b` |
| `convertio` | Coinbase-inspired: dark hero with floating product-UI mockups, editorial bands, pill CTAs, high-conversion light interior pages | Inter (display + body) + JetBrains Mono (numbers) | `#0052ff` |

Use one: `npm run platform -- domain create --key=acme --host=acme.com
--design=convertio --public-design=convertio` — or set
`landingDesign`/`publicDesign` in an existing manifest and regenerate. Mix
freely (`landingDesign: "convertio", publicDesign: "default"`).

## Custom designs (optional)

A domain may mix designs independently — `landingDesign: "gbfxs",
publicDesign: "default"` needs zero hacks. To build a custom design:

1. `cp -R src/designs/_template src/designs/<key>` (or use the domain CLI with
   `--design=<key>` after the design exists).
2. Implement `landing/` and `public/` components — they receive typed content
   props only (`LandingDesignProps` / `PublicDesignProps` in
   `src/designs/contracts.ts`); NEVER import a domain's content implementation.
3. Run `npm run registry:generate` — the design registers automatically.

## Deployment model

- Domain manifests (`domain.config.ts`) are the source of truth for hosts and
  trade hosts.
- `deploy/caddy/render/sites/<key>.caddy` = per-domain deployment state;
  deploying one domain never touches another (acceptance-tested in both
  directions by `tests/platform-deploy.test.ts`).
- The merged `deploy/caddy/render/Caddyfile` is a generated artifact
  (gitignored) — never hand-edited.
- Optional `DEPLOY_DOMAINS=key1,key2` env scopes a deployment to those
  registry domains.

## Architecture rules (enforced by tests)

| Rule | Enforced by |
| --- | --- |
| Domain ↛ Domain | `tests/domains.test.ts` cross-import scan |
| Design ↛ Domain content | dependency-direction tests |
| Shared ↛ Domain-specific | dependency-direction tests |
| Generated files fresh | `tests/registry-freshness.test.ts` (CI fails on drift) |
| No numbered slots | `tests/platform-deploy.test.ts` repo-wide grep |
| Deploy preserves others | `tests/platform-deploy.test.ts` both directions |
| Branding isolation | `domain validate` + `domain doctor` leakage scans |
