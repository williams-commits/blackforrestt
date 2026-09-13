#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE=(docker compose --env-file "$ROOT/.env.production" -f "$ROOT/deploy/docker-compose.prod.yml")

[[ -f "$ROOT/.env.production" ]] || { echo "Missing $ROOT/.env.production" >&2; exit 1; }
command -v docker >/dev/null || { echo "Docker is required." >&2; exit 1; }

cd "$ROOT"
# Render the Caddy config from the env (one site block per non-empty domain).
# Compose mounts the rendered file; see render-caddy.sh for why.
"$ROOT/deploy/render-caddy.sh" "$ROOT/.env.production"
"${COMPOSE[@]}" config --quiet
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
"${COMPOSE[@]}" run --rm crm npx prisma migrate deploy
"${COMPOSE[@]}" exec -T postgres psql -U "$POSTGRES_USER" -d blckforest_crm <<'SQL'
INSERT INTO "RolePermission" ("id", "roleId", "permission")
SELECT gen_random_uuid()::text, r."id", p.perm
FROM "Role" r
CROSS JOIN (VALUES ('EMAILS_VIEW'), ('EMAILS_SEND')) AS p(perm)
WHERE r."key" IN ('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TEAM_LEAD', 'REP')
  AND NOT EXISTS (
    SELECT 1 FROM "RolePermission" rp
    WHERE rp."roleId" = r."id" AND rp."permission" = p.perm
  );
SQL
"${COMPOSE[@]}" run --rm app npm run production:check
"${COMPOSE[@]}" up -d malware-scanner app caddy
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
