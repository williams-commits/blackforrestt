# syntax=docker/dockerfile:1.7
# Trade app image — the extracted trading platform (terminal, account portal,
# admin console, engine + WS server, auth), served on trade.<domain> behind
# the platform's Caddy edge. Pattern: apps/crm/Dockerfile.

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
WORKDIR /workspace/apps/trade
# Next's SWC fallback detects the package manager from a lockfile in the
# app directory; without one, Node's bundled Yarn shim is selected.
RUN cp ../../package-lock.json ./package-lock.json \
    && npx prisma generate \
    && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 -G nodejs

# Trade's custom server initializes the market engine and WebSocket endpoint;
# Next's generated standalone server would serve pages without either service.
COPY --from=builder --chown=nextjs:nodejs /workspace/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/trade/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/trade/public ./public
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/trade/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/trade/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/trade/src ./src
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/trade/server.ts ./server.ts
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/trade/tsconfig.json ./tsconfig.json

USER nextjs
EXPOSE 3000
CMD ["npm", "run", "start"]
