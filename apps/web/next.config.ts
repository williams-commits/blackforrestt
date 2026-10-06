import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
// Zero-dependency domain registry — safe to load at build/boot time. This is
// the SAME module the middleware and src/lib/branding.ts use, so the CSP
// origin list can never drift from actual request routing again.
import { brandDomainList, familyTradeHost } from "./src/platform/registry";

// Wire next-intl's message-loading + locale resolver (src/i18n/request.ts) into
// the build. This is the non-routing (cookie-based) mode — no [locale] segment.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isProduction = process.env.NODE_ENV === "production";

// CSP connect-src origins: 'self' covers each host's own pages; the explicit
// origins below cover the legitimate cross-host hops a browser makes in the
// multi-brand deployment — apex→trade-host RSC prefetch redirects (the
// middleware 307s /trade/*, /login, /register on tradeEnabled families),
// Auth.js session fetches, and the live WebSocket.
//
// Computed from the domain registry (BRAND_DOMAINS env + manifest trade hosts
// pairs, falling back to <sub>.<domain>): the custom server (server.ts)
// loads this config at BOOT with the container's runtime env, so adding a
// brand via .env.production needs only a restart — no rebuild. The old
// single-BRAND_DOMAIN computation silently omitted every family after the
// first, which blocked RSC prefetches on gbfxs.com (CSP connect-src
// violation → "Failed to fetch RSC payload" console spam + full-page
// fallback navigation).
const connectOrigins = new Set<string>();
for (const domain of brandDomainList()) {
  const tradeHost = familyTradeHost(domain);
  connectOrigins.add(`https://${domain}`);
  connectOrigins.add(`https://${tradeHost}`);
  connectOrigins.add(`wss://${tradeHost}`);
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const cspHeader = (extra: string[] = []) =>
  [
    "default-src 'self'",
    // Next.js emits small inline bootstrap scripts. A nonce-based policy is
    // preferable for a regulated deployment, but this still blocks remote JS.
    `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://i.ytimg.com",
    "font-src 'self' data:",
    // Allow every brand family's apex + trade hosts (Auth.js session
    // fetches, apex→trade RSC prefetch redirects, live instrument data,
    // WebSocket). 'self' covers same-origin; the explicit origins cover
    // the cross-host hops enumerated above.
    `connect-src 'self' ${[...connectOrigins].join(" ")}${isProduction ? "" : " ws://localhost:* ws://127.0.0.1:*"}`,
    // Allow YouTube embeds for the education video courses.
    "frame-src 'self' https://www.youtube.com https://youtube.com",
    ...extra,
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

// Documents: no framing at all.
const documentHeaders = [
  ...securityHeaders,
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: cspHeader(["frame-ancestors 'none'"]) },
  ...(isProduction
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

// /widgets/* — the embeddable data strips advertised by /tools/informers.
// Public, unauthenticated, data-only: framing is the entire point, so the
// frame locks are relaxed to frame-ancestors * (and XFO omitted). Every
// other directive stays as strict as documents.
const widgetHeaders = [
  ...securityHeaders,
  { key: "Content-Security-Policy", value: cspHeader(["frame-ancestors *"]) },
  ...(isProduction
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // ESLint is enforced as a dedicated gate (`npm run lint`) in the Phase 8
  // matrix, run before the build. Disable Next's build-internal lint step:
  // it uses removed ESLint options (useEslintrc/extensions) that ESLint 9
  // no longer accepts, so it errors during `next build` without adding value.
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      // Everything except /widgets/* — full document lockdown.
      { source: "/((?!widgets/).*)", headers: documentHeaders },
      // Embeddable widget strips — frame locks relaxed.
      { source: "/widgets/:path*", headers: widgetHeaders },
    ];
  },
};

export default withNextIntl(nextConfig);
