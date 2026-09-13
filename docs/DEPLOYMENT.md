# Deployment guide — Make commands

This is the **single source of truth** for deploying, updating, operating, and
troubleshooting Black Forest Digital + CRM. Every operation below is a
`make` target run from the repository root on the server (`/opt/blackforrestt`) —
the Makefile wraps the underlying scripts (`deploy/*.sh`) and always passes the
mandatory compose flags for you.

The deployment serves **one or two domains from the same stack** — a single
brand (`blackforrestt.com` alone) or a dual-brand family (any second domain,
e.g. `agilefgs.com`). Both are pure `.env.production` configuration; no code or
Caddyfile edits are ever needed.

For specialized procedures, this guide cross-references:
[`MULTI_DOMAIN_SETUP.md`](MULTI_DOMAIN_SETUP.md) (brand families),
[`MULTI_BRAND_SECURITY.md`](MULTI_BRAND_SECURITY.md),
[`EMAIL_SETUP.md`](EMAIL_SETUP.md), [`ENVIRONMENT_VARIABLES.md`](ENVIRONMENT_VARIABLES.md),
[`PAYMENT_WORKFLOWS.md`](PAYMENT_WORKFLOWS.md), and [`runbooks/`](runbooks/).

---

## Quick reference — every make command

Run `make help` on the server for the same list. All targets work from any
directory (the Makefile resolves its own root).

### Deploy & lifecycle

| Command | What it does |
|---|---|
| `make deploy` | **Full deploy**: build all images, start dependencies, migrate + seed the platform DB, bootstrap/migrate the CRM DB, grant CRM permissions, run the fail-closed preflight, start the app + Caddy, wait for public health. This is the only command a first deploy and a code deploy both need. |
| `make update` | Routine code update: `git pull`, rebuild `app` + `crm` images, restart both + Caddy. |
| `make build` | Build production images (`app`, `malware-scanner`, `crm`). |
| `make build-no-cache` | Same, without the Docker layer cache (after big changes). |
| `make only-env` | Apply `.env.production` changes **without** a rebuild — force-recreates the app container. |
| `make restart-app` | Restart the app container only (no rebuild, no seed) — clean restart after a crash. |
| `make down` | Stop the entire production stack. |

### Status, logs & diagnostics

| Command | What it does |
|---|---|
| `make ps` | Status + health of every service. |
| `make logs` | Tail app + Caddy logs together. |
| `make log-app` / `make log-caddy` / `make log-crm` | Tail one service's logs. |
| `make health` | Curl the public health endpoint (`https://$DOMAIN/api/health`). |
| `make diagnose` | **Run this first when anything is wrong.** Six-layer diagnostic: deploy.sh freshness, app logs, instrument seed count, container restart state, in-container health body, and whether Caddy bound 80/443. |
| `make preflight` | The fail-closed production readiness gate (placeholder secrets, dev bypasses, scanner/email config). `make deploy` runs it; use this to re-check without deploying. |
| `make auth-doctor` | Verifies Auth.js origin, database connectivity, identity tables, seeded accounts, password hashes, admin roles, and Redis. Never prints passwords. |
| `make env-verify` | Fails if `.env.production` still contains any `replace-with-*` placeholders. |

### Databases (platform + CRM)

| Command | What it does |
|---|---|
| `make psql` | Interactive SQL shell in the **platform** database (`blackforrestt`). |
| `make crm-psql` | Interactive SQL shell in the **CRM** database (`blckforest_crm`). |
| `make migrate` | Apply pending platform Prisma migrations (`make deploy` already does). |
| `make crm-migrate` | Apply pending CRM Prisma migrations (`make deploy` already does). |
| `make seed` | Seed tradeable instruments — idempotent, required for the engine to boot. |
| `make crm-seed` | Bootstrap the CRM database (role defaults + first demo users). **Run once on a fresh install, then change every demo password immediately.** |
| `make crm-grant` | Roll out newly-introduced CRM role permissions additively (idempotent; never removes — Roles-UI customizations survive). `make deploy` already does. |
| `make studio` | Prisma Studio on `127.0.0.1:5555` — SSH-tunnel in (`ssh -L 5555:localhost:5555 host`). Read/write on live data; never expose the port. |
| `make promote-admin E=user@example.com` | Audited, idempotent admin promotion for the platform. |

### Backup & restore

| Command | What it does |
|---|---|
| `make backup` | Full backup: platform Postgres dump, Redis snapshot, MinIO objects, CRM attachments + checksums into `backups/<timestamp>/`. |
| `make restore` | **Destructive** restore — asks twice, requires `CONFIRM_RESTORE=YES`. Wraps `deploy/restore.sh` (as `make backup` wraps `deploy/backup.sh`). |

### Proxy (Caddy)

| Command | What it does |
|---|---|
| `make caddy-render` | Re-render `deploy/Caddyfile.rendered` from `.env.production` — one site block per non-empty domain var. Run after any domain change, then `make update`. |
| `make caddy-validate` | Validate the rendered config with the official Caddy image. |

### Local development

| Command | What it does |
|---|---|
| `make dev` | Platform dev server at `http://localhost:3000`. |
| `make test` / `make test-fast` | Full / quick test matrices. |
| `make lint` / `make typecheck` | ESLint (zero warnings) / TypeScript strict. |

---

## Architecture

```
Internet → Caddy (80/443, automatic HTTPS) → app:3000 (Next.js + WebSocket)
                                            → crm:3000  (CRM, crm.<domain>)
                 ├── postgres:5432  (blackforrestt + blckforest_crm)  internal only
                 ├── redis:6379     (throttles, scheduler leases)      internal only
                 ├── minio:9000     (KYC + payment-proof objects)       internal only
                 ├── clamav + malware-scanner                          internal only
```

| Service | Purpose | Public port |
|---|---|---|
| `caddy` | HTTPS termination, reverse proxy, HTTP/3 | 80, 443 |
| `app` | Platform: Next.js + Auth.js + WebSocket engine + trading hub | none |
| `crm` | CRM module (own database, own auth) | none (via `crm.<domain>`) |
| `postgres` / `redis` / `minio` / `clamav` / `malware-scanner` | data + scanning services | none |

**Three Docker networks:** `edge` (Caddy ↔ app/crm), `backend` (internal data
services, `internal: true`), `egress` (app → external APIs).

**Constraints:**
- **Single app replica only.** The trading engine holds positions in memory;
  never scale `app` beyond 1 (see the warning in `src/server/engine/hub.ts`).
- Data services are never exposed publicly; reach them through `make psql`,
  `make studio`, or SSH tunnels.
- Caddy depends on `app: service_healthy` — if the app never reports healthy,
  Caddy never starts and ports 80/443 stay closed. This cascade is the most
  common outage cause: run `make diagnose` first.

---

## Server requirements

- **OS:** Ubuntu 22.04/24.04 LTS (or any Linux with Docker support)
- **Resources:** ≥4 CPU cores, ≥8 GB RAM, ≥40 GB SSD
- **Software:** Docker Engine + Compose plugin v2, `make`, `git`
- **DNS:** A records for your domain(s) → server IP (tables below)
- **Firewall:** inbound TCP 22, 80, 443 (UDP 443 optional for HTTP/3)
- **Outbound:** HTTPS to your email provider, market-data provider, and (for
  inbound CRM email) your mail provider's webhook

---

## First-time deployment

### 1. Install Docker + clone

```bash
ssh root@your-server-ip
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
apt install -y make git
docker --version && docker compose version

cd /opt
git clone git@github.com:your-org/blackforrestt.git
cd blackforrestt
```

### 2. Firewall

```bash
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp
ufw --force enable
```

### 3. DNS — pick your deployment shape

**Option A — single domain (one brand):**

| Record | Host | Value |
|---|---|---|
| A | `@` (apex) | server IP |
| A | `www` | server IP (redirected to apex) |
| A | `trade` | server IP |
| A | `crm` | server IP (only if you want the CRM subdomain) |

**Option B — dual domain (two brands, same stack):** repeat the four records
for the second domain (e.g. `agilefgs.com`, `www.agilefgs.com`,
`trade.agilefgs.com`, `crm` optional). Caddy provisions TLS for every host
automatically.

### 4. Create `.env.production`

```bash
cp deploy/.env.production.example .env.production
chmod 600 .env.production
```

Generate and inject all secrets at once:

```bash
PG_PWD=$(openssl rand -hex 24); AUTH=$(openssl rand -hex 32)
FEK=$(openssl rand -base64 32); PEPPER=$(openssl rand -hex 32)
MINIO_USER="bf-$(openssl rand -hex 6)"; MINIO_PWD=$(openssl rand -hex 24)
CRM_AUTH=$(openssl rand -hex 32); INBOUND=$(openssl rand -hex 24)

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
  -e "s|^AUTH_SECRET_CRM=.*|AUTH_SECRET_CRM=$CRM_AUTH|" \
  -e "s|^INBOUND_EMAIL_TOKEN=.*|INBOUND_EMAIL_TOKEN=$INBOUND|" \
  .env.production
```

Then edit the values only you can set (`nano .env.production`):

**Must set (the app will not start without these):**

| Variable | Value |
|---|---|
| `DOMAIN` | `yourdomain.com` |
| `TRADE_DOMAIN` | `trade.yourdomain.com` (authenticated app host) |
| `APP_ORIGIN` | `https://yourdomain.com,https://trade.yourdomain.com` (every origin the platform answers on — see dual-domain below) |
| `AUTH_URL` | `https://trade.yourdomain.com` |
| `CADDY_EMAIL` | `ops@yourdomain.com` |
| `RESEND_API_KEY` + `EMAIL_FROM` | real email provider credentials |
| `MALWARE_SCANNER_URL` (+`TOKEN`) | required with the default `KYC_SCANNER=http` |

**Recommended for the first deploy:** `MARKET_DATA_MODE=simulation` and
`FINNHUB_CANDLE_MODE=disabled` (avoids Finnhub free-tier 429 storms; switch to
a live feed later).

**Dual domain only — add the second brand (Option B):**

```env
DOMAIN_2=theseconddomain.com
TRADE_DOMAIN_2=trade.theseconddomain.com
BRAND_DOMAINS=yourdomain.com,theseconddomain.com
APP_ORIGIN=https://yourdomain.com,https://trade.yourdomain.com,https://theseconddomain.com,https://trade.theseconddomain.com
# Optional per-brand identity (logo, support email, wallets…):
BRAND_OVERRIDES={"theseconddomain.com":{"name":"Second Brand","tradeEnabled":true}}
```

Leaving `DOMAIN_2`/`TRADE_DOMAIN_2` **empty (or absent)** disables the second
brand — the render step and middleware skip it cleanly. That is the entire
single ↔ dual switch: the `DOMAIN_N`/`TRADE_DOMAIN_N` pairs + `BRAND_DOMAINS`
+ appending the new origins to `APP_ORIGIN`. Add a third brand the same way
with `DOMAIN_3`/`TRADE_DOMAIN_3`.

**CRM module (both shapes):**

```env
CRM_DOMAIN=crm.yourdomain.com        # empty = CRM not routed publicly
CRM_DATABASE_URL=postgresql://blackforrestt:$PG_PWD@postgres:5432/blckforest_crm
AUTH_URL_CRM=https://crm.yourdomain.com
AUTH_SECRET_CRM=<generated above>    # MUST differ from AUTH_SECRET
CRM_BRIDGE_TOKEN=<openssl rand -hex 24>   # shared platform↔CRM read-only secret
```

**New feature vars (both apps read these from the shared env file):**

```env
BRANDING_NAME="Collo CRM"            # CRM product name in every surface
BRANDING_SINGLE_NAME="Collo"         # short name used in sentences
BRANDING_LOGO="C"                    # single-character logo mark
INBOUND_EMAIL_TOKEN=<generated above>  # CRM inbound-email webhook secret
DEMO_STARTING_BALANCE=0              # opt-in demo credit for new registrations
```

Verify nothing was left as a placeholder, then deploy:

```bash
make env-verify
```

> ⚠️ **Never** commit `.env.production` — it is gitignored, and GitHub Push
> Protection blocks real secrets even in removal diffs. See
> [Secret safety](#secret-safety--git-push-protection).

### 5. Deploy

```bash
make deploy
```

What it does, in order:

| Step | Purpose |
|---|---|
| Render Caddyfile from `.env.production` | one site block per non-empty domain var — this is where single vs dual domain is decided |
| `docker compose config --quiet` | validate compose + env interpolation |
| Pull + build images (`app`, `malware-scanner`, `crm`) | |
| Start postgres / redis / minio / clamav | wait for healthchecks |
| Platform: `prisma migrate deploy` + instrument seed | **the seed is critical** — without it `hub.init()` throws, the app never turns healthy, and Caddy never opens 80/443 |
| CRM: create `blckforest_crm` database if missing, `prisma migrate deploy`, additive role-permission grant | fresh-volume safe; customizations preserved |
| `production:check` preflight | fail-closed: rejects placeholder secrets and dev bypasses |
| Start app → wait healthy → start Caddy | |
| Poll `https://$DOMAIN/api/health` | up to 150s |

### 6. Verify

```bash
make ps            # every service healthy/running
make health        # expect {"status":"ready","engine":"up"}
sudo ss -ltnp | grep -E ':80|:443'   # Caddy bound
```

### 7. Bootstrap the first TWO platform admins

No admin is seeded. Register two accounts at `https://trade.yourdomain.com/register`,
then promote each (audited, idempotent):

```bash
make promote-admin E=first.admin@yourdomain.com
make promote-admin E=second.admin@yourdomain.com
```

The maker-checker Approvals flow needs two operators — a maker cannot approve
their own request. From the third admin onwards use the console:
**Users tab → kebab (⋮) → Grant admin role**, approved by a *different* admin.

### 8. Bootstrap the CRM (first login)

```bash
make crm-seed      # creates role defaults + demo users, then…
```

**Immediately change every demo password** (`admin@crm.local` etc. ship with
`ChangeMe123!`) — sign in at `https://crm.yourdomain.com` and rotate, or
disable the demo accounts after creating real staff. The seed also aligns
system roles with code defaults, so re-running it after upgrades is safe — but
it does **reset** system-role permission edits made in the UI; for
permission *additions* without resets, `make crm-grant` is the safe path
(`make deploy` runs it automatically).

---

## Routine update workflow

```bash
cd /opt/blackforrestt
make backup        # always back up before deploying
make update        # git pull + rebuild app & crm + restart both + Caddy
```

`make deploy` does the same plus migrations, seeds, and the preflight — use it
whenever the release includes database migrations.

**Only `.env.production` changed?**

```bash
make only-env      # recreate the app container with the new env (~60s)
make caddy-render && make update   # additionally, if domain vars changed
```

---

## Why `--env-file` is mandatory

The #1 source of operator errors — and the reason every command in this guide
is a make target (the Makefile always passes both flags):

1. **`${VAR:?}` interpolation** — without `--env-file .env.production`,
   Compose refuses *any* command (including `down`):
   `required variable MINIO_ROOT_USER is missing a value`.
2. **`env_file: ../.env.production`** — the app and CRM services inject the
   literal file; it must physically exist at the repo root. Compose resolves
   these paths **relative to the compose file**, hence the `../` prefix.

Manual equivalent, if you ever need it:

```bash
docker compose --env-file .env.production -f deploy/docker-compose.prod.yml <command>
```

---

## Backup and restore

### Backup

```bash
make backup
```

Creates `backups/<UTC-timestamp>/` with the platform Postgres dump, Redis
snapshot, MinIO objects, CRM attachments, and `SHA256SUMS`. **Copy every
backup to encrypted off-server storage** — a backup on the same host is not a
recovery mechanism. Schedule it:

```cron
0 4 * * *  cd /opt/blackforrestt && make backup >> backups/cron.log 2>&1 && rsync -a --remove-source-files backups/ backup-user@offsite:/srv/blackforrestt-backups/
```

Verify the cron actually fires (`backups/cron.log`), and **rehearse a restore
quarterly** — an untested backup is a hope, not a control.

### Restore (destructive)

```bash
make restore    # prompts for the backup dir and CONFIRM_RESTORE=YES
```

After any restore: `make auth-doctor`, review the reconciliation console, and
run browser smoke tests before reopening traffic.

---

## Troubleshooting

**Start with `make diagnose`** — it pinpoints the failing layer in under 30
seconds. These are real incidents, ordered by how they cascade.

| Symptom | Root cause | Fix |
|---|---|---|
| App `Restarting (1)` / crash loop | `hub.init()` threw — instruments never seeded | `make deploy` (seeds), or `make seed && make restart-app` |
| App `Up (unhealthy)`, no crash | `/api/health` 503 — read the body via `make diagnose` step 5 | rows below |
| Health: `engine: starting`, instruments = 45 | Hub singleton split (server.ts vs route bundle) | verify the unconditional `globalThis` cache write in `hub.ts`; `make build && make update` |
| Health: `engine: down`, instruments = 0 | Seed never ran | `make seed` |
| Health: `database: unknown` | DB query throwing | `make log-app`; `DATABASE_URL` host must be `postgres`, not localhost |
| Health: `redis: unknown` | Redis query throwing | `make diagnose`; then `docker compose --env-file .env.production -f deploy/docker-compose.prod.yml exec redis redis-cli ping` (expect PONG); check `REDIS_URL` |
| `MINIO_ROOT_USER is missing a value` | Manual compose command without `--env-file` | use the make targets, or add both flags |
| `env file … not found` | `.env.production` missing at repo root | `cp deploy/.env.production.example .env.production` + fill in |
| Ports 80/443 closed, Caddy `Created` | App not healthy → Caddy never starts (dependency cascade) | fix app health first; Caddy follows automatically |
| `trade.` subdomain won't load | Missing DNS A record, or `TRADE_DOMAIN` unset | add the A record; set it; `make caddy-render && make update` |
| Second brand serves the first brand's pages | `BRAND_DOMAINS`/`APP_ORIGIN` not extended | add the domain to `BRAND_DOMAINS` and both origins to `APP_ORIGIN`; `make only-env` |
| Caddy up but TLS fails | DNS/firewall/ACME | `dig` the domain; `ufw status`; `make log-caddy` |
| Finnhub `429` reconnect storm | Free-tier IP rate-limit | set `MARKET_DATA_MODE=simulation` → `make only-env` |
| Preflight failure on boot | Placeholder secret or dev bypass | `make preflight` and read each line |
| Customer chat: `No support operator available.` (503) | No active admin in DB | `make promote-admin E=…` |
| `Cannot find module '/app/scripts/promote-admin.ts'` | Stale app image | `make update` |
| Login page shows the wrong brand / logout crosses brands | Stale app image | `make update` |
| CRM `env file deploy/.env.production not found` | Old compose file (pre-fix) | `git pull` — the crm service must read `../.env.production` |
| CRM 500s on the Emails page | CRM migrations not applied | `make crm-migrate` |
| CRM inbound email 401 | Wrong/missing `INBOUND_EMAIL_TOKEN` | match the token your mail provider sends; `make only-env` |
| Inbound webhook 503 | `INBOUND_EMAIL_TOKEN` unset | generate + set it, `make only-env` |

### Preflight failure details

`make preflight` refuses to launch on:

- `AUTH_SECRET still contains a placeholder` — leftover `replace-with-*`
- `REGISTRATION_REQUIRE_EMAIL_VERIFICATION must be true` — an inline `//`
  comment after the value (dotenv reads the whole line)
- `KYC_SCANNER must be http in production` — set `KYC_SCANNER=http` +
  `MALWARE_SCANNER_URL`
- `DEV_EMAIL_PREVIEW must be false` / `EMAIL_PROVIDER must be resend or http`

### WebSocket not connecting

Caddy proxies `/ws` with upgrade support. Ensure `APP_ORIGIN`/`AUTH_URL` use
`https://`, check `make log-caddy`; the browser connects same-origin to
`wss://…/ws`.

---

## Secret safety & Git Push Protection

**Never put real secrets in any tracked file.** Only `.env.production`
(gitignored) holds real values; `deploy/.env.production.example` must contain
only `replace-*` placeholders. GitHub Push Protection scans every push — a
real secret in the diff (even a removal line) blocks the push; if that
happens, rotate the secret, it is burned.

---

## Disaster recovery checklist

1. `make diagnose` → identify the layer.
2. `make backup` (if the stack is half-alive).
3. Roll back a bad release: `git checkout <previous-tag> && make update`.
4. Restore data if the release included a migration:
   `make restore` with the pre-deploy backup directory.
5. Post-restore: `make auth-doctor`, review reconciliation cases, browser
   smoke test, then reopen traffic.

Run `make help` any time you forget a command.
