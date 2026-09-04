# CRM module — deployment & operations runbook

The CRM is a self-contained Next.js application with its own database,
deployed as a sibling container to the trading platform and served on its
own subdomain (`crm.<domain>`) through the platform's existing Caddy edge.

## Architecture in production

```
Caddy (edge, TLS)  ── crm.<domain> ──▶ crm:3000   (CRM standalone image)
                   ── <domains>     ──▶ app:3000   (trading platform)
crm container ── read-only bridge ──▶ app:3000    (/api/internal/crm/*)
both          ──▶ postgres (databases: blackforrestt, blckforest_crm)
```

## Environment

CRM-side variables (compose passes them; see `deploy/.env.production.example`):

| Variable | Purpose |
| --- | --- |
| `CRM_DOMAIN` | Subdomain Caddy serves (e.g. `crm.blackforrestt.com`). Empty = CRM not exposed. |
| `CRM_DATABASE_URL` | Postgres URL for the `blckforest_crm` database (own DB, never shared). |
| `AUTH_URL_CRM` | `https://crm.<domain>` — Auth.js origin. |
| `AUTH_SECRET_CRM` | **Distinct** secret from the platform's `AUTH_SECRET`. |
| `CRM_BRIDGE_TOKEN` | Shared secret for the read-only platform bridge (same value in both apps). |
| `CRM_IMAGE` | Image tag override (defaults to `blckforest-crm:latest`). |

## First-time setup

1. Create the database on the platform's postgres:
   `docker compose exec postgres psql -U blackforrestt -d postgres -c 'CREATE DATABASE blckforest_crm OWNER blackforrestt;'`
2. Set the env variables above (generate secrets with `openssl rand -hex 32`).
3. Build and start: `deploy/deploy.sh` (renders Caddy with the CRM block) or
   `docker compose -f deploy/docker-compose.prod.yml up -d --build crm`.
4. Apply migrations: `docker compose exec crm npx prisma migrate deploy`.
5. Seed roles/statuses/demo data (optional):
   `docker compose exec crm node --env-file=/dev/null npx tsx prisma/seed.ts` — or run
   `npm run db:seed` from the repo's `crm/` directory against the database.
6. Create a DNS record for the subdomain; Caddy issues TLS automatically.

## Routine updates

```bash
git pull
docker compose -f deploy/docker-compose.prod.yml build crm
docker compose -f deploy/docker-compose.prod.yml up -d crm
docker compose exec crm npx prisma migrate deploy
```

Health: `GET https://crm.<domain>/api/health` (used by Caddy's probe).

## Backups

The CRM database is a second database on the same postgres instance — the
platform's `deploy/backup.sh` / `restore.sh` cover it by backing up the
instance; verify the dump includes `blckforest_crm`.

## Security posture

- Sessions: own Auth.js instance, own secret, cookies namespaced `crm.*`.
- Authorization: server-side permission checks on every route; row-level
  data scopes (OWN/TEAM/HIERARCHY/ORG) applied in the query layer.
- Rate limiting: login lockout (5 failures → 10 min) and a per-IP mutation
  throttle (120/min) — in-memory, single-container model (swap
  `src/server/security/rateLimit.ts` for Redis if horizontally scaled).
- API mutations reject cross-origin browsers (same-origin gate in
  middleware, on top of Auth.js CSRF).
- Platform bridge: read-only, shared-secret gated, constant-time compare.
- Audit log and activity timelines are append-only.
- Never run `npm run build` while the dev server is serving `.next`.

## Troubleshooting

See the [README troubleshooting section](./README.md#troubleshooting) — it
covers the redirect-loop, unstyled-pages, and auth-secret failure modes.

```bash
npx prisma migrate reset  # drops and recreates all tables
```
# then create your real admin directly in the DB or via a script