# Black Forest release hardening report

## Scope

This release implements the eight requested hardening items against the Phase 6–7 login-fixed baseline:

1. mobile responsiveness optimization;
2. live-server deployment setup;
3. complete environment-variable documentation;
4. scroll-safe Asset modal;
5. pagination or bounded equivalents for necessary lists;
6. local seeded-login recovery and clearer authentication behavior;
7. Finnhub candle entitlement fallback and local reconciliation controls;
8. professional chart sizing, controls and persistent timeframe selection.

The platform remains explicitly simulation-oriented. These changes improve deployment and operational readiness but do not authorize real-money brokerage activity.

## 1. Mobile responsiveness

- Rebuilt the public navbar with a keyboard-accessible mobile sheet, expandable groups, Escape handling and body-scroll locking.
- Added dynamic viewport-height handling, 320px layout support, safe-area padding and horizontal-overflow protection.
- Reworked the trading dashboard into mobile and desktop layouts.
- Added a mobile floating trade action and full-height order dialog.
- Made account headers, account navigation, metrics and toolbars wrap or scroll safely.
- Added mobile Playwright regressions for navigation and the asset picker.

## 2. Live-server deployment

Added a production Docker Compose/Caddy deployment under `deploy/`:

- automatic HTTPS and WebSocket reverse proxying;
- internal-only PostgreSQL, Redis and MinIO networking;
- a separate outbound application network for configured external providers;
- dependency health checks and migration-before-start flow;
- production environment template;
- deploy, backup and destructive-confirmation restore scripts;
- PostgreSQL, Redis and MinIO backup artifacts with SHA-256 checksums;
- rollback and operating procedures in `DEPLOYMENT.md`.

## 3. Environment variables

Added `ENVIRONMENT_VARIABLES.md`, documenting every environment variable referenced by the repository. The source verifier found **68 referenced variables and zero undocumented variables**.

The documentation separates:

- database/cache;
- authentication/origins;
- email;
- S3/MinIO/KYC security;
- payments;
- reconciliation;
- market engine/Finnhub;
- deployment proxy;
- E2E, load, soak and Phase 8 verification variables.

## 4. Asset modal scrolling

The Asset modal now uses a bounded flex layout with a dedicated `overflow-y-auto`, `overscroll-contain`, touch-enabled results region. Header, category tabs and pagination remain fixed while only the instrument results scroll.

## 5. Pagination and bounded lists

Added reusable accessible pagination and applied it to:

- Asset modal instruments;
- account transactions;
- account position history;
- account payment timeline;
- administrator users;
- administrator payments;
- reconciliation runs, cases and blocks.

Trade history uses a server cursor and a bounded “load 25 more” equivalent rather than loading an unbounded history. The positions API now validates `limit` and cursor parameters.

## 6. Login repair

### Root cause addressed

The server, seed and authentication tools previously did not reliably load `.env`, allowing the stored seeded hash to diverge from the password the operator believed was configured. Seeded users could also retain stale lock, MFA, recovery-code and security-session state.

### Changes

- Development, start, seed and authentication scripts explicitly load `.env`.
- `db:seed` resets disposable local auth state when `RESET_SEEDED_AUTH=true`.
- `auth:reset-local` resets both seeded hashes, verification, MFA, locks, recovery codes, sessions and Redis login throttles.
- `local:repair` combines seed repair, login repair, reconciliation cleanup and `auth:doctor`.
- A development-only authorize guard can repair the two seeded users when the exact configured seed password is supplied. It cannot run in production.
- Successful login performs a full navigation after Auth.js issues the cookie.
- Password precedes the optional MFA/recovery field in the form.
- Infrastructure failures are separated from ordinary invalid-credential responses.

### Local recovery command

```bash
npm run local:repair
npm run dev
```

Use the matching `.env` values:

- `dev@blckforest.local` / `SEED_DEMO_PASSWORD`
- `admin@blckforest.local` / `SEED_ADMIN_PASSWORD`

The defaults in `.env.example` are `DemoUser123!` and `AdminDemo123!` for disposable local development only.

## 7. Finnhub and reconciliation

### Finnhub

The WebSocket and historical candle products are now handled independently.

- `FINNHUB_CANDLE_MODE=auto`: tries historical candles, opens a process-level circuit on the first HTTP 401/403, logs one actionable warning and keeps deterministic simulated history.
- `FINNHUB_CANDLE_MODE=disabled`: never requests historical candles; Finnhub live WebSocket prices may still be used.
- `FINNHUB_CANDLE_MODE=required`: fails instead of silently falling back when entitled historical data is mandatory.

The previous 41 repeated 403 requests are therefore eliminated.

### Reconciliation

- Local development defaults `RECONCILIATION_ENABLED=false` so routine UI work does not create scheduled discrepancy blocks.
- Production defaults to enabled.
- `reconciliation:reset-local` releases and resolves existing local-only blocks/cases.
- `local:repair` runs this cleanup automatically.

These reset tools refuse to run in production.

## 8. Professional chart and timeframe persistence

The trading chart now provides:

- candlesticks and line views;
- volume histogram;
- crosshair OHLC display;
- 20-period moving average;
- zoom, fit and fullscreen controls;
- responsive horizontal toolbar;
- larger minimum chart/canvas heights;
- visible price scale and professional chart interactions;
- persisted timeframe, chart type and indicator state.

Timeframe selection is stored in both the URL (`?tf=5m`) and local storage. The WebSocket subscription follows the store-selected timeframe. Refreshing no longer forces the chart back to `1m`, and changing assets preserves the current timeframe.

## Regression coverage added

Playwright coverage now explicitly checks:

- mobile navigation opening and closing;
- mobile asset-dialog visibility, vertical scrolling and second-page navigation;
- chart minimum rendered height;
- selecting `5m`, URL synchronization and persistence after refresh.

## Verification completed in the delivery environment

- 198 TypeScript/TSX files parsed with TypeScript 5.8.3.
- 0 syntax diagnostics.
- 0 unresolved internal imports.
- 17/17 release-hardening source-contract checks passed.
- 8/8 login/hydration source checks passed.
- Phase 6/7 source contract passed.
- JSON, YAML, shell syntax, conflict-marker and whitespace checks passed.
- Source release scan passed with one documented deterministic credential-fixture warning.

## Verification boundary

`npm ci --ignore-scripts` could not complete because the execution environment's package proxy returned HTTP 503 for package tarballs. Docker is also unavailable here. Consequently, dependency-backed TypeScript semantic checking, Prisma generation, Next.js build, PostgreSQL/Redis integration tests and browser execution remain to be run in a network-enabled CI/staging environment.

Mandatory final gate:

```bash
npm ci
npm run db:generate
npx prisma validate
npm run db:deploy
npm run local:repair
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
npm run build
npm run e2e:install
npm run phase8:verify:full
```

Do not classify the release as runtime-certified until every mandatory command exits successfully and the evidence is reviewed.
