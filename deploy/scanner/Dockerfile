# Malware scanner HTTP gateway (see server.js). Zero npm dependencies.
FROM node:22-alpine
WORKDIR /app
COPY server.js .
ENV NODE_ENV=production
RUN addgroup -S scanner && adduser -S scanner -G scanner && chown -R scanner:scanner /app
USER scanner
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --retries=20 --start-period=10s \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
CMD ["node", "server.js"]
