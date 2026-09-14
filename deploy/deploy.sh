#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE=(docker compose --env-file "$ROOT/.env.production" -f "$ROOT/deploy/docker-compose.prod.yml")

[[ -f "$ROOT/.env.production" ]] || { echo "Missing $ROOT/.env.production" >&2; exit 1; }
command -v docker >/dev/null || { echo "Docker is required." >&2; exit 1; }

cd "$ROOT"
# Render the Caddy config from the env (one site block per non-empty domain).
# Compose mounts the rendered file; see render-caddy.sh for why.
#
# Caddy reads its config ONLY at startup, and compose does not recreate a
# container for bind-mount CONTENT changes — a re-rendered Caddyfile would
# silently never load. Remember whether the render changed the file so the
# final step can force-recreate Caddy when it did.
CADDYFILE="$ROOT/deploy/Caddyfile.rendered"
CADDY_HASH_BEFORE="$(sha256sum "$CADDYFILE" 2>/dev/null | cut -d' ' -f1 || :)"
"$ROOT/deploy/render-caddy.sh" "$ROOT/.env.production"
CADDY_HASH_AFTER="$(sha256sum "$CADDYFILE" | cut -d' ' -f1)"
CADDY_CHANGED=false
if [[ "$CADDY_HASH_BEFORE" != "$CADDY_HASH_AFTER" ]]; then
  CADDY_CHANGED=true
  echo "Caddyfile changed — Caddy will be recreated to load it."
fi
"${COMPOSE[@]}" config --quiet

# CRM sanity: if the CRM is routed (CRM_DOMAIN set), its dedicated secrets
# must exist — otherwise the container crash-loops on every request and the
# subdomain serves TLS errors. Fail BEFORE the multi-minute build.
CRM_DOMAIN_CFG="$(grep -E '^CRM_DOMAIN=' .env.production | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' | tr -d '[:space:]' || :)"
if [[ -n "$CRM_DOMAIN_CFG" ]]; then
  # Missing CRM secrets are generated and PERSISTED into .env.production
  # (which stays mode 600) instead of failing the deploy: AUTH_SECRET_CRM
  # signs CRM sessions, CRM_ENCRYPTION_KEY encrypts per-user SMTP passwords,
  # CRM_BRIDGE_TOKEN is the shared platform ↔ CRM read-only secret.
  for var in AUTH_SECRET_CRM CRM_ENCRYPTION_KEY CRM_BRIDGE_TOKEN; do
    value="$(grep -E "^${var}=" .env.production | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' | tr -d '[:space:]' || :)"
    if [[ -z "$value" ]]; then
      generated="$(openssl rand -hex 32)"
      printf '\n%s=%s\n' "$var" "$generated" >> .env.production
      echo "Generated missing $var and appended it to .env.production."
    fi
  done
fi

"${COMPOSE[@]}" pull postgres redis minio minio-init caddy clamav
"${COMPOSE[@]}" build --pull app malware-scanner crm
# clamav starts early so signature downloads overlap with the migrate/seed steps.
"${COMPOSE[@]}" up -d postgres redis minio minio-init clamav
"${COMPOSE[@]}" run --rm app npx prisma migrate deploy
# Seed tradeable instruments. Without this, hub.init() throws at boot
# (src/server/engine/hub.ts: "No active instruments found"), the app never
# becomes healthy, and Caddy — which depends_on: app.service_healthy — never
# starts, leaving ports 80/443 closed. The seed is idempotent (upsert by symbol).
"${COMPOSE[@]}" run --rm app npm run db:seed
# The CRM ships as its own service with its own database (blckforest_crm).
# On a fresh volume the database does not exist yet — create it idempotently,
# apply the CRM migrations, then roll out newly-introduced role permissions
# additively (never removes — Roles-UI customizations survive). The grant is
# a no-op until the roles exist (the CRM seed creates them, with the new
# defaults already included).
POSTGRES_USER="$("${COMPOSE[@]}" exec -T postgres printenv POSTGRES_USER)"
"${COMPOSE[@]}" exec -T postgres psql -U "$POSTGRES_USER" -d blackforrestt <<'SQL'
SELECT 'CREATE DATABASE "blckforest_crm"'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'blckforest_crm')\gexec
SQL

# ── CRM database target ──────────────────────────────────────────────────────
# Default: the IN-STACK postgres, with credentials read from the postgres
# container itself (never guessed from .env interpolation). CRM_DATABASE_URL
# in .env.production may override this — but if it points at the in-stack
# postgres with a STALE password, the runtime container would 500 on every
# query even though migrations succeeded, so fail here with the fix instead.
CRM_DB_URL_CFG="$(grep -E '^CRM_DATABASE_URL=' .env.production | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' || :)"
CRM_URL_IS_STACK=true
if [[ -n "$CRM_DB_URL_CFG" && "$CRM_DB_URL_CFG" != *@postgres:* ]]; then
  CRM_URL_IS_STACK=false   # external CRM database — respect it verbatim
elif [[ -n "$CRM_DB_URL_CFG" ]]; then
  POSTGRES_PASSWORD_VAL="$("${COMPOSE[@]}" exec -T postgres printenv POSTGRES_PASSWORD)"
  if [[ "$CRM_DB_URL_CFG" != *":${POSTGRES_PASSWORD_VAL}@"* ]]; then
    echo "ERROR: CRM_DATABASE_URL in .env.production points at the in-stack postgres" >&2
    echo "but its password does not match POSTGRES_PASSWORD." >&2
    echo "Fix: either REMOVE the CRM_DATABASE_URL line (the stack password is used" >&2
    echo "automatically), or set its password to POSTGRES_PASSWORD — then re-run make deploy." >&2
    exit 1
  fi
fi
if [[ "$CRM_URL_IS_STACK" == true ]]; then
  POSTGRES_PASSWORD_VAL="$("${COMPOSE[@]}" exec -T postgres printenv POSTGRES_PASSWORD)"
  CRM_DB_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD_VAL}@postgres:5432/blckforest_crm"
else
  CRM_DB_URL="$CRM_DB_URL_CFG"
fi

# Migrate the CRM database with the resolved target.
"${COMPOSE[@]}" run --rm -e DATABASE_URL="$CRM_DB_URL" crm npx prisma migrate deploy
"$ROOT/deploy/crm-grant-permissions.sh"
"${COMPOSE[@]}" run --rm app npm run production:check
"${COMPOSE[@]}" up -d malware-scanner crm app caddy
if [[ "$CADDY_CHANGED" == true ]]; then
  echo "Recreating Caddy to load the new configuration…"
  "${COMPOSE[@]}" up -d --no-deps --force-recreate caddy
  sleep 3
fi
"${COMPOSE[@]}" ps

DOMAIN="$(grep -E '^DOMAIN=' .env.production | tail -1 | cut -d= -f2-)"
echo "Waiting for https://${DOMAIN}/api/health"
for attempt in {1..30}; do
  if curl --fail --silent --show-error "https://${DOMAIN}/api/health" >/dev/null; then
    echo "Deployment healthy."
    exit 0
  fi
  sleep 5
done
"${COMPOSE[@]}" logs --tail=200 app caddy clamav malware-scanner
exit 1
