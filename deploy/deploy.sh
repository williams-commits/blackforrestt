#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE=(docker compose --env-file "$ROOT/.env.production" -f "$ROOT/deploy/docker-compose.prod.yml")

# Optional argument scopes the deploy to ONE domain family — its registry
# key (e.g. `gbfxs`) or a served host (e.g. gbfxs.com), as in
# `make deploy gbfxs`. Renders/routes ONLY that family's site file and
# skips DEPLOY_DOMAINS env persistence entirely (one-shot scope).
DEPLOY_SCOPE="${1:-}"
DEPLOY_SCOPE_ARGS=()
if [[ -n "$DEPLOY_SCOPE" ]]; then
  DEPLOY_SCOPE_ARGS=(--domains "$DEPLOY_SCOPE")
  echo "Deploy scope: $DEPLOY_SCOPE (single domain family)"
fi

[[ -f "$ROOT/.env.production" ]] || { echo "Missing $ROOT/.env.production" >&2; exit 1; }
command -v docker >/dev/null || { echo "Docker is required." >&2; exit 1; }

cd "$ROOT"
# Render the Caddy config from the domain manifests via the platform CLI.
# Compose mounts the rendered file; regeneration is manifest-driven.
#
# Caddy reads its config ONLY at startup, and compose does not recreate a
# container for bind-mount CONTENT changes — a re-rendered Caddyfile would
# silently never load. Remember whether the render changed the file so the
# final step can force-recreate Caddy when it did.
CADDYFILE="$ROOT/deploy/caddy/render/Caddyfile"
CADDY_HASH_BEFORE="$(sha256sum "$CADDYFILE" 2>/dev/null | cut -d' ' -f1 || :)"
# CADDY_EMAIL is required by the Caddyfile render (TLS renewal contact).
# Default it to admin@<primary domain> and PERSIST the choice so it is
# visible and changeable in .env.production on later deploys.
CADDY_EMAIL_CFG="$(grep -E '^CADDY_EMAIL=' .env.production | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' | tr -d '[:space:]' || :)"
if [[ -z "$CADDY_EMAIL_CFG" ]]; then
  PRIMARY_DOMAIN="$(grep -E '^DOMAIN=' .env.production | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' | tr -d '[:space:]' || :)"
  if [[ -z "$PRIMARY_DOMAIN" ]]; then
    PRIMARY_DOMAIN="$(grep -E '^BRAND_DOMAIN=' .env.production | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' | cut -d, -f1 | tr -d '[:space:]' || :)"
  fi
  if [[ -n "$PRIMARY_DOMAIN" ]]; then
    CADDY_EMAIL_CFG="admin@${PRIMARY_DOMAIN}"
    printf '\nCADDY_EMAIL=%s\n' "$CADDY_EMAIL_CFG" >> .env.production
    echo "CADDY_EMAIL was not set — defaulted to ${CADDY_EMAIL_CFG} (TLS renewal contact). Edit .env.production to change it."
  fi
fi
# Seed per-domain site files for every registry domain on FIRST deploy.
# The render runs INSIDE a container built from this repo's builder stage —
# the host only needs Docker (no host Node), same pattern as crm-seed below.
# Repo pieces the render reads/writes are bind-mounted over the image's /app
# copy so the output always matches the checked-out manifests + env file.
docker build --target builder -t blckforest-render:tmp "$ROOT" >/dev/null
docker run --rm \
  -v "$ROOT/scripts:/app/scripts:ro" \
  -v "$ROOT/src/domains/.generated:/app/src/domains/.generated:ro" \
  -v "$ROOT/.env.production:/app/.env.production:ro" \
  -v "$ROOT/deploy/caddy:/app/deploy/caddy" \
  blckforest-render:tmp \
  node scripts/platform.mjs caddy render --env-file /app/.env.production --out /app/deploy/caddy/render/Caddyfile ${DEPLOY_SCOPE_ARGS[@]+"${DEPLOY_SCOPE_ARGS[@]}"}
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

# ── Deploy scope for the new domain-manifest system ──────────────────────────
# The registry lists every domain family; DOMAIN slots left empty disable a
# family. Translate non-empty DOMAIN/DOMAIN_2/DOMAIN_3 slots into
# DEPLOY_DOMAINS (persisted) so the render only routes configured families.
DEPLOY_DOMAINS_CFG="$(grep -E '^DEPLOY_DOMAINS=' .env.production | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' | tr -d '[:space:]' || :)"
if [[ -n "$DEPLOY_SCOPE" ]]; then
  echo "One-shot scope active ($DEPLOY_SCOPE) — skipping DEPLOY_DOMAINS derivation."
elif [[ -z "$DEPLOY_DOMAINS_CFG" ]]; then
  SLOTS="$(grep -E '^DOMAIN(_[0-9]+)?=' .env.production | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' | tr -d '[:space:]' | grep -v '^$' || :)"
  if [[ -n "$SLOTS" ]]; then
    DEPLOY_DOMAINS_CFG="$(echo "$SLOTS" | paste -sd, -)"
    printf '\nDEPLOY_DOMAINS=%s\n' "$DEPLOY_DOMAINS_CFG" >> .env.production
    echo "DEPLOY_DOMAINS derived from DOMAIN slots and persisted: $DEPLOY_DOMAINS_CFG"
  fi
fi

# ── Image pull ───────────────────────────────────────────────────────────────
# MinIO removed ALL community images from public registries (quay.io tags
# wiped, Docker Hub repo gone — 2025 community-edition discontinuation).
# --ignore-pull-failures keeps a deploy working when the pinned MinIO
# images are already present locally from an earlier deploy; the explicit
# existence checks below then fail loudly ONLY on a fresh host where the
# images truly cannot be obtained.
if ! "${COMPOSE[@]}" pull --ignore-pull-failures postgres redis minio minio-init caddy clamav; then
  echo "WARNING: some images failed to pull — continuing with locally present images." >&2
fi
MINIO_SERVER_IMAGE="$(grep -E '^  minio:' -A1 "$ROOT/deploy/docker-compose.prod.yml" | grep 'image:' | head -1 | sed -E 's/.*image: *//;s/[" ]//g')"
MINIO_MC_IMAGE="$(grep -E '^  minio-init:' -A1 "$ROOT/deploy/docker-compose.prod.yml" | grep 'image:' | head -1 | sed -E 's/.*image: *//;s/[" ]//g')"
for required_image in "$MINIO_SERVER_IMAGE" "$MINIO_MC_IMAGE"; do
  if ! docker image inspect "$required_image" >/dev/null 2>&1; then
    echo "ERROR: $required_image is not available: pulled from public registries and" >&2
    echo "not present on this host. Restore it from your image backup:" >&2
    echo "  gunzip -c backup/minio-images.tgz | docker load" >&2
    echo "Or migrate the stack to a maintained S3-compatible image." >&2
    exit 1
  fi
done

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

# Health-check host: DOMAIN overrides; otherwise the first BRAND_DOMAIN
# entry (the canonical apex). Neither set → skip the wait with a warning
# instead of curling https:///api/health for 150 seconds.
DOMAIN="$(grep -E '^DOMAIN=' .env.production | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' || :)"
if [[ -z "$DOMAIN" ]]; then
  DOMAIN="$(grep -E '^BRAND_DOMAIN=' .env.production | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' | cut -d, -f1 | tr -d '[:space:]' || :)"
fi
if [[ -z "$DOMAIN" ]]; then
  echo "WARNING: no DOMAIN= or BRAND_DOMAIN= in .env.production — skipping the health check." >&2
  "${COMPOSE[@]}" ps
  exit 0
fi
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
