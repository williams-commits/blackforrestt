import type { NextConfig } from "next";
import path from "node:path";

// The CRM is a self-contained module served on its own subdomain behind the
// platform's Caddy edge (crm.<domain> → crm:3000). No rewrites or proxies
// back to the trading platform — the two apps share nothing at runtime.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Standalone server bundle for the slim production Docker image.
  output: "standalone",
  // The repo root and the CRM each hold a lockfile; pinning the tracing
  // root silences Next's "inferred workspace root" dev-overlay issue.
  outputFileTracingRoot: path.join(__dirname, ".."),
  // `npm run lint` runs the flat-config ESLint suite explicitly; the
  // build-integrated linter uses legacy options that don't apply to it.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
