# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate

ARG NEXT_PUBLIC_WS_URL=""
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_BRAND_NAME
ENV NEXT_PUBLIC_BRAND_NAME=$NEXT_PUBLIC_BRAND_NAME
# Absolute origin of the trade subdomain (e.g. https://trade.blackforrestt.com).
# Baked into client bundles so marketing links (Login/Register CTAs) point at
# the authenticated subdomain. Empty = single-domain mode (relative links).
ARG NEXT_PUBLIC_TRADE_ORIGIN=""
ENV NEXT_PUBLIC_TRADE_ORIGIN=$NEXT_PUBLIC_TRADE_ORIGIN
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 -G nodejs

COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json /app/package-lock.json ./
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/src ./src
COPY --from=builder --chown=nextjs:nodejs /app/scripts/production ./scripts/production
COPY --from=builder --chown=nextjs:nodejs /app/server.ts /app/tsconfig.json ./

USER nextjs
EXPOSE 3000

# Migrations run before the HTTP/WebSocket process. In larger deployments this
# should be a separate release job to avoid multiple replicas racing at boot.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
