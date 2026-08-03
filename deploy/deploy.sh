#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE=(docker compose --env-file "$ROOT/.env.production" -f "$ROOT/deploy/docker-compose.prod.yml")

[[ -f "$ROOT/.env.production" ]] || { echo "Missing $ROOT/.env.production" >&2; exit 1; }
command -v docker >/dev/null || { echo "Docker is required." >&2; exit 1; }

cd "$ROOT"
"${COMPOSE[@]}" config --quiet
"${COMPOSE[@]}" pull postgres redis minio minio-init caddy
"${COMPOSE[@]}" build --pull app
"${COMPOSE[@]}" up -d postgres redis minio minio-init
"${COMPOSE[@]}" run --rm app npx prisma migrate deploy
# Seed tradeable instruments. Without this, hub.init() throws at boot
# (src/server/engine/hub.ts: "No active instruments found"), the app never
# becomes healthy, and Caddy — which depends_on: app.service_healthy — never
# starts, leaving ports 80/443 closed. The seed is idempotent (upsert by symbol).
"${COMPOSE[@]}" run --rm app npm run db:seed
"${COMPOSE[@]}" run --rm app npm run production:check
"${COMPOSE[@]}" up -d app caddy
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
"${COMPOSE[@]}" logs --tail=200 app caddy
exit 1
