# syntax=docker/dockerfile:1.7
# Trade app image — the extracted trading platform (terminal, account portal,
# admin console, engine + WS server, auth), served on trade.<domain> behind
# the platform's Caddy edge. Pattern: apps/crm/Dockerfile.

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
RUN npx prisma generate && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 -G nodejs

# Standalone output carries its minimal node_modules inside .next/standalone.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Schema + migrations for `prisma migrate deploy` inside the container.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
# Prisma CLI vendored at build time — the trade app runs on the internal-only
# backend network, so npx can never download it at runtime.
RUN cd /app && npm install --no-save --omit=dev --loglevel=error prisma

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
