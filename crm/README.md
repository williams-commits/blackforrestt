# Black Forest CRM

Standalone sales & relationship-management module. Runs as its own Next.js
application on its own subdomain with its own database — fully isolated from
the trading platform. Design and roadmap: [`DESIGN.md`](./DESIGN.md).

**Status: Phase 5 (opportunities) implemented — MVP boundary reached.**
Foundation, core records, activities/notifications, dedup/conversion/merge,
and now opportunities: configurable multi-pipeline stages (DB-driven, admin
managed), a kanban board with drag-drop stage moves plus list view, money
aggregates (open/weighted/won/win-rate), stage-driven won/lost automation,
and conversion can now create the opening opportunity. A sales team can
work leads end-to-end through won/lost. Imports arrive in Phase 6.

## Stack

Next.js 15 · React 19 · TypeScript · Prisma 6 + PostgreSQL · Auth.js v5 ·
Tailwind 4 · Zod. Ports: dev **3100**, container **3000**.

## Local setup

```bash
cd crm
cp .env.example .env            # then fill AUTH_SECRET (openssl rand -base64 32)
npm ci
# create the CRM database on the platform's postgres container once:
#   docker compose exec postgres psql -U postgres -c 'CREATE DATABASE blckforest_crm;'
npm run db:deploy               # apply migrations
npm run db:seed                 # roles, statuses, pipeline, teams, demo data
npm run dev                     # http://localhost:3100
```

Demo accounts (password `ChangeMe123!` — dev only):
`admin@crm.local`, `manager@crm.local`, `lead@crm.local`, `rep@crm.local`,
`rep2@crm.local`, `viewer@crm.local`.

## Architecture invariants

- **Own database.** The CRM never reads or writes the trading platform's
  tables. Platform linkage happens only via explicit operator-confirmed
  customer↔platform-user links (Phase 10).
- **Server-side authorization.** Every API handler starts with
  `requirePermission(...)` (`src/server/guard.ts`); row visibility is applied
  by the scope layer, never in UI components.
- **Append-only history.** `AuditLog` and `ActivityEvent` have no update or
  delete paths anywhere in the codebase.
- **Configuration over code.** Lead/contact/customer statuses, pipelines and
  stages, tags, and custom fields are database rows managed by admins, not
  enums.

## Verification

```bash
npm run typecheck
npm run lint
npm run build
```

## Troubleshooting

**`[auth][cause]: Error: no matching decryption secret`** — the browser holds
a session cookie encrypted under a previous `AUTH_SECRET` (the secret in
`crm/.env` changed, or the cookie predates a server run without a secret).
The app now handles this gracefully: the stale cookie decodes to no session,
so `/` simply redirects to `/login` and signing in again issues a fresh
cookie. Rotating `AUTH_SECRET` therefore just logs everyone out — it never
locks anyone out. If `/login` still misbehaves, restart `npm run dev` so the
new middleware is loaded.

## Deployment (when hosted on the subdomain)

1. Build the container image from `crm/Dockerfile`.
2. Add a `crm` service to `deploy/docker-compose.prod.yml` (backend network).
3. Add `CRM_DOMAIN=crm.<domain>` to the production env and
   `deploy/render-caddy.sh`, producing a `crm.<domain> { reverse_proxy crm:3000 }`
   site block; create the DNS record. TLS is issued automatically by Caddy.
4. Set a **separate** `AUTH_SECRET` for the CRM; `AUTH_URL=https://crm.<domain>`;
   `AUTH_TRUST_HOST=false`.
