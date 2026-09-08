# Environment variables

The application reads `.env` for local development and `.env.production` for the live Docker deployment. Never commit either file. Values marked **secret** must come from a secret manager or a root-readable file with mode `600`.

## Branding

| Variable | Scope | Description |
|---|---|---|
| `BRAND_NAME` | Server | Short brand name (e.g. "Black Forest"). Used for email subjects and the MFA issuer. |
| `NEXT_PUBLIC_BRAND_NAME` | Client + server | Full brand name shown in the UI (e.g. "Black Forest Digital"). Embedded at build time so client components can read it. |
| `COMPANY_LEGAL_NAME` | Server | Registered legal entity (e.g. "Black Forest Digital LTD"). Used in legal pages and the footer. |
| `SUPPORT_EMAIL` | Server | Support/contact email shown in the UI and legal pages. |
| `BRAND_DOMAIN` | Server | Public domain (e.g. "blackforestd.net"). |
| `COMPANY_ADDRESS` | Server | Registered company address shown in the footer and legal pages. Empty = hidden. |

## Database and cache

| Variable | Required | Purpose |
|---|---:|---|
| `POSTGRES_USER` | Deployment | PostgreSQL role created by the container. Default: `blckforest`. |
| `POSTGRES_DB` | Deployment | PostgreSQL database name. Default: `blckforest`. |
| `POSTGRES_PASSWORD` | Yes | **Secret.** Password used by the PostgreSQL container. Prefer URL-safe characters or URL-encode it in `DATABASE_URL`. |
| `DATABASE_URL` | Yes | Prisma connection URL. Local host uses `localhost`; containers use the service name `postgres`. |
| `REDIS_URL` | Yes | Redis endpoint for login throttles, leases and distributed controls. Local: `redis://localhost:6379`; Docker: `redis://redis:6379`. |

## Authentication and application origin

| Variable | Required | Purpose |
|---|---:|---|
| `AUTH_SECRET` | Yes | **Secret.** Signs/encrypts Auth.js session material. Generate with `openssl rand -hex 32`. Rotating it signs out all users. |
| `APP_ORIGIN` | Yes | Comma-separated allowed application origins for same-origin mutation checks. The first value is canonical. |
| `AUTH_URL` | Yes | Canonical Auth.js URL, including `https://` in production. Must match the first `APP_ORIGIN` origin. |
| `AUTH_TRUST_HOST` | Production proxy | Allows Auth.js to trust forwarded host/protocol headers. Set `true` only behind the included trusted Caddy proxy. |
| `SECURITY_HASH_PEPPER` | Yes | **Secret.** Pepper for IP/network identifiers and security hashes. Generate with `openssl rand -hex 32`. |
| `FIELD_ENCRYPTION_KEY` | Yes | **Secret.** Base64-encoded 32-byte key for encrypted sensitive fields. Generate with `openssl rand -base64 32`. Do not rotate without a data migration. |
| `REGISTRATION_REQUIRE_EMAIL_VERIFICATION` | Registration | When `true`, new users must activate their email before login. Production should keep this enabled. New accounts are created unfunded. |
| `DEV_EMAIL_PREVIEW` | Local only | Shows verification/reset links in the UI when an email provider is not configured. |
| `ALLOW_UNVERIFIED_WITHDRAWALS` | Local only | Permits withdrawal testing before KYC approval. Must be `false` in production. |

## Email

See `EMAIL_SETUP.md` for provider activation, template previews, branding, and delivery architecture.

| Variable | Required | Purpose |
|---|---:|---|
| `EMAIL_PROVIDER` | Email | `resend`, `http`, or `disabled`. Local preview links work only outside production when the provider is disabled. |
| `RESEND_API_KEY` | Resend | **Secret.** Resend API key used by the built-in HTTPS adapter. |
| `EMAIL_API_URL` | HTTP adapter | HTTPS endpoint for a private transactional-email adapter. |
| `EMAIL_API_TOKEN` | HTTP adapter | **Secret.** Bearer token sent to the private adapter. |
| `EMAIL_FROM` | Real delivery | Verified sender in `Name <address>` format. |
| `EMAIL_REPLY_TO` | No | Reply-to mailbox for customer responses. |
| `EMAIL_SUPPORT_ADDRESS` | No | Support address shown in the shared template footer. |
| `EMAIL_BRAND_NAME` | No | Brand name rendered in every template. |
| `EMAIL_BRAND_COLOR` | No | Hex accent color used by the shared email layout. |
| `EMAIL_LOGO_URL` | No | Public HTTPS logo URL used in email headers. Leave empty for a text logo. |
| `EMAIL_DISPATCH_INTERVAL_MS` | No | Email-outbox polling interval. Default: 15 seconds. |
| `EMAIL_MAX_ATTEMPTS` | No | Maximum delivery attempts before an outbox record becomes `FAILED`. |
| `EMAIL_PROCESSING_TIMEOUT_MS` | No | Reclaims email jobs left in `PROCESSING` after an interrupted worker. Default: 120 seconds. |

## Object storage and document security

| Variable | Required | Purpose |
|---|---:|---|
| `S3_ENDPOINT` | Yes | S3-compatible endpoint. Local host: `http://localhost:9000`; Docker: `http://minio:9000`. |
| `S3_REGION` | Yes | S3 region identifier. MinIO commonly uses `us-east-1`. |
| `S3_BUCKET_PREFIX` | Yes | Prefix used to create private quarantine/sealed KYC and payment-proof buckets. |
| `S3_ACCESS_KEY_ID` | Yes | **Secret.** Application S3 access key. Use a restricted service account in production. |
| `S3_SECRET_ACCESS_KEY` | Yes | **Secret.** Application S3 secret key. |
| `S3_FORCE_PATH_STYLE` | MinIO | Enables path-style S3 URLs required by local/self-hosted MinIO. |
| `MINIO_ROOT_USER` | Self-hosted MinIO | **Secret.** MinIO root/bootstrap identity. Do not reuse as the long-term application identity. |
| `MINIO_ROOT_PASSWORD` | Self-hosted MinIO | **Secret.** MinIO root/bootstrap password. |
| `KYC_KMS_KEY_ID` | Production KMS | Optional customer-managed KMS key identifier for document encryption. |
| `KYC_DOWNLOAD_TTL_SECONDS` | No | Lifetime of signed document-download URLs. Default: `300`. |
| `KYC_MAX_BYTES` | No | Server-side maximum KYC upload size in bytes. |
| `NEXT_PUBLIC_KYC_MAX_BYTES` | No | Browser-visible copy of the KYC upload limit for immediate validation. It is not a security boundary. |
| `KYC_RETENTION_DAYS` | No | Document retention period used by operational policy. |
| `KYC_SCANNER` | Yes | Malware-scanner adapter. Use `stub` only in local development/CI and `http` in production. |
| `ALLOW_LOCAL_STUB_SCANNER` | Local Docker only | Allows `KYC_SCANNER=stub` only when `APP_ORIGIN` is loopback. Keep false for every public deployment. |
| `MALWARE_SCANNER_URL` | Production scanning | HTTPS endpoint that accepts the original file bytes and returns `CLEAN`, `BLOCKED`, or `QUARANTINED`. |
| `MALWARE_SCANNER_TOKEN` | Optional | **Secret.** Bearer token sent to the malware-scanner gateway. |
| `MALWARE_SCANNER_TIMEOUT_MS` | No | Scanner request timeout, bounded to 1–120 seconds. Default: 30 seconds. |
| `PAYMENT_PROOF_MAX_BYTES` | No | Maximum uploaded payment-proof size in bytes. |

## Payment controls

| Variable | Required | Purpose |
|---|---:|---|
| `PAYMENT_BENEFICIARY_COOLING_OFF_HOURS` | No | Hold after adding/changing a withdrawal beneficiary. |
| `PAYMENT_PASSWORD_CHANGE_COOLING_OFF_HOURS` | No | Hold after a password change before withdrawals. |
| `PAYMENT_DAILY_WITHDRAWAL_LIMIT` | No | Maximum daily withdrawal amount per user. |
| `PAYMENT_DAILY_WITHDRAWAL_COUNT` | No | Maximum daily withdrawal request count per user. |
| `PAYMENT_REQUIRE_DUAL_FINANCE_REVIEW` | No | When `true`, approval must use a different finance reviewer from preparation. Default: `true`; set `false` only for small local operations queues. |
| `SIMPLE_PAYMENT_APPROVAL` | No | When `true`, a finance reviewer can approve a `PENDING` payment directly, collapsing the separate Prepare step into a single Approve. Default: `false`. Combine with `PAYMENT_REQUIRE_DUAL_FINANCE_REVIEW=false` and `PAYMENT_BENEFICIARY_COOLING_OFF_HOURS=0` for the simplest single-admin flow. |
| `DEPOSIT_UI_ENABLED` | No | When `false`, hides customer deposit entry points while preserving backend records and withdrawal UI. Default: `true`. |
| `PAYMENT_METHODS_DISABLED` | No | Comma-separated payment methods to disable for **both** deposit and withdrawal (e.g. `CARD,CRYPTO`). Empty/unset = all enabled. The method is hidden from the wallet selector and rejected by the API. Values: `CARD`, `BANK_TRANSFER`, `CRYPTO`. |

## Reconciliation

| Variable | Required | Purpose |
|---|---:|---|
| `RECONCILIATION_ENABLED` | Yes | Starts the reconciliation scheduler. Local UI development defaults to `false`; production must normally use `true`. |
| `RECONCILIATION_INTERVAL_MS` | No | Scheduler cadence. Default: 5 minutes. |
| `RECONCILIATION_LOCK_LEASE_MS` | No | Renewable Redis lease duration preventing duplicate schedulers. |
| `RECONCILIATION_RUN_STALE_MS` | No | Age after which an incomplete run may be recovered. |
| `RECONCILIATION_PAYMENT_PENDING_HOURS` | No | Pending-payment age that becomes a reconciliation discrepancy. |

## Application and market engine

| Variable | Required | Purpose |
|---|---:|---|
| `NODE_ENV` | Runtime | `development`, `test` or `production`. Production disables all local authentication repair/bypass behavior. |
| `PORT` | No | HTTP and WebSocket port. Default: `3000`. |
| `MARKET_TICK_MS` | No | Internal market-engine tick interval. |
| `POSITION_PERSIST_EVERY_TICKS` | No | Number of market ticks between durable open-position checkpoints. |
| `MAX_POSITION_LOTS` | No | Server-enforced maximum order volume. |
| `MARKET_SEED` | No | Seed for deterministic simulated prices. Change it to obtain a different deterministic scenario. |
| `MARKET_DATA_MODE` | Yes | One of `simulation`, `finnhub`, `alphavantage`, `tickerlayer`, `sifting`, or `lse`. Controls the live price feed and candle history source. Default: `simulation` (no external feed). |
| `FINNHUB_API_KEY` | Finnhub mode | **Secret.** Finnhub token used by the live WebSocket and optional REST history. |
| `ALPHAVANTAGE_API_KEY` | Alpha Vantage mode | **Secret.** Alpha Vantage token used for REST-polling prices and candle history when `MARKET_DATA_MODE=alphavantage`. |
| `FINNHUB_CANDLE_MODE` | Finnhub mode | `auto`: probe once and fall back on 401/403; `disabled`: always use simulated history; `required`: treat missing candle entitlement as an error. |
| `FINNHUB_CANDLE_DELAY_MS` | No | Delay between entitled historical-candle REST calls. |
| `ECONOMIC_CALENDAR_SOURCE` | No | Calendar feed for `/tools/calendars`. `forexfactory` (default): free, key-free, rate-limited. `finnhub`: Finnhub `/calendar/economic` (requires the paid Economic-1 add-on and `FINNHUB_API_KEY`). |
| `NEXT_PUBLIC_WS_URL` | Optional | Browser WebSocket URL. Leave empty for same-origin automatic `ws://`/`wss://`; set only when the socket uses another public origin. This value is embedded at build time. |
| `WS_MAX_BUFFERED_BYTES` | No | Maximum pending outbound bytes per WebSocket client before it is disconnected and required to resynchronize. Default: 1 MiB. |

Finnhub can provide live WebSocket prices while historical candles remain simulated. This hybrid is intentional when `MARKET_DATA_MODE=finnhub` and `FINNHUB_CANDLE_MODE=auto` or `disabled`. Alpha Vantage (`MARKET_DATA_MODE=alphavantage`) polls REST endpoints (5 req/min free tier) and fills gaps with the simulator.

## Deployment proxy

| Variable | Required | Purpose |
|---|---:|---|
| `DOMAIN` | Production | Public hostname used by Caddy, for example `trade.example.com`. DNS must point to the server. |
| `CADDY_EMAIL` | Production | Contact email used for automatic TLS certificate issuance. |
| `APP_IMAGE` | No | Docker image/tag for the application. Default: `blckforest-app:latest`. |

## Verification and E2E variables

These are used only by `phase8:verify:*`, Playwright and load/soak scripts—not by the normal application runtime.

| Variable | Purpose |
|---|---|
| `BASE_URL`, `E2E_BASE_URL` | Target application URL for verification/browser tests. |
| `E2E_DEMO_EMAIL`, `E2E_DEMO_PASSWORD` | Credential-backed customer E2E identity. |
| `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` | Credential-backed administrator E2E identity. |
| `E2E_START_SERVER`, `PHASE8_START_SERVER` | Whether the verifier starts the app or uses an existing server. |
| `PHASE8_MODE`, `PHASE8_FAIL_FAST`, `PHASE8_EVIDENCE_DIR` | Verification mode, failure behavior and evidence output directory. |
| `PHASE8_DATABASE_ADMIN_URL` | Administrative PostgreSQL URL used to create disposable migration/restore databases. |
| `PHASE8_REDIS_LEASE_MS` | Lease duration for Redis failover tests. |
| `PHASE8_HEALTH_PATH`, `PHASE8_SERVER_TIMEOUT_MS` | Health endpoint and startup timeout. |
| `LOAD_PATHS` | Comma-separated HTTP paths used by the load test. |
| `WS_URL`, `WS_COOKIE`, `WS_SYMBOL`, `WS_INTERVAL` | WebSocket soak-test target, authenticated cookie, symbol and timeframe. |
| `CI` | Standard CI marker used to enforce stricter non-interactive behavior. |

## Local authentication recovery

After changing either seed password in `.env`, run:

```bash
npm run local:repair
npm run auth:doctor
npm run dev
```

`local:repair` is blocked in production. It updates the stored password hashes and clears stale local MFA/lock/session state for the two disposable seeded accounts.

## Configuration rules

- `.env` is for local host-based development (`localhost` service URLs).
- `.env.production` is for the production Compose stack (`postgres`, `redis` and `minio` service names).
- `NEXT_PUBLIC_*` variables are embedded into browser bundles and must never contain secrets.
- Changing `AUTH_SECRET` invalidates sessions; changing `FIELD_ENCRYPTION_KEY` without a migration can make encrypted data unreadable.
- Run `npm run auth:doctor` after changing authentication, database, Redis or origin variables.
- Run `npm run hardening:verify:source` before packaging a release.

## Multi-brand domains

| Variable | Scope | Description |
|---|---|---|
| `BRAND_DOMAINS` | Server | Comma-separated apex domains serving the same files. The FIRST entry is canonical (redirect targets, cookie domain, email links, SEO). `BRAND_DOMAIN` alone still works as a single-entry list. |
| `BRAND_OVERRIDES` | Server | JSON object keyed by apex domain with per-brand overrides, e.g. `{"agilefgs.com":{"tradeEnabled":true}}`. `tradeEnabled: true` asserts the family's trade subdomain DNS + TLS exist. |
| `BRAND_TM` | Server | Trademark line shown in the UI footer. Default: `Black Forest™`. |
| `DOMAIN` / `DOMAIN_2` / `DOMAIN_3` | Production proxy | Apex domains N that this deployment serves (mirrors `BRAND_DOMAINS` for the reverse proxy and domain routing). |
| `TRADE_DOMAIN` / `TRADE_DOMAIN_2` / `TRADE_DOMAIN_3` | Production proxy | The trade subdomain serving each `DOMAIN_N` family's authenticated app. |
| `TRADE_SUBDOMAIN` | Server | Subdomain label for trade hosts. Default: `trade`. |

## Market data feeds

| Variable | Required | Purpose |
|---|---:|---|
| `ALPHAVANTAGE_CANDLE_DELAY_MS` | No | Delay between Alpha Vantage candle requests (rate-limit pacing). Default: `12000`. |
| `TICKERLAYER_API_KEY` | No | TickerLayer market-data feed key; selecting the `tickerlayer` market-data mode requires it. |
| `SIFTING_API_KEY` | No | Sifting market-data feed key; selecting the `sifting` market-data mode requires it. |
| `LSE_API_KEY` | No | LSE market-data feed key; selecting the `lse` market-data mode requires it. |

## Regulation and legal copy

| Variable | Scope | Description |
|---|---|---|
| `COMPANY_JURISDICTION` | Server | Jurisdiction line for legal pages/footer. Empty = hidden. |
| `COMPANY_REGULATOR` | Server | Regulator name shown in legal disclosures. Empty = hidden. |
| `COMPANY_LICENSE_NUMBER` | Server | License number shown in legal disclosures. Empty = hidden. |
| `COMPANY_REGISTRATION_NUMBER` | Server | Company registration number shown in legal disclosures. Empty = hidden. |
| `INVESTOR_COMPENSATION_SCHEME` | Server | Investor-compensation scheme wording for legal pages. Empty = hidden. |

## Payments and demo funding

| Variable | Required | Purpose |
|---|---:|---|
| `DEPOSIT_WALLET_ADDRESSES` | No | JSON map of per-method deposit destination addresses shown to customers (admin settings defaults). Unset = none shown. |
| `DEMO_STARTING_BALANCE` | No | USD demo starting balance credited to each new registration via the ledger. `0`/unset = start empty. |

## Platform ↔ CRM bridge

| Variable | Required | Purpose |
|---|---:|---|
| `CRM_BRIDGE_TOKEN` | Platform (main app) | **Secret.** Shared bearer token the CRM presents to the platform's `/api/internal/crm/*` read-only bridge. Unset = bridge disabled (503). |
| `PLATFORM_BRIDGE_URL` | CRM | Base URL of the platform's internal bridge the CRM calls for client-360 data. |
| `PLATFORM_BRIDGE_TOKEN` | CRM | **Secret.** Bearer token the CRM sends to the platform bridge (same value as the platform's `CRM_BRIDGE_TOKEN`). |

## CRM email and storage

| Variable | Required | Purpose |
|---|---:|---|
| `SMTP_URL` | CRM | `smtp://user:pass@host:port` connection URL for the CRM's outbound email (record-page compose). Unset = email sending disabled. |
| `SMTP_FROM` | CRM | From address for CRM outbound email. |
| `ATTACHMENT_STORAGE_DIR` | CRM | Filesystem directory for CRM attachment storage. Default: `uploads/attachments`. |

## Malware-scanning sidecar (deploy/scanner)

| Variable | Scope | Description |
|---|---|---|
| `SCANNER_TOKEN` | Scanner + platform | **Secret.** Shared bearer token between the platform and the ClamAV scan sidecar. |
| `CLAMD_HOST` | Scanner | clamd hostname. Default: `clamav`. |
| `CLAMD_PORT` | Scanner | clamd port. Default: `3310`. |
| `CLAMD_TIMEOUT_MS` | Scanner | Idle timeout per scan in milliseconds. Default: `120000`. |
| `MAX_BODY_BYTES` | Scanner | Request body cap for scan submissions. Default: `33554432` (32 MiB). |

## Operations

| Variable | Required | Purpose |
|---|---:|---|
| `EMAIL_DELIVERY_ENABLED` | Server | Set `false` to disable the platform's email dispatcher (queueing still records deliveries as skipped). Default: `true`. |
| `LOG_LEVEL` | Server | Structured log level: `debug`, `info`, `warn` or `error`. Default: `info` in production, `debug` otherwise. |
| `MAINTENANCE_ENABLED` | Server | Enables the periodic retention-maintenance sweep (expired tokens/sessions, read notifications, terminal email deliveries, KYC retention). Default: `true` in production only. |
| `MAINTENANCE_INTERVAL_MS` | Server | Sweep interval, minimum 3,600,000 (1 hour). Default: `21600000` (6 hours). |
| `PHASE8_RELEASE_ARCHIVE` | Release tooling | Output path for `npm run test:release`. Default: `artifacts/phase8/blckforest-release.zip`. |
