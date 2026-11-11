# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS deps
WORKDIR /workspace
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/trade/package.json ./apps/trade/package.json
COPY apps/crm/package.json ./apps/crm/package.json
RUN npm ci --no-audit --no-fund
# The checked-in lockfile can omit platform-specific native add-ons when made
# on another OS. Reinstall their locked versions for the target Alpine image.
RUN npm install --no-save --ignore-scripts --include=optional --no-audit --no-fund \
    "@parcel/watcher@$(node -p 'require("./package-lock.json").packages["node_modules/@parcel/watcher"].version')" \
    "@tailwindcss/oxide@$(node -p 'require("./package-lock.json").packages["node_modules/@tailwindcss/oxide"].version')" \
    "unrs-resolver@$(node -p 'require("./package-lock.json").packages["node_modules/unrs-resolver"].version')" \
    "@swc/core@$(node -p 'require("./package-lock.json").packages["node_modules/next-intl/node_modules/@swc/core"].version')" \
    "lightningcss@$(node -p 'require("./package-lock.json").packages["node_modules/lightningcss"].version')"

FROM node:22-alpine AS builder
WORKDIR /workspace
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /workspace/node_modules ./node_modules
COPY . .
WORKDIR /workspace/apps/web
RUN npx prisma generate
RUN cp ../../package-lock.json ./package-lock.json

ARG NEXT_PUBLIC_WS_URL=""
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_BRAND_NAME="Black Forest Digital"
ENV NEXT_PUBLIC_BRAND_NAME=$NEXT_PUBLIC_BRAND_NAME
# Absolute origin of the trade subdomain (e.g. https://trade.blackforrestt.com).
# Baked into client bundles so marketing links (Login/Register CTAs) point at
# the authenticated subdomain. Empty = single-domain mode (relative links).
ARG NEXT_PUBLIC_TRADE_ORIGIN=""
ENV NEXT_PUBLIC_TRADE_ORIGIN=$NEXT_PUBLIC_TRADE_ORIGIN
RUN npm run build
WORKDIR /workspace
RUN npm prune --omit=dev --workspace=web --include-workspace-root=false
WORKDIR /workspace/apps/web

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 -G nodejs

COPY --from=builder --chown=nextjs:nodejs /workspace/apps/web/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/web/public ./public
COPY --from=builder --chown=nextjs:nodejs /workspace/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/web/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/web/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/web/src ./src
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/web/scripts/production ./scripts/production
# Ops scripts runnable inside the container (npm run admin:promote -- <email>).
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/web/scripts/promote-admin.ts ./scripts/promote-admin.ts
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/web/server.ts /workspace/apps/web/tsconfig.json ./

USER nextjs
EXPOSE 3000

# Migrations run before the HTTP/WebSocket process. In larger deployments this
# should be a separate release job to avoid multiple replicas racing at boot.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
