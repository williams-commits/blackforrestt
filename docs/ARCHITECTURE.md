# Platform Architecture

ONE repository → MANY domains → ONE shared platform. Everything below is
enforced by tests (`npm run test:domains`, `tests/platform-deploy.test.ts`,
`tests/registry-freshness.test.ts`).

```
                ONE REPOSITORY — SHARED PLATFORM
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
   PLATFORM CORE            CONTENT SYSTEM           DESIGN SYSTEM
   src/server/**            src/content/contracts.ts src/designs/<key>/
   src/app/api/**           (typed, WHAT)            (landing/ + public/, HOW)
   prisma/ (ONE db)              │                        │
   src/auth.ts                   └──────────┬─────────────┘
   src/components/**                        │
   src/platform/ ◄── RENDERING/RESOLUTION LAYER
   (registry: host→domain; render: domain+content+design = page)
        │                        │
   ┌────┴─────┐            src/domains/<key>/  ◄── DOMAIN LAYER
   Trading      CRM           domain.config.ts (WHICH — manifest, selectors only)
   (shared)   (crm/, own     content/ navigation/ seo/ assets/
              database)      .generated/ (read-only registries)
```

## The five concerns (strictly separated)

| Concern | Location | Rule |
| --- | --- | --- |
| **DOMAIN CONFIG** | `src/domains/<key>/domain.config.ts` | Selects content, landing design, public design, navigation, SEO, assets. NEVER contains implementations. |
| **CONTENT** | `src/domains/<key>/content*/` + `src/content/contracts.ts` | WHAT is shown. Typed contracts; no JSX in the content layer. |
| **DESIGN** | `src/designs/<key>/{landing,public}/` | HOW it is shown. Receives content via typed props; NEVER imports domain implementations. |
| **PUBLIC DESIGN** | `src/designs/<key>/public/` | Independent from landing — a domain may mix `landingDesign: "gbfxs", publicDesign: "default"`. |
| **RENDERING** | `src/platform/` | The only runtime glue: `registry.ts` (host→domain), `render/landing.tsx`, `render/public.tsx`, `composition.tsx`. |

## Host resolution — ONE authoritative module

`src/platform/registry.ts` (`resolveHostContext`) answers every
"which domain/brand/design is this host?" question. Consumers: middleware,
branding, next.config CSP. Domain manifests come from the GENERATED registry
(`src/domains/.generated/domains.ts` — a read-only scan of
`src/domains/<key>/domain.config.ts`).

**Layering (env wins):** `BRAND_OVERRIDES[apex]` → manifest defaults → primary env.

## Generated registries (read-only artifacts)

```
src/domains/.generated/domains.ts    domain manifest list (middleware/CSP-safe)
src/domains/.generated/content.ts    domain key → lazy content loaders
src/designs/.generated/designs.ts    design key → lazy design manifests
```

Every file carries `GENERATED FILE — DO NOT EDIT / SOURCE / REGENERATE`
headers. `npm run registry:generate` owns them; CI freshness tests fail on
drift. Adding a domain or design requires ZERO manual registry edits.

## Domain CLI (canonical onboarding)

```bash
npm run platform -- domain create|validate|doctor|dev|test|deploy|remove
```

See **docs/domains/ADDING_A_DOMAIN.md** for the complete lifecycle.
`create` is transactional; `deploy` writes ONLY the selected domain's Caddy
site file (others preserved — acceptance-tested); `remove` is safe
(dependency graph + `--confirm`).

## Dependency direction (enforced)

```
Domain   → shared platform, shared contracts, selected design/content
Design   → shared contracts ONLY (content via typed props)
Platform → resolves domain + content + design (never imports designs' internals
           beyond manifests)
Shared   → NEVER imports domain-specific code
Domain A → NEVER imports Domain B
Backend  → NEVER imports landing/public implementations
```

## Deployment model

- Manifests are the source of truth for hosts + trade hosts — no numbered
  env slots (repo-wide grep gate).
- `deploy/caddy/render/sites/<key>.caddy` = per-domain deployment state;
  `Caddyfile` (merged, gitignored) is generated.
- `domain deploy <key>` touches only that domain's file.
- Optional `DEPLOY_DOMAINS` scopes a deployment to selected registry domains.

## CRM boundary (verified, not assumed)

CRM (`crm/`) is a separate Next.js application with its own Prisma schema and
its own database (`blckforest_crm`). The trading platform uses `blackforrestt`.
They share only the same Postgres server and an HTTP bridge
(`/api/internal/crm/*`, read-only). CRM was NOT touched by this migration.

## AI onboarding

READ `.platform/README.md` → relevant rules/skills/lessons → inspect actual
code → trace dependencies → **USE THE PLATFORM CLI** → implement → validate
(`domain validate` + `doctor`) → test → update the harness when architecture
changes. Never invent a parallel architecture.
