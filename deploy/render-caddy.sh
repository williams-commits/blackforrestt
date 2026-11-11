#!/usr/bin/env bash
# Renders deploy/caddy/render/Caddyfile from the DOMAIN MANIFESTS + the
# already-deployed per-domain site files. No numbered env slots — routing is
# derived from src/domains/<key>/domain.config.ts.
#
# Deployment state = one site file per deployed domain under
# deploy/caddy/render/sites/. Writing a domain's file never touches another
# domain's (deploy-preservation guarantee).
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${1:-$ROOT/.env.production}"
[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 1; }

out="$ROOT/deploy/caddy/render/Caddyfile"
mkdir -p "$ROOT/deploy/caddy/render/sites"
if [[ -d "$out" ]]; then rm -rf "$out"; fi

# Render inside the repo's builder-stage container — the host needs only
# Docker (no host Node), matching deploy.sh's render step.
docker build --target builder -f "$ROOT/apps/web/Dockerfile" -t blckforest-render:tmp "$ROOT" >/dev/null
docker run --rm \
  -v "$ROOT/apps/web/scripts:/workspace/apps/web/scripts:ro" \
  -v "$ROOT/apps/web/src/domains/.generated:/workspace/apps/web/src/domains/.generated:ro" \
  -v "$ENV_FILE:/workspace/.env.production:ro" \
  -v "$ROOT/deploy/caddy:/workspace/deploy/caddy" \
  blckforest-render:tmp \
  node --import tsx scripts/platform.mjs caddy render --env-file /workspace/.env.production --out /workspace/deploy/caddy/render/Caddyfile
sites="$(grep -c 'import app-site' "$out" || true)"
echo "Rendered $out — $sites active site block(s)."
