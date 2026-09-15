# Platform Architecture

The repository is ONE platform serving MULTIPLE brand domains. Everything
below is enforced by `npm run test:domains` (`tests/domains.test.ts`).

```
                    ONE REPOSITORY — SHARED PLATFORM
                                 │
            ┌────────────────────┴────────────────────┐
            │                                         │
       PLATFORM CORE                              DOMAIN LAYER
            │                                         │
   src/server/**  (engine, ws, email)         src/domains/<key>/
   src/app/api/** (APIs)                        ├── domain.config.ts
   prisma/         (ONE database)               └── content.ts
   src/auth.ts     (ONE auth)                 src/content/ (contracts)
   src/components  (shared UI)                src/landing/<design>/ (designs)
   crm/            (CRM app, own DB)
            │
      ┌─────┴─────┐
   Trading      CRM … every domain shares both + the same backend
```

## The four layers

| Layer | Location | Rule |
|---|---|---|
| **Platform core** | `src/server/**`, `src/app/api/**`, `prisma/`, `src/auth.ts`, `src/lib/**`, `src/components/ui/**`, `crm/` | Domain-neutral. Never imports designs or domain packages. |
| **Content library** | `src/content/contracts.ts` | Presentation-free typed content models. No JSX, no i18n imports. |
| **Domain layer** | `src/domains/<key>/` | ONE explicit configuration per brand family (`domain.config.ts`: hosts, designs, brand defaults, features) + its typed content assembly (`content.ts`). |
| **Design layer** | `src/landing/<design>/` + `src/landing/designs.ts` | Renders typed content contracts. Composable per-section; never fetches translations itself (agile tree is the enforced exemplar). |

## Host resolution — ONE authoritative module

`src/domains/registry.ts` (zero-dependency) answers every
"which domain/brand/design is this host?" question:

```
resolveHostContext(host, env) → { apex, domain, landingDesign, publicDesign }
```

Consumers: `src/middleware.ts` (domain routing + cookies),
`src/lib/branding.ts` (brand profiles), `next.config.ts` (CSP origins),
`src/domains/resolve.ts` (server request entry). Never re-implement host
matching — extend the registry.

**Configuration layering (env wins):**

1. `BRAND_OVERRIDES[apex]` — per-deployment values (operational surface)
2. Registry code defaults — `src/domains/<key>/domain.config.ts`
3. Primary env defaults (`BRAND_NAME`, `COMPANY_*`, …)

Special case: when a `BRAND_OVERRIDES` entry EXISTS for an apex, its
`tradeEnabled` flag is authoritative even when absent (absent = not enabled —
conservative routing; see `.platform/lessons/`).

**Trade-host resolution order:** `DOMAIN_N/TRADE_DOMAIN_N` env pairs (what
Caddy serves) → `tradeEnabled` (env flag, else registry default) → canonical
trade host of the first domain.

## Design system

- Design keys live in `src/landing/designKeys.ts`; component mappings in
  `src/landing/designs.ts` (TypeScript enforces every key has a component).
- `landingDesign` renders the apex `/` page; `publicDesign` renders the
  `(content)` route-group shell + interior architecture
  (`src/landing/composition.tsx` is its client-side mirror).
- A design consumes its domain's typed content (`src/domains/<key>/content.ts`
  assembles `src/content/contracts.ts` objects from the i18n catalogs + brand
  profile). Same content model, different visual implementation.
- Default design: `src/landing/blackforest/` (shared library composition).
  Custom design exemplar: `src/landing/agile/`.

## Adding a domain (summary)

Copy `src/domains/_template/` → implement config + content → select/register
designs → register in `src/domains/registry.ts` → assets under
`public/brands/<key>/` → deployment env (`DOMAIN_N`, `TRADE_DOMAIN_N`,
`BRAND_DOMAINS`, optional `BRAND_OVERRIDES`) → `npm run test:domains` →
browser-verify host isolation. Full walkthrough:
`.platform/workflows/new-domain.md`. No new backend, database, auth, CRM, or
trading copy is ever created.

## Deployment model (unchanged operationally)

Caddy (rendered from env by `deploy/render-caddy.sh`) routes each family's
apex + trade host to the SAME app container; CRM on `CRM_DOMAIN`. Adding a
domain is env + registry — no Docker/Caddy duplication. The custom server
loads `next.config.ts` (and thus the registry) at boot, so brand env changes
need only a restart (`make update`).
