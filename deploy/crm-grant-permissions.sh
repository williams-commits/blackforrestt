#!/usr/bin/env bash
# Rolls out NEW CRM role permissions to every system role — additively and
# idempotently, straight from the code-level ROLE_DEFINITIONS catalog (the
# single source of truth, via `prisma/seed.ts --roles`). Never removes
# anything, so permission customizations made through the Roles UI always
# survive. SUPER_ADMIN additionally resolves to the full catalog in code
# (guard.ts effectivePermissions), so it cannot be crippled by row drift.
#
# Run by deploy.sh after the CRM migrations; also available as: make crm-grant
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

[[ -f "$ROOT/.env.production" ]] || { echo "Missing $ROOT/.env.production" >&2; exit 1; }

COMPOSE=(docker compose --env-file "$ROOT/.env.production" -f "$ROOT/deploy/docker-compose.prod.yml")

# Same pattern as `make crm-seed`: run the seed's TS inside a throwaway
# builder container attached to the postgres network (no host Node needed).
docker build --target builder -t blckforest-crm-seed:tmp "$ROOT/crm"

PG_CID="$("${COMPOSE[@]}" ps -q postgres)"
NET="$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' "$PG_CID")"
if [[ -z "$NET" ]]; then
  echo "Cannot resolve the postgres network — run make deploy first." >&2
  exit 1
fi

CRM_DB="$(sed -n 's/^CRM_DATABASE_URL=//p' "$ROOT/.env.production" | head -1 | sed -e 's/^"//' -e 's/"$//')"
PGPWD="$(sed -n 's/^POSTGRES_PASSWORD=//p' "$ROOT/.env.production" | head -1 | sed -e 's/^"//' -e 's/"$//')"

docker run --rm --network "$NET" \
  -e DATABASE_URL="${CRM_DB:-postgresql://blackforrestt:${PGPWD}@postgres:5432/blckforest_crm}" \
  blckforest-crm-seed:tmp \
  sh -c "node --import tsx prisma/seed.ts --roles"

echo "CRM role permissions are up to date (additive, from ROLE_DEFINITIONS)."
