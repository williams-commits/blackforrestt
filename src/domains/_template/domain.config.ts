/**
 * ─────────────────────────────────────────────────────────────────────────────
 * DOMAIN MANIFEST TEMPLATE — the platform CLI copies this folder for
 * `platform domain create`. Safe placeholders only; NEVER production content.
 *
 * The manifest SELECTS content, landing design, public design, navigation,
 * SEO and assets — it never contains their implementations.
 * MUST stay a pure data module (type-only imports).
 */
import type { DomainDefinition } from "@/platform/registry";

export const __DOMAIN_KEY___DOMAIN: DomainDefinition = {
  key: "__DOMAIN_KEY__",
  // First-class hosts: first entry = canonical apex. ".localhost" entries are
  // optional DEV MIRRORS (local development only — never deployed). Mirror
  // apexes serving the same family belong in `aliases`, not here.
  hosts: ["__DOMAIN_HOST__"],
  // aliases: ["mirror.__DOMAIN_HOST__"],  // same-family mirrors, optional
  landingDesign: "default",
  publicDesign: "default",
  tradeEnabled: false,
  // Explicit package refs (validated by `platform domain validate`) — the
  // manifest self-describes where its content lives inside this package.
  content: { landing: "content/landing", public: "content/public" },
  navigation: "navigation",
  seo: "seo",
  assets: "assets",
  brand: {
    name: "__DOMAIN_NAME__",
    // Accent color drives the root layout's brand theme injection
    // (--color-brand, progress bar, focus rings) — pick your brand blue.
    accentColor: "#0052ff",
  },
  features: { trading: true, informers: false },
};
