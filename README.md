# Black Forest Digital platform

A Next.js 15, Auth.js, Prisma/PostgreSQL and WebSocket trading-platform release
candidate with public landing pages, an authenticated client portal, simulated
trading terminal, double-entry accounting, manual payment operations, secure
KYC storage workflow, MFA/security controls, reconciliation, and an admin
console with seven-role RBAC, maker-checker governance, immutable domain audit, and role-aware enterprise workflows.

## Start locally

See the [local development section of the deployment guide](docs/DEPLOYMENT.md#local-development).

## Deployment, Docker, and operations

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — the single source of truth for
first-time deployment, routine updates, operations, backup/restore, and
troubleshooting (including the health-check cascade, seed requirements, and
env-file flags).

## Phase 8 verification

The verification harness has three fail-closed levels:

```bash
npm ci
npm run phase8:verify                 # schema, types, lint, build, unit, release scan
npm run phase8:verify:integration     # plus PostgreSQL, Redis, migration/restore
npm run e2e:install
npm run phase8:verify:full            # plus browser, accessibility, HTTP load, WS soak
```

The full mode requires customer/admin credentials (via `E2E_DEMO_EMAIL` /
`E2E_DEMO_PASSWORD` and `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`) and a reachable
application. Set `PHASE8_START_SERVER=true` to let the orchestrator start and
stop a development server, or provide an already-running staging endpoint.

GitHub Actions runs the complete simulation matrix from
`.github/workflows/phase8-verification.yml` and retains the generated evidence.

## Current release classification

This codebase is an enterprise-oriented trading platform. The repository
implements an **internal dealing-desk broker**: the engine fills positions at
the quoted bid/ask and posts commission, swap, margin, and PnL to a
double-entry ledger. Finnhub is used as the live market-data feed, with a
graceful fallback to an internal price feed when no key is configured.

As of 2026-07-30, the **static Phase 8 gate passes locally with zero failures**
(`npm run phase8:verify`): source contract, Prisma validate, typecheck, lint,
build, the unit suite, and the release-archive build + scan all exit 0 (evidence
in `artifacts/phase8/verification-matrix.json`). The **integration and full
modes remain PENDING** until PostgreSQL, Redis, and MinIO are running so the
runtime gates (PostgreSQL/Redis integration, Playwright/a11y, HTTP load,
WebSocket soak) can execute.

Production activation still requires licensed broker execution and market data,
approved payment and KYC operations, production secrets/KMS, independent
penetration testing, legal/regulatory approval, backups, monitoring, failover,
and operational sign-off.

## Authentication readiness

Before investigating a failed login, run:

```bash
npm run auth:doctor
```

The command verifies the public Auth.js origin, PostgreSQL and identity
migrations, the SecuritySession/AdminRoleAssignment tables, and Redis.

## Release hardening guides

- [`docs/RELEASE_HARDENING_REPORT.md`](docs/RELEASE_HARDENING_REPORT.md) maps the latest mobile, deployment, login, market-data, pagination and chart changes to verification evidence.
- [`docs/ENVIRONMENT_VARIABLES.md`](docs/ENVIRONMENT_VARIABLES.md) explains every runtime, deployment and verification environment variable.
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) provides the live Docker/Caddy deployment and operations procedure.
- Local authentication/reconciliation recovery: `npm run local:repair`.
- Finnhub live-price plus simulated-history behavior is controlled by `MARKET_DATA_MODE` and `FINNHUB_CANDLE_MODE`.
- Browser regressions cover mobile navigation, scrollable/paginated assets, professional chart sizing, and timeframe persistence.

## Payment and email operations

- [Deposit and withdrawal workflows](docs/PAYMENT_WORKFLOWS.md)
- [Email activation and template design](docs/EMAIL_SETUP.md)
