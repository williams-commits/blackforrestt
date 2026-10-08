# BlackForest platform

A Turborepo monorepo running three Next.js applications over shared
PostgreSQL / Redis / MinIO infrastructure:

| App | Path | What it is | Dev port |
|---|---|---|---|
| **web** | `apps/web` | Marketing: multi-domain landing + content pages (domain/design platform system, domain CLI) | 3000 |
| **trade** | `apps/trade` | Trading platform: terminal, account portal, admin console, engine + WebSocket server, trader auth | 3101 |
| **crm** | `apps/crm` | CRM: standalone app, own database (`blckforest_crm`), own auth, read-only HTTP bridge to trade | 3100 |

- `web` and `trade` share the `blackforrestt` database (web reads; trade owns
  writes + the trading engine). `crm` is fully separate.
- The CRM ↔ trade integration is a one-directional, read-only, token-gated
  HTTP bridge (`PLATFORM_BRIDGE_URL` → trade's `/api/internal/crm/*`).
- Shared client code is deliberately duplicated per app; extraction into
  `packages/` is a tracked follow-up. The `packages/*` npm-workspaces glob is
  reserved for that — **no shared packages exist today**.

## Local development

1. Start the dev infrastructure (repo root):

   ```bash
   docker compose up -d postgres redis minio minio-init
   ```

2. Run the app dev servers:

   ```bash
   make dev    # all three apps via turbo (web :3000, crm :3100, trade :3101)
   ```

   or per app: `npm run dev --workspace apps/web` (likewise for trade/crm).
   Each app reads its own `.env` — `apps/web/.env` and `apps/trade/.env`
   symlink the repo root `.env`; `apps/crm/.env` is separate.

## Verification

From the repo root (fans out to all apps via turbo):

```bash
npm run lint        # ESLint (zero warnings enforced)
npm run typecheck   # TypeScript strict
npm run build       # production builds
npm test            # unit tests — apps defining test:unit (currently web only)
npm run test:all    # DB-backed suites — apps defining test:all (currently crm only)
```

Current test coverage, stated plainly:

| App | Unit | Integration / DB-backed |
|---|---|---|
| web | ✅ via `npm test` (engine, WS protocol, auth client, domains/registry gates, …) | ✅ `npm run test:integration --workspace apps/web` (needs local Postgres/Redis/MinIO) |
| crm | — | ✅ `make test-crm` (needs seeded local `blckforest_crm`) |
| trade | ❌ no test suite yet — tracked follow-up | ❌ |

CI ([`.github/workflows/verify.yml`](.github/workflows/verify.yml)) runs
install → prisma generate → lint → typecheck → build → `turbo run test:unit`
on every push/PR. DB-backed suites are not wired into CI yet (tracked
follow-up); the legacy Phase 8 harness sits unwired in
`apps/web/scripts/phase8/`.

## Deployment, Docker, and operations

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — the single source of truth
for first-time deployment, routine updates, operations, backup/restore, and
troubleshooting. Production stack: `deploy/docker-compose.prod.yml` + Caddy
(`gbfxs.com` → web, `trade.<domain>` → trade, `crm.<domain>` → crm).

Common operations: `make deploy`, `make update` (rebuilds web + trade + crm),
`make health`, `make diagnose`, `make backup` / `make restore`,
`make auth-doctor` (Auth.js readiness, inside the web container),
`make preflight` (production env posture — the same gate deploy.sh runs).

## What this codebase is

An enterprise-oriented internal dealing-desk broker: the engine fills
positions at the quoted bid/ask and posts commission, swap, margin, and PnL
to a double-entry ledger. Market data via configurable feeds (simulation by
default; Finnhub and others supported). Production activation still requires
licensed broker execution and market data, approved payment and KYC
operations, production secrets/KMS, independent penetration testing, and
operational sign-off.

- [Deposit and withdrawal workflows](docs/PAYMENT_WORKFLOWS.md)
- [Email activation and template design](docs/EMAIL_SETUP.md)
- [Environment variables](docs/ENVIRONMENT_VARIABLES.md)
