/**
 * ─────────────────────────────────────────────────────────────────────────────
 * NEW DOMAIN TEMPLATE — copy this folder to src/domains/<your-domain>/
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * A domain package makes ONE brand family explicit: its hosts, brand
 * identity, design selections, and content. The shared platform (backend,
 * database, auth, trading, CRM, realtime) is NEVER duplicated — a new domain
 * only brings content + design configuration.
 *
 * Workflow (full guide: .platform/workflows/new-domain.md):
 *   1. cp -r src/domains/_template src/domains/<key>   (key: lowercase, no dots)
 *   2. Edit domain.config.ts below (key, hosts, designs, brand defaults)
 *   3. Implement content.ts against the contracts in src/content/contracts.ts
 *   4. Pick designs from src/landing/designs.ts (or build a custom one under
 *      src/landing/<design>/ and register it there)
 *   5. Register the config in src/domains/registry.ts (order = priority;
 *      NEVER before the default domain)
 *   6. Assets → public/brands/<key>/ ; SEO copy → brand.metaDescription
 *   7. Deployment: DNS A records + DOMAIN_N/TRADE_DOMAIN_N + BRAND_DOMAINS +
 *      (optional) BRAND_OVERRIDES in .env.production → `make deploy`
 *   8. Validate: npm run test:domains  (registry integrity + isolation)
 *
 * MUST stay a pure data module (type-only imports): registry.ts composes it
 * and is also loaded by next.config.ts and the middleware.
 */
import type { DomainDefinition } from "../registry";

export const TEMPLATE_DOMAIN: DomainDefinition = {
  // Stable key — used in content packages, tests, and logs. Never for routing.
  key: "example",
  // Apex hosts this family answers on. DNS + TLS must exist before adding.
  hosts: ["example.com"],
  // Design selections from src/landing/designs.ts. Start from the existing
  // designs ("default" | "agile"); add your own key there for a custom
  // landing/public design.
  landingDesign: "default",
  publicDesign: "default",
  // True once this family's own trade subdomain has DNS + TLS (or set the
  // DOMAIN_N/TRADE_DOMAIN_N env pair — env wins).
  tradeEnabled: false,
  // Brand identity defaults — everything BRAND_OVERRIDES[host] can override.
  // Payment/deposit data stays env-only (never commit wallet addresses).
  brand: {
    name: "Example Brand",
    shortName: "Example",
    legalName: "Example Brand Ltd",
    supportEmail: "support@example.com",
    address: "",
    trademark: "Example™",
    wordmark: ["Example", "Brand"],
    // accentColor: "#3b82f6",   // re-themes every --color-brand utility
    // ogImage: "/brands/example/og.png",
    // metaDescription: "…",     // the family's own SEO voice
    // landingTemplate: "default", // env-override key, mirrors landingDesign
  },
  features: { trading: true, informers: true },
};
