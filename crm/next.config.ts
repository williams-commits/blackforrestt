import type { NextConfig } from "next";

// The CRM is a self-contained module served on its own subdomain behind the
// platform's Caddy edge (crm.<domain> → crm:3000). No rewrites or proxies
// back to the trading platform — the two apps share nothing at runtime.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Standalone server bundle for the slim production Docker image.
  output: "standalone",
  // Pin the tracing root to the CRM itself. The repo root and the CRM each
  // hold a lockfile, so silencing Next's "inferred workspace root" warning
  // needs an explicit root — and it must be THIS directory: a parent root
  // makes standalone emit server.js nested under ./app/ (traced paths are
  // root-relative), breaking the runner image's `COPY .next/standalone ./`
  // + `node server.js`.
  outputFileTracingRoot: __dirname,
  // `npm run lint` runs the flat-config ESLint suite explicitly; the
  // build-integrated linter uses legacy options that don't apply to it.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
