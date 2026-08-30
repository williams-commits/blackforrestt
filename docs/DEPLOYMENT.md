# Deployment guide

This is the **single source of truth** for deploying, updating, operating, and
troubleshooting Black Forest Digital. It supersedes `DOCKER_SETUP.md`,
`HOSTINGER_DEPLOY.md`, `startup.md`, `FIX_DOCKER.md`, and `backup-restore.md`
(those files have been removed; everything you need is here).

For specialized procedures, this guide cross-references:
- [`MULTI_DOMAIN_SETUP.md`](MULTI_DOMAIN_SETUP.md) — serving multiple brand families (e.g. agilefgs.com) from one deployment; per-brand theming, wallets, referral links, SEO
- [`MULTI_BRAND_SECURITY.md`](MULTI_BRAND_SECURITY.md) — the security tradeoffs of the shared architecture (sessions, throttling, revocation)
- [`EMAIL_SETUP.md`](EMAIL_SETUP.md) — transactional email configuration
- [`ENVIRONMENT_VARIABLES.md`](ENVIRONMENT_VARIABLES.md) — full variable reference
- [`PAYMENT_WORKFLOWS.md`](PAYMENT_WORKFLOWS.md) — deposit/withdrawal operations
- [`runbooks/`](runbooks/) — incident response, key rotation, provider outage, rollback

---

## Quick reference

> Every `docker compose` command in production requires two flags. Without
> them you will get `MINIO_ROOT_USER is missing a value` or `env file
> .env.production not found`. See [Why `--env-file` is mandatory](#why---env-file-is-mandatory).

```bash
# Define once per shell session (or add to ~/.bashrc on the server):
export DC="docker compose --env-file .env.production -f deploy/docker-compose.prod.yml"

# Deploy (first time or code/env change — builds, migrates, seeds, starts):
bash deploy/deploy.sh

# Status of all services:
$DC ps

# Tail app + proxy logs:
$DC logs -f app caddy

# Restart only the app (no rebuild, no reseed):
$DC restart app
```

---

## Architecture

```
Internet → Caddy (80/443, automatic HTTPS) → app:3000 (Next.js + WebSocket)
                                                 ├── postgres:5432  (internal only)
                                                 ├── redis:6379     (internal only)
                                                 └── minio:9000     (internal only)
```

| Service  | Image                         | Purpose                                           | Public port |
|----------|-------------------------------|---------------------------------------------------|-------------|
| `caddy`  | `caddy:2.10-alpine`           | HTTPS termination, reverse proxy, HTTP/3          | 80, 443     |
| `app`    | local multi-stage `node:22`   | Next.js HTTP, Auth.js, WebSocket gateway, engine  | (none)      |
| `postgres` | `postgres:17-alpine`        | Prisma database, double-entry ledger              | (none)      |
| `redis`  | `redis:7-alpine`              | Security throttles, scheduler lease, locks        | (none)      |
| `minio`  | `quay.io/minio/minio`         | Private KYC + payment-proof object storage        | (none)      |
| `minio-init` | `quay.io/minio/mc`        | One-shot bucket creation + encryption policy      | (none)      |

**Three Docker networks:**
- `edge` — Caddy ↔ app (public traffic)
- `backend` — app ↔ postgres/redis/minio (internal-only, `internal: true`)
- `egress` — app → external APIs (email, market-data, scanner)

**Constraints:**
- **Single replica only.** The trading engine is process-local (in-memory
  positions mirrored to PostgreSQL). Do not scale `app` beyond 1 — see the
  warning at the top of `src/server/engine/hub.ts`.
- PostgreSQL, Redis, and MinIO are **never** exposed publicly. They live on
  the internal `backend` network.
- Caddy depends on `app: service_healthy`. If the app never reports healthy,
  Caddy never starts and ports 80/443 stay closed. This cascade is the most
  common outage cause — see [Troubleshooting](#troubleshooting).

---

## Domain split (marketing + trade subdomain)

The platform serves **brand families** — an apex (marketing) plus a trade
subdomain (authenticated app) per brand — from one deployment. See
[`MULTI_DOMAIN_SETUP.md`](MULTI_DOMAIN_SETUP.md) for adding further brands
(e.g. `agilefgs.com`); this section covers the primary family:

| Domain | Routes | Purpose |
|--------|--------|---------|
| `blackforrestt.com` (apex) | `/`, `/about`, `/analytics/*`, `/tools/*`, `/education/*`, `/legal/*`, `/api/instruments`, `/api/health` | Marketing site + live market data for the landing page |
| `trade.blackforrestt.com` | `/login`, `/register`, `/trade/[symbol]`, `/account`, `/reports`, `/admin`, `/api/auth/*`, `/api/account/*`, etc. | Authenticated application |

Both domains are served by the **same Next.js app** (one container, port 3000). Caddy routes each domain to `app:3000`; the app's **middleware** enforces which routes belong on which domain, redirecting users who land on the wrong origin:

- `blackforrestt.com/account` → 307 redirect to `trade.blackforrestt.com/account`
- `trade.blackforrestt.com/about` → 307 redirect to `blackforrestt.com/about`

Domain routing is only enforced when `BRAND_DOMAIN` is set. Local development on `localhost` / `127.0.0.1` bypasses it entirely.

### Setup (first time)

**1. Create a DNS A record for the trade subdomain:**

| Record | Host | Value |
|--------|------|-------|
| A | `trade` | `<server IP>` (same as the apex) |

Caddy automatically obtains a separate TLS certificate for the subdomain.

**2. Configure `.env.production`:**

```env
# Apex domain (marketing):
DOMAIN=blackforrestt.com

# Trade subdomain (authenticated app):
TRADE_DOMAIN=trade.blackforrestt.com
TRADE_SUBDOMAIN=trade

# Both origins must be in APP_ORIGIN (comma-separated — the origin gate
# already supports this):
APP_ORIGIN=https://blackforrestt.com,https://trade.blackforrestt.com

# Auth.js canonical origin = the PRIMARY trade subdomain. Keep it set:
# per-host login works via AUTH_TRUST_HOST=true, and client sign-outs
# self-navigate so logout never bounces across brand families.
AUTH_URL=https://trade.blackforrestt.com
AUTH_TRUST_HOST=true

# Multi-brand list (canonical first) + the origin gate allowlist:
BRAND_DOMAINS=blackforrestt.com
APP_ORIGIN=https://blackforrestt.com,https://trade.blackforrestt.com
```

> `NEXT_PUBLIC_TRADE_ORIGIN` is **no longer used** — marketing CTAs are
> relative links and the middleware routes each brand family to its own
> trade host. Do not set it.

**3. Rebuild + redeploy** (Caddy's config is rendered from the env by `deploy/render-caddy.sh`, so a rebuild re-provisions TLS for any new host):

```bash
docker compose --env-file .env.production -f deploy/docker-compose.prod.yml build --no-cache app
bash deploy/deploy.sh
```

### Single-domain mode (backward compatible)

If `TRADE_DOMAIN` is empty, the platform runs in single-domain mode: all
routes are served on the apex domain and no cross-domain redirects occur.
This is the default for local development.

### Session cookies

Auth.js v5 with JWT strategy scopes the session cookie to the host that the login request hits. Since login happens on `trade.blackforrestt.com`, the cookie is scoped to that subdomain — it does not leak to the marketing site. No cross-subdomain cookie sharing is required.

### How the links work

- **Marketing → trade:** landing CTAs are relative links (`/login`,
  `/register`); the middleware redirects them to the requesting family's
  trade host. Never link absolutely to a trade host from marketing — that
  bypasses family routing.
- **Trade → marketing:** the logo and footer derive the apex from the
  current hostname, so each brand family links back to its own marketing
  site.

---

## Server requirements

- **OS:** Ubuntu 22.04 or 24.04 LTS (or any Linux with Docker support)
- **Resources:** ≥4 CPU cores, ≥8 GB RAM, ≥40 GB SSD
- **Software:** Docker Engine + Compose plugin v2
- **DNS:** `A`/`AAAA` record for your domain pointing to the server IP
- **Firewall:** inbound TCP 22 (SSH), 80 (HTTP), 443 (HTTPS); UDP 443 optional (HTTP/3)
- **Outbound:** the app needs HTTPS egress to your email provider, market-data
  provider, and malware scanner

---

## First-time deployment

### 1. Install Docker

```bash
ssh root@your-server-ip
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
docker --version && docker compose version
```

### 2. Clone the repository

```bash
cd /opt
git clone git@github.com:your-org/blackforrestt.git
cd blackforrestt
```

> For a private repo, use a deploy key or personal access token.

### 3. Configure the firewall

```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

### 4. Create `.env.production` with generated secrets

The tracked template `deploy/.env.production.example` contains **placeholders
only** — never real secrets. Copy it, then generate fresh secrets:

```bash
cp deploy/.env.production.example .env.production
chmod 600 .env.production
```

Generate all required secrets at once and inject them:

```bash
PG_PWD=$(openssl rand -hex 24)
AUTH=$(openssl rand -hex 32)
FEK=$(openssl rand -base64 32)
PEPPER=$(openssl rand -hex 32)
MINIO_USER="bf-$(openssl rand -hex 6)"
MINIO_PWD=$(openssl rand -hex 24)

sed -i \
  -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$PG_PWD|" \
  -e "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://blackforrestt:$PG_PWD@postgres:5432/blackforrestt?schema=public|" \
  -e "s|^AUTH_SECRET=.*|AUTH_SECRET=$AUTH|" \
  -e "s|^FIELD_ENCRYPTION_KEY=.*|FIELD_ENCRYPTION_KEY=$FEK|" \
  -e "s|^SECURITY_HASH_PEPPER=.*|SECURITY_HASH_PEPPER=$PEPPER|" \
  -e "s|^MINIO_ROOT_USER=.*|MINIO_ROOT_USER=$MINIO_USER|" \
  -e "s|^MINIO_ROOT_PASSWORD=.*|MINIO_ROOT_PASSWORD=$MINIO_PWD|" \
  -e "s|^S3_ACCESS_KEY_ID=.*|S3_ACCESS_KEY_ID=$MINIO_USER|" \
  -e "s|^S3_SECRET_ACCESS_KEY=.*|S3_SECRET_ACCESS_KEY=$MINIO_PWD|" \
  .env.production
```

Now edit the remaining values that only you can set:

```bash
nano .env.production
```

**Must set (the app will not start without these):**

| Variable | Value |
|----------|-------|
| `DOMAIN` | `yourdomain.com` |
| `APP_ORIGIN` | `https://yourdomain.com` |
| `AUTH_URL` | `https://yourdomain.com` |
| `CADDY_EMAIL` | `ops@yourdomain.com` |
| `RESEND_API_KEY` | your real Resend key (`re_...`) |
| `EMAIL_FROM` | `Black Forest <noreply@yourdomain.com>` |
| `MALWARE_SCANNER_URL` | your scanner gateway URL (required when `KYC_SCANNER=http`) |
| `MALWARE_SCANNER_TOKEN` | your scanner token |

**Recommended for initial deploy (avoids Finnhub rate-limit issues):**

```env
MARKET_DATA_MODE=simulation
FINNHUB_CANDLE_MODE=disabled
```

The simulator prices all instruments from their seeded `basePrice`. You can
switch to a live feed (`finnhub`, `tickerlayer`, etc.) later — see
[Troubleshooting: Finnhub 429](#finnhub-429-reconnect-storm--app-unhealthy).

Verify no placeholders remain:

```bash
grep -E "replace-with|resend_api_key_goes_here" .env.production
# (no output = all secrets filled in)
```

> ⚠️ **Never** commit `.env.production`. It is gitignored (`.gitignore` line 6).
> Only `deploy/.env.production.example` is tracked, and it must contain only
> placeholders — see [Secret safety](#secret-safety--git-push-protection).

### 5. Deploy

```bash
bash deploy/deploy.sh
```

**What `deploy.sh` does (in order):**

| Step | Command | Purpose |
|------|---------|---------|
| 1 | `config --quiet` | Validate the compose file + env interpolation |
| 2 | `pull postgres redis minio minio-init caddy` | Fetch pinned dependency images |
| 3 | `build --pull app` | Build the app image (multi-stage, `node:22-alpine`) |
| 4 | `up -d postgres redis minio minio-init` | Start dependencies, wait for healthchecks |
| 5 | `run --rm app npx prisma migrate deploy` | Apply database schema migrations |
| 6 | `run --rm app npm run db:seed` | **Seed tradeable instruments** (idempotent upsert) |
| 7 | `run --rm app npm run production:check` | Fail-closed preflight (rejects placeholders) |
| 8 | `up -d app caddy` | Start app, wait for health, then start Caddy |
| 9 | health poll | Waits up to 150s for `https://DOMAIN/api/health` |

> **Step 6 is critical.** Without seed data, `hub.init()` throws
> *"No active instruments found"* at boot, the app never becomes healthy,
> Caddy never starts, and ports 80/443 stay closed. The seed is idempotent
> (upsert by symbol), so re-running it is always safe.

### 6. Verify

```bash
# All services healthy/running:
$DC ps

# Ports 80/443 bound by Caddy:
sudo ss -ltnp | grep -E ':80|:443'

# Public health endpoint (expect {"status":"ready","engine":"up"}):
curl -sS https://blackforrestt.com/api/health
```

### 7. Bootstrap admin access (first TWO admins)

No admin is seeded. Register accounts at `https://yourdomain.com/register`
first, then promote. The **maker-checker** Approvals flow needs two
operators — a maker cannot approve their own request — so bootstrap the
first two via the script, then manage every admin afterwards from the UI.

**Preferred: the audited promote script** (idempotent; sets `isAdmin`,
clears soft-delete/suspend/block, writes an `ADMIN_PROMOTED` audit event):

```bash
$DC exec app node --import tsx scripts/promote-admin.ts <email>
# run twice — once for each of your first two admins
```

**Alternative: raw SQL** (unaudited; remember boolean `true` has no quotes
and values use single quotes — double quotes are identifiers in PostgreSQL):

```bash
$DC exec -T postgres psql -U blackforrestt -d blackforrestt <<'SQL'
UPDATE "User"
SET "isAdmin" = true, "deletedAt" = NULL, "suspendedAt" = NULL, "blockedAt" = NULL
WHERE "email" = '<your-admin-email>';
SQL
```

**From the third admin onwards — no shell access needed:**

1. Admin console → **Users** tab → target user's kebab menu (⋮) →
   **Grant admin role**
2. The Approvals composer opens pre-filled with the target; pick the role
   (SUPER_ADMIN, COMPLIANCE, FINANCE, DEALER, RISK, SUPPORT, AUDITOR) and
   submit as the maker
3. A **different** admin approves it in **Approvals** — approval creates the
   role assignment AND sets `isAdmin = true`, fully audit-chained
4. Revoke works the same way ("Revoke admin role"); the last active
   SUPER_ADMIN role cannot be revoked as a safety guard

> An admin is anyone with `isAdmin = true` **or** an active role assignment
> (`requireAdminContext`). Both signals authorize the console and receive
> customer support chat — keep that in mind before revoking.

**Common bootstrap failure:** customer chat returns
`{"error":"No support operator available."}` (503) when the database has no
active admin. Promote one (see above) and it resolves immediately.

---

## Routine update workflow

When you pull new code or change `.env.production`:

```bash
cd /opt/blackforrestt
git pull origin main
docker compose --env-file .env.production -f deploy/docker-compose.prod.yml build --no-cache app

# If only .env.production is changed
docker compose --env-file .env.production -f deploy/docker-compose.prod.yml up -d --no-deps --force-recreate app

# Always back up before deploying:
./deploy/backup.sh

# Rebuild + redeploy:
bash deploy/deploy.sh
```

`deploy.sh` always rebuilds the app image (`build --pull app`), so code changes
are picked up. It also re-runs migrations and the seed (both idempotent).

**If you only changed `.env.production`** (no code change), a faster path:

```bash
$DC up -d --no-deps app   # recreate app container with new env
```

Wait ~60s for the health check (`start_period: 45s`), then verify health.

---

## Why `--env-file` is mandatory

This is the **#1 source of operator errors**. There are two separate mechanisms
that both require `.env.production`:

1. **`${VAR:?}` interpolation** — the compose file declares variables like
   `${MINIO_ROOT_USER:?Set MINIO_ROOT_USER}`. Without `--env-file`, these have
   no value and Compose refuses to run *any* command, including `down`:
   ```
   error while interpolating services.minio.environment.MINIO_ROOT_USER:
   required variable MINIO_ROOT_USER is missing a value
   ```

2. **`env_file: ../.env.production`** (compose line 98) — the app service
   injects the full environment from this literal file. The file must
   **physically exist** at the repo root or Compose fails:
   ```
   env file .env.production not found
   ```

**Every manual command needs both flags:**

```bash
docker compose --env-file .env.production -f deploy/docker-compose.prod.yml <command>
```

The `deploy.sh` script handles this for you (line 4). You only need the flags
for manual commands. Tip: set an alias on the server:

```bash
echo 'alias dcprod="docker compose --env-file .env.production -f deploy/docker-compose.prod.yml"' >> ~/.bashrc
source ~/.bashrc
# Now: dcprod ps, dcprod logs app, dcprod restart app
```

---

## Operations

> All commands assume you're in the repo root (`/opt/blackforrestt`) with
> `.env.production` present. `$DC` is the alias from [Quick reference](#quick-reference).

### Status

```bash
$DC ps                           # all services + health
docker ps -a --format '{{.Names}}\t{{.Status}}'   # every container on host
docker compose ls                # every compose project (catch duplicates)
```

### Logs

```bash
$DC logs -f app                  # tail app logs
$DC logs -f caddy                # tail proxy logs (TLS, requests)
$DC logs --tail=100 app          # last 100 lines
$DC logs --since 10m app         # last 10 minutes
```

### Database access (psql / Prisma Studio)

**Raw SQL** (quickest — double quotes are identifiers, single quotes are
values, booleans unquoted):

```bash
$DC exec postgres psql -U blackforrestt -d blackforrestt
```

**Prisma Studio** (visual browser) — bind to loopback and SSH-tunnel;
never expose port 5555 to the internet, and remember Studio is read/write
on live data with no confirmation prompts:

```bash
# on the server:
$DC run --rm --no-deps -p 127.0.0.1:5555:5555 app \
  npx prisma studio --hostname 0.0.0.0 --port 5555

# on your machine:
ssh -L 5555:localhost:5555 you@your-server   # then open http://localhost:5555
```

**One-off scripts in the app container** (Prisma + tsx are in the image;
DATABASE_URL is in the container env):

```bash
$DC exec app node --import tsx scripts/promote-admin.ts <email>
$DC run --rm app npx prisma migrate deploy
```

### Restart the app only

```bash
$DC restart app
```

This does **not** rebuild or reseed — use it for a clean restart after a crash.

### Authentication readiness check

```bash
$DC exec app npm run auth:doctor
```

Verifies the Auth.js origin, database connectivity, identity tables, seeded
accounts, password hashes, verification/lock state, admin role assignment,
and Redis. It never prints passwords.

### Access PostgreSQL

See [Database access (psql / Prisma Studio)](#database-access-psql--prisma-studio)
above — interactive shell, single queries, Studio over an SSH tunnel, and
one-off scripts all covered there. Useful `psql` commands: `\dt` (list
tables), `\d "User"` (describe table), `\q` (quit).

### Inspect Redis

```bash
$DC exec redis redis-cli ping                          # expect PONG
$DC exec redis redis-cli --scan --pattern 'reconciliation:*'
```

### Inspect MinIO

The MinIO console is internal-only in production. To access it, port-forward
temporarily:

```bash
$DC exec minio mc admin info local   # requires mc, or use a tunnel
# Or from your local machine:
ssh -L 9001:localhost:9001 root@your-server-ip
# Then open http://localhost:9001 (creds: MINIO_ROOT_USER/MINIO_ROOT_PASSWORD)
```

---

## Backup and restore

### Backup

```bash
./deploy/backup.sh
```

Creates `backups/<UTC-timestamp>/` containing:
- `postgres.dump` — full database (custom format)
- `redis-dump.rdb` — Redis snapshot
- `minio-data.tar.gz` — all MinIO objects
- `SHA256SUMS` — integrity checksums
- `METADATA` — timestamp + db name

**Copy each backup to encrypted off-server storage.** A backup on the same
host is not a recovery mechanism if the host fails.

#### Schedule it (cron)

Backups are only a control if they run without a human remembering. On the
host, install a nightly 04:00 UTC run plus an off-server copy:

```cron
0 4 * * *  cd /opt/blackforrestt && ./deploy/backup.sh >> backups/cron.log 2>&1 && rsync -a --remove-source-files backups/ backup-user@offsite:/srv/blackforrestt-backups/
```

- The script is idempotent and safe to overlap (timestamped directories).
- Verify the cron actually fires after installing it (`backups/cron.log`).
- **Rehearse a restore quarterly** on a staging host: `CONFIRM_RESTORE=YES
  ./deploy/restore.sh <dir>` — an untested backup is a hope, not a control.
- Off-site copies must be encrypted at rest (encrypted volume or `age`/
  `gpg`-encrypted archive).

### Restore (destructive — requires confirmation)

```bash
CONFIRM_RESTORE=YES ./deploy/restore.sh backups/20260803T040000Z
```

The restore script:
1. Verifies checksums (`sha256sum -c`)
2. Stops public traffic (caddy + app)
3. Restores PostgreSQL, Redis, and MinIO volumes
4. Reapplies migrations
5. Restarts app + caddy

After restore, run `auth:doctor`, review reconciliation, and run browser
smoke tests before reopening traffic. See [`runbooks/release-rollback.md`](runbooks/release-rollback.md).

---

## Troubleshooting

> **Start here when anything is wrong.** These are real incidents, ordered
> by how they cascade. Run the [diagnostic block](#diagnostic-block) first.

### Diagnostic block

Run this **first** when the site is down or the app is unhealthy. It pinpoints
which layer is failing in under 30 seconds:

```bash
echo "=== 1. Is deploy.sh the current version (has seed step)? ==="
grep -q "db:seed" deploy/deploy.sh && echo "✓ seed step present" || echo "✗ OLD deploy.sh — git pull"

echo "=== 2. Why is the app failing? (last 40 log lines) ==="
$DC logs --tail=40 app

echo "=== 3. Did instruments get seeded? (expect 45) ==="
$DC exec -T postgres psql -U blackforrestt -d blackforrestt -c \
  'SELECT COUNT(*) AS instruments FROM "Instrument";'

echo "=== 4. App container status (restart-looping?) ==="
docker ps -a --filter "name=app" --format '{{.Names}}\t{{.Status}}'

echo "=== 5. What does the health endpoint say? ==="
$DC exec app node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>r.text()).then(console.log).catch(e=>console.error(e.message))"

echo "=== 6. Are 80/443 bound? ==="
sudo ss -ltnp | grep -E ':80|:443' || echo "(nothing on 80/443 — Caddy not started)"
```

### Symptom → cause → fix

| Symptom | Root cause | Fix |
|---------|-----------|-----|
| App `Restarting (1)` / crash loop | `hub.init()` throws — no seed data | `bash deploy/deploy.sh` (runs seed), or `$DC run --rm app npm run db:seed` |
| App `Up (unhealthy)`, no crash | `/api/health` returns 503 | Check the health body (diagnostic #5) — see rows below |
| Health: `engine: starting`, instruments=45 | **Hub singleton split** (server.ts vs Next route each get their own instance) | Verify `hub.ts` line ~1425 has `hubGlobal.__blckforest_hub = hub;` (not gated on NODE_ENV). Rebuild: `$DC up -d --build app` |
| Health: `engine: down`, instruments=0 | Seed never ran | `$DC run --rm app npm run db:seed` |
| Health: `database: unknown` | DB query throwing | Check `$DC logs app` for Prisma errors; verify `DATABASE_URL` hostname is `postgres` (not localhost) |
| Health: `redis: unknown` | Redis query throwing | `$DC exec redis redis-cli ping`; check `REDIS_URL` |
| `MINIO_ROOT_USER is missing a value` | Missing `--env-file` flag | Add `--env-file .env.production` to every manual compose command |
| `env file .env.production not found` | File doesn't exist at repo root | `cp deploy/.env.production.example .env.production` + edit |
| Ports 80/443 closed, Caddy shows `Created` | App not healthy → Caddy never starts (dependency cascade) | Fix the app health first (rows above); Caddy starts automatically once app is healthy |
| `trade.blackforrestt.com` won't load (apex works) | Missing DNS A record for `trade` subdomain, or `TRADE_DOMAIN` not set in `.env.production` | Add A record `trade → server IP`; set `TRADE_DOMAIN=trade.blackforrestt.com` in `.env.production`; restart Caddy: `$DC up -d --no-deps caddy` |
| Marketing CTA links relatively and stays on the apex | Expected — the middleware routes each brand family's `/login` to its own trade host at request time | None needed; verify `BRAND_DOMAINS` includes the host |
| Caddy up but TLS cert fails | DNS A record wrong, or 80/443 blocked by firewall | Verify `dig yourdomain.com` → server IP; check `ufw status`; `$DC logs caddy` for ACME errors |
| Finnhub `429` reconnect storm in logs | Free-tier Finnhub rate-limiting the server IP | Set `MARKET_DATA_MODE=simulation`, `$DC up -d --no-deps app` |
| Preflight failure on startup | Placeholder secret, or dev bypass enabled | `$DC run --rm app npm run production:check` — read each failure line |
| Push Protection blocks `git push` | Real secret in tracked `.example` file | See [Secret safety](#secret-safety--git-push-protection) |
| Customer chat returns `No support operator available.` (503) | No **active** admin in the database (none with `isAdmin = true` or an active role assignment, or the only one is deleted/suspended/blocked) | `$DC exec app node --import tsx scripts/promote-admin.ts <email>` |
| `Cannot find module '/app/scripts/promote-admin.ts'` | Image built before the Dockerfile fix that copies ops scripts | `git pull` → rebuild the app image → redeploy |
| Login/Register pages show the wrong brand | Stale app image (branding is code, resolved per request) | `git pull` → `build app` → `up -d app caddy` |
| Logout on one brand lands on the other brand | Old build — sign-outs self-navigate in current code | Redeploy the app image |

### App unhealthy / restart loop

**Cause:** The most common outage. Usually means `hub.init()` threw because the
`Instrument` table is empty (seed never ran), so the production process aborts
at `server.ts:35-37` and Docker restarts it.

**Confirm:**
```bash
$DC exec -T postgres psql -U blackforrestt -d blackforrestt -c \
  'SELECT COUNT(*) FROM "Instrument";'
# 0 = seed missing; 45 = seed OK (problem is elsewhere)
```

**Fix:** If count is 0, run the seed:
```bash
$DC run --rm app npm run db:seed
$DC restart app
```

### `/api/health` returns 503 with `engine: starting` (but 45 instruments)

**Cause:** The hub singleton is split across the custom server (`server.ts`)
and the Next.js bundled API routes. `server.ts` initializes the hub (45
instruments), but the route handler imports a separate, empty instance whose
`isReady()` returns false. This is caused by the `globalThis` cache write
being gated on `NODE_ENV !== "production"`.

**Confirm:**
```bash
$DC exec app node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>r.text()).then(console.log)"
# {"status":"starting","database":"up","redis":"up","engine":"starting"}
# (DB + Redis up, but engine never ready = singleton split)
```

**Fix:** Verify `src/server/engine/hub.ts` has the unconditional cache write
(not gated on NODE_ENV), then rebuild:
```bash
grep "hubGlobal.__blckforest_hub = hub" src/server/engine/hub.ts
$DC up -d --build app
```

### Finnhub `429` reconnect storm / app unhealthy

**Cause:** Finnhub free-tier rate-limits the server IP. The feed client
reconnects every ~1-2s, logging a wall of `📡 Finnhub WS error: 429` and
`Reconnecting in Ns` messages. This can saturate the event loop and cause the
health check to time out.

**Confirm:** Check app logs for the `429` / `Reconnecting` pattern:
```bash
$DC logs --tail=80 app | grep -E "429|Reconnecting|Finnhub"
```

**Fix:** Switch to simulation mode (the engine prices all instruments from
seeded `basePrice` — simulation produces realistic behavior):
```bash
sed -i 's|^MARKET_DATA_MODE=.*|MARKET_DATA_MODE=simulation|' .env.production
sed -i 's|^FINNHUB_CANDLE_MODE=.*|FINNHUB_CANDLE_MODE=disabled|' .env.production
$DC up -d --no-deps app
```

To use a live feed later, set `MARKET_DATA_MODE` to `tickerlayer`, `sifting`,
`lse`, or `alphavantage` with a working API key for that provider.

### Caddy never starts / ports 80/443 closed

**Cause:** Caddy has `depends_on: app: condition: service_healthy`. If the app
never reports healthy, Caddy stays in `Created` state and never binds 80/443.
This is a **cascade**, not a Caddy bug — fix the app health first using the
rows above.

**Confirm:**
```bash
$DC ps    # if app shows (unhealthy) and caddy shows Created, it's the cascade
```

**Once the app is healthy**, Caddy starts automatically. If Caddy is running
but TLS fails, check:
```bash
dig yourdomain.com          # A record must point to server IP
ufw status                  # 80 and 443 must be allowed
$DC logs caddy              # look for ACME/certificate errors
```

Caddy obtains Let's Encrypt certificates automatically on first boot. Port 80
must be open for the HTTP-01 challenge.

### Preflight failure

The production preflight (`scripts/production/preflight.mjs`) runs before the
app starts and refuses to launch if any check fails:

```bash
$DC run --rm app npm run production:check
```

Common failures:
- `AUTH_SECRET still contains a placeholder` — you left `replace-with-*` in `.env.production`
- `REGISTRATION_REQUIRE_EMAIL_VERIFICATION must be true` — inline `//` comment after the value (dotenv reads the whole line)
- `KYC_SCANNER must be http in production` — set `KYC_SCANNER=http` + `MALWARE_SCANNER_URL`
- `DEV_EMAIL_PREVIEW must be false` — check the value is literally `false` with no comment
- `EMAIL_PROVIDER must be resend or http` — set one and provide its required keys

### WebSocket not connecting

Caddy proxies `/ws` automatically (it handles the upgrade). If WS fails:
- Ensure `APP_ORIGIN` and `AUTH_URL` use `https://`
- Check `$DC logs caddy` for proxy errors
- The browser connects to `wss://yourdomain.com/ws` (same origin)

---

## Secret safety & Git Push Protection

**Never put real secrets in any tracked file.** Only `.env.production` (gitignored)
should contain real values. The tracked `deploy/.env.production.example` must
contain only `replace-*` placeholders.

GitHub Push Protection scans every commit on push. If a real secret (Resend key,
DB password, API key) is in the diff — **even on a removal line** — the push is
rejected. If this happens:

1. **Do not click "allow secret"** — that publishes the live key.
2. Scrub the secret from the tracked file (replace with placeholder).
3. If the secret is already in pushed history, force-push a clean rewrite, or
   create a fresh repo. See [`runbooks/key-rotation.md`](runbooks/key-rotation.md).
4. **Rotate the exposed secret** at its provider regardless — anything that was
   in git history should be considered compromised.

Inline `//` comments in `.env` files are a known footgun: dotenv reads the entire
line after `=` as the value, so `KEY=true // comment` becomes the string
`"true // comment"`, which fails strict equality checks. **Never add inline
comments to env values.** Put comments on their own `#` line.

---

## Environment variable reference

The canonical, fully-commented template is [`deploy/.env.production.example`](../deploy/.env.production.example).
For the complete variable reference, see [`ENVIRONMENT_VARIABLES.md`](ENVIRONMENT_VARIABLES.md).

**Critical/security variables:**

| Variable | Generate with | Notes |
|----------|---------------|-------|
| `POSTGRES_PASSWORD` | `openssl rand -hex 24` | Must match the password in `DATABASE_URL` |
| `AUTH_SECRET` | `openssl rand -hex 32` | Rotating invalidates all active sessions |
| `FIELD_ENCRYPTION_KEY` | `openssl rand -base64 32` | ⚠️ Rotating makes existing encrypted KYC data unreadable |
| `SECURITY_HASH_PEPPER` | `openssl rand -hex 32` | ⚠️ Rotating invalidates existing password hashes |
| `MINIO_ROOT_USER` | `bf-$(openssl rand -hex 6)` | Must equal `S3_ACCESS_KEY_ID` (bundled MinIO) |
| `MINIO_ROOT_PASSWORD` | `openssl rand -hex 24` | Must equal `S3_SECRET_ACCESS_KEY` (bundled MinIO) |
| `RESEND_API_KEY` | Resend dashboard | Required when `EMAIL_PROVIDER=resend` |
| `FINNHUB_API_KEY` | Finnhub dashboard | Required when `MARKET_DATA_MODE=finnhub` |

> ⚠️ `FIELD_ENCRYPTION_KEY` and `SECURITY_HASH_PEPPER` cannot be rotated without
> a data migration (encrypted fields become unreadable / password hashes
> invalidate). See [`runbooks/key-rotation.md`](runbooks/key-rotation.md).

---

## Security & production-readiness checklist

Before going live with real users:

- [ ] All secrets generated fresh (not placeholders) and stored only in `.env.production`
- [ ] `KYC_SCANNER=http` with a real `MALWARE_SCANNER_URL` (preflight rejects the stub)
- [ ] `DEV_EMAIL_PREVIEW=false` and `ALLOW_UNVERIFIED_WITHDRAWALS=false`
- [ ] `REGISTRATION_REQUIRE_EMAIL_VERIFICATION=true`
- [ ] Firewall configured (22, 80, 443 only; data services internal)
- [ ] Encrypted off-server PostgreSQL + MinIO backups, with a tested restore
- [ ] External monitoring + alerting on `/api/health` and logs
- [ ] SSH hardened (key-only auth, fail2ban, unattended security updates)
- [ ] No real secrets in git history (verified via `git log -S`)
- [ ] Reconciliation scheduler enabled (`RECONCILIATION_ENABLED=true`)
- [ ] Single-replica constraint understood (no horizontal scaling of `app`)

This repository is a simulation platform. Deployment does not convert it into
an approved real-money brokerage. Production activation requires licensed
execution, approved payment/KYC operations, penetration testing, legal/regulatory
approval, and operational sign-off.

---

## Rollback

1. Put the service in a maintenance window.
2. Check out the previous reviewed release tag:
   ```bash
   git checkout <previous-tag>
   ```
3. Restore the matching backup if the release included a data migration:
   ```bash
   CONFIRM_RESTORE=YES ./deploy/restore.sh backups/<pre-deploy-timestamp>
   ```
4. **Do not** run destructive Prisma development migrations (`migrate dev`).
   Only `migrate deploy` (committed migrations) is safe.
5. Start the previous release and verify `/api/health`, auth, WebSocket, and
   reconciliation.
6. See [`runbooks/release-rollback.md`](runbooks/release-rollback.md) and
   [`runbooks/incident-response.md`](runbooks/incident-response.md) for the
   full procedure.

---

## Local development

For local development (app on host, infrastructure in Docker):

```bash
cp .env.example .env
# Edit .env: replace the three secret placeholders with openssl output

npm ci
# Pull images 
docker compose pull postgres redis minio minio-init 
docker compose up -d postgres redis minio minio-init
npm run db:generate
npm run db:deploy
npm run db:seed
npm run auth:doctor
npm run dev
```

Open `http://localhost:3000`. The MinIO console is at `http://localhost:9001`.

> Local development uses the root `docker-compose.yml` (not the prod file).
> It uses default `blckforest` credentials and exposes ports 5432/6379/9000.
> **Never** use the local compose file in production.

To run everything in Docker locally:

```bash
docker compose up -d postgres redis minio minio-init
docker compose build app
docker compose run --rm app sh -c "npx prisma migrate deploy && npm run db:seed && npm run auth:doctor"
docker compose up -d app
docker compose logs -f app
```

Drop DB 
```bash
docker exec -it blackforrestt-postgres-1 psql -U blckforest   
```

Check if DB is running 
```bash
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='blckforest';
```

# List all databases in running postgres container
```bash
docker exec $(docker ps -q -f "ancestor=postgres:17-alpine") psql -U blackforrestt -l
```

# Connect to the database directly
```bash
docker exec -it $(docker ps -q -f "ancestor=postgres:17-alpine") psql -U blackforrestt -d blackforrestt
```

# Or if you know the container name (e.g., blackforrestt-postgres-1)
```bash
docker exec -it blackforrestt-postgres-1 psql -U blackforrestt -d blackforrestt
```

# 1. Stop containers and delete volumes (this nukes the database)
```bash
docker compose down -v --remove-orphans
```

# 2. Edit .env with new credentials
# (change POSTGRES_PASSWORD, DATABASE_URL, etc.)

# 3. Edit docker-compose.yml if needed (POSTGRES_USER, POSTGRES_DB, etc.)

# 4. Bring everything back up with fresh empty database
```bash
docker compose up -d
```

# 5. Run migrations to rebuild schema
```bash
npm run db:deploy
```

### Local login repair

If local login is stale after upgrading an older database:

```bash
npm run local:repair   # clears MFA/locks/throttles + runs auth:doctor
npm run dev
```

This refuses destructive resets when `NODE_ENV=production`.

### Finnhub free-plan behavior

```dotenv
# Fully deterministic local market data (recommended for development):
MARKET_DATA_MODE=simulation
FINNHUB_CANDLE_MODE=disabled
```

```dotenv
# Finnhub live WebSocket quotes + simulated historical candles:
MARKET_DATA_MODE=finnhub
FINNHUB_API_KEY=your-token
FINNHUB_CANDLE_MODE=auto
```

`auto` probes once and falls back silently on 401/403 (circuit breaker prevents
request floods). See [`ENVIRONMENT_VARIABLES.md`](ENVIRONMENT_VARIABLES.md) for
all market-data modes.
