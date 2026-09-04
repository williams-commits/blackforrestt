# Black Forest CRM

Standalone sales & relationship-management module. Runs as its own Next.js
application on its own subdomain with its own database — fully isolated from
the trading platform. Design and roadmap: [`DESIGN.md`](./DESIGN.md).

**Status: spec-complete (minus call center).** All phases shipped and
hardened: foundation & RBAC, core records, activities & notifications,
dedup/conversion/merge (leads, contacts, accounts, customers),
opportunities & pipelines, CSV + Google Sheets import with retry,
campaigns with member tracking, configuration admin (statuses, tags,
custom fields, users, teams, roles, settings), trigram search including
notes with saved views, a report engine with builder UI + scope-safe CSV
export, dashboards, attachments behind a storage abstraction, the
read-only platform bridge, and the full hardening pass. Automated test
suites cover RBAC, scope, conversion, import, merge, export, search, and
normalization. The call-center scope was explicitly removed by the
product owner. Operations: [DEPLOYMENT.md](./DEPLOYMENT.md).

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

**`ERR_TOO_MANY_REDIRECTS` between / and /login** — the browser holds a
session cookie for a user that no longer exists (typically after
`prisma migrate reset` regenerated all IDs). The JWT callback now
re-validates the subject on every request, so a dead session decodes as no
session everywhere at once and the login page simply renders — no manual
cookie clearing needed. Just reload.

**Pages render unstyled / stylesheet 404** — `npm run build` was run while
`npm run dev` was still serving. The production build overwrites `.next`,
and the dev server then references CSS chunks that no longer exist. Fix:
stop the dev server, `rm -rf .next`, and restart `npm run dev`. Rule of
thumb: never build while the dev server is running — stop it first.

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
