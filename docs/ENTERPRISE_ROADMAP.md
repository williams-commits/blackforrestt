# Enterprise release-candidate roadmap

Status date: 2026-07-30

Status vocabulary:

- `VERIFIED` — implemented and supported by the listed local verification evidence.
- `IMPLEMENTED` — repository scope is delivered, and the static verification gate (typecheck, lint, build, unit suite, source/release scan) passes locally; the dependency-backed runtime gate (PostgreSQL/Redis/MinIO integration, browser/load/WS soak) is still pending in this environment.
- `PARTIAL` — useful implementation exists, but the repository scope or phase exit criteria are not met.
- `NOT STARTED` — required control is absent.
- `EXTERNAL` — cannot be completed only by changing this repository.

The release remains **simulation-only** until every local phase is `VERIFIED` and the external go-live dependencies are independently approved.

## Static verification gate (2026-07-30)

`npm run phase8:verify` (mode `static`) now passes locally with zero failures:

```
phase67-source-contract · db-generate · prisma-validate · typecheck · lint · build · unit-suite · release-archive-build · release-source-scan
```

All ten gates exit 0; the evidence is written to `artifacts/phase8/verification-matrix.json`. This supersedes the earlier "could not run `npm ci` / no Docker" verification boundary noted in the audit and patch reports — dependencies install and the static matrix executes. The integration and full modes still require PostgreSQL, Redis, and MinIO to be running.

| Phase | Status | Current evidence | Exit gate |
|---|---|---|---|
| 0 — Baseline | VERIFIED | dependency install, Prisma generation/validation, typecheck, lint, five engine tests, production build, empty PostgreSQL migration replay, Redis health check | preserve passing gate and Phase 0 report |
| 1 — Accounting | VERIFIED | all economic events ledgered; immutable headers/entries; derived projections; exact reversals; Decimal engine; trial-balance/projection/PostgreSQL trade tests | preserve Phase 1 verification report and passing regression gate |
| 2 — Identity/security | VERIFIED | hashed expiring email/reset tokens, encrypted TOTP + hashed recovery codes, durable device sessions/revocation, Redis throttle + durable lockout, same-origin mutation enforcement, withdrawal step-up, security audit chain | preserve Phase 2 verification report and passing regression gate |
| 3 — KYC storage | VERIFIED | presigned quarantine PUT, server-verified size/MIME/SHA-256, provider-side SSE, stub+EICAR scan lifecycle, quarantine→sealed move, signed compliance downloads with access audit, retention hook | preserve Phase 3 verification report and passing regression gate |
| 4 — Manual payments | VERIFIED | proof objects via storage pipeline, envelope-encrypted beneficiary data, maker-checker separation, provider-scoped unique external/reconciliation refs, customer cancellation + finance reversal, reconciliation state, notifications and risk controls, serializable-retry concurrency | preserve Phase 4 verification report and passing regression gate |
| 5 — Reconciliation | IMPLEMENTED | replay-safe scheduled/manual runner, Redis lease, ledger/projection/closed-position/payment checks, cases, trade/withdraw blocks, admin API/UI, integration test. The internal simulated broker is complete (fills, commission, swap, margin, PnL all posted to the ledger), so no external execution provider is required for the engine; reconciliation recomputes each closed position's PnL and verifies its `COMMISSION`/`SWAP`/`TRADING_PNL`/`MARGIN_RELEASE` ledger postings exist | run the clean PostgreSQL/Redis integration suite in CI/staging; an external-licensed-broker order/fill matching layer is only relevant once a real external execution provider is integrated (it is not needed for the internal dealing-desk model) |
| 6 — Audit/admin | IMPLEMENTED | persisted seven-role RBAC, least-privilege permissions, maker-checker change requests, domain audit v2, redacted verification/export, and all required operational modules | run the clean PostgreSQL integration suite in CI/staging |
| 7 — Enterprise UI | IMPLEMENTED | role-aware admin console, simulation/source/freshness disclosure, stale-order blocks, lifecycle states, account reconciliation, KYC/security/finance workflows, responsive and accessibility coverage | pass mandatory browser, axe, mobile, build, load, and WebSocket evidence without skips |
| 8 — Verification | PARTIAL | automated static/integration/full orchestrator, WebSocket protocol tests, Redis lease failover, migration/backup/restore matrix, Playwright+axe coverage, HTTP load and WebSocket soak tooling, release-archive build + scanner, CI workflow, and operations runbooks. The **static mode passes locally (2026-07-30)**; integration and full modes are pending running infrastructure | execute the integration and full matrix successfully in CI/staging with PostgreSQL/Redis/MinIO; review evidence and approvals |

## Sequencing rules

1. Do not promote a later phase to `VERIFIED` while an earlier phase has a failing required verification.
2. Each implementation phase receives its own migration where persistence changes, automated tests, documentation, verification report, and commit.
3. Posted ledger history and audit history are append-only. Corrections use new compensating records.
4. All financial commands are serializable and idempotent.
5. Money uses decimal arithmetic; JSON number inputs are converted from canonical decimal strings before accounting.
6. Live-provider configuration must fail closed and remain visibly distinct from simulation mode.
7. Ambiguous broker outcomes enter reconciliation; they are never retried as new orders.
8. No release archive is created until the final Phase 8 command matrix passes locally.

## Phase 1 — complete double-entry accounting

Planned deliverables:

- expand chart of accounts for client funds, reserved margin/withdrawals, commission, swap, realized P&L, bonuses, fees, adjustments, and negative-balance protection (the internal dealing-desk model settles client PnL/commission/swap against internal revenue/expense accounts, so no separate broker receivable/payable account is required);
- add economic-event and idempotency metadata to ledger transactions;
- implement immutable transaction headers and compensating reversals;
- post registration/demo funding, payment settlement, trade open/close, swap, fees, bonuses, adjustments, and protection;
- make wallet and base account balance rebuildable projections;
- implement trial balance, user liability balance, projection rebuild, and invariant checker;
- add PostgreSQL integration and concurrency tests.

Exit criteria:

- no direct economic balance mutation without a ledger transaction in the same serializable database transaction;
- every posted transaction is balanced independently per asset;
- projection rebuild equals stored projections;
- duplicate idempotency requests post once;
- reversal posts exact opposite entries and original rows remain unchanged;
- full Phase 0 and Phase 1 suites pass.

## Phase 2 — identity and security

Planned deliverables:

- single-use expiring email verification and password reset tokens stored only as hashes;
- TOTP enrollment/confirmation/challenge and encrypted secret storage;
- hashed one-time recovery codes;
- database-backed sessions/devices and global/per-device revocation;
- Redis-backed distributed login throttling and durable lockout;
- same-origin enforcement for mutations;
- recent-MFA step-up grant for withdrawal creation/approval;
- complete security audit events and security-center UI.

Exit criteria includes concurrent throttle tests, token replay tests, TOTP/recovery tests, session revocation tests, origin tests, and withdrawal step-up tests.

## Phase 3 — KYC storage

Planned deliverables:

- provider interface for private S3-compatible storage and KMS-managed encryption;
- presigned quarantine upload and finalize flow;
- server-verified content length, detected MIME, SHA-256, scan state, and immutable object metadata;
- status transitions from upload through scan and compliance decision;
- short-lived signed compliance downloads, access audit, legal hold and retention controls;
- removal of document URLs/bytes from PostgreSQL and API responses.

Production verification requires real provider test infrastructure; local tests use a protocol-compatible service and explicit non-production keys.

## Phase 4 — manual payments

Planned deliverables:

- payment proof objects through the Phase 3 storage pipeline;
- envelope-encrypted beneficiary details with no plaintext API response;
- distinct maker/checker roles and self-approval prevention;
- provider-scoped unique external settlement reference;
- customer cancellation and finance reversal;
- reconciliation state, notifications, velocity/beneficiary/cooling-off controls, and audit coverage.

## Phase 5 — reconciliation

Planned deliverables:

- import and normalize settlement, ledger, wallet, account, position, commission, swap, and P&L records (the engine is an internal simulated dealing-desk broker, so there is no separate broker feed to import — fills, commission, swap, and PnL are produced by the engine and posted to the ledger in the same transaction; reconciliation instead recomputes each position's PnL and verifies its ledger postings);
- deterministic matching tolerances expressed as decimals;
- mismatch case ownership/severity/lifecycle;
- withdrawal/trading blocks for critical discrepancies;
- replay-safe scheduled runs and independent reconciliation reports.

## Phase 6 — audit and administration

Planned deliverables:

- roles: `SUPER_ADMIN`, `COMPLIANCE`, `FINANCE`, `DEALER`, `RISK`, `SUPPORT`, `AUDITOR`;
- least-privilege authorization and maker-checker policies;
- immutable events for security, KYC, payments, ledger, broker, reconciliation, configuration, support, and admin activity;
- user, KYC, payment, ledger, execution, reconciliation, support, instrument, risk, audit, and service-health modules;
- audit-chain verification and export with sensitive-field redaction.

## Phase 7 — enterprise UI

Planned deliverables:

- accessible component tokens and responsive shells;
- explicit simulation/live-provider banner and quote source/freshness;
- complete order ticket plus pending/open/closed lifecycle views;
- consistent loading, empty, stale, offline, error, and retry states;
- account reconciliation status, MFA/security center, KYC checklist, finance timeline, and role-specific admin workflows;
- keyboard and screen-reader verification.

## Phase 8 — verification and release evidence

Planned deliverables:

- unit and PostgreSQL integration suites;
- Redis concurrency and failover suite;
- Playwright user/admin E2E and automated accessibility checks;
- broker ambiguity and reconciliation suites;
- empty/upgrade/rollback migration tests;
- load and WebSocket soak scripts with accepted thresholds;
- backup/restore, incident, rollback, key rotation, and provider outage runbooks;
- final verification report with exact commands, environment, results, and known limitations.

Only after every local command succeeds may a source release ZIP be created. The ZIP must exclude `.env`, dependencies, build outputs, test artifacts, KYC/payment objects, credentials, and local database volumes.

## External go-live work

Repository completion is not real-money authorization. Legal/regulatory licensing, banking and safeguarding, broker/provider contracts, market-data rights, production infrastructure, independent security testing, compliance sign-off, operational staffing, and disaster-recovery evidence remain external gates.
