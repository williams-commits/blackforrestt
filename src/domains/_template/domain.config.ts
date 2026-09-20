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
  hosts: ["__DOMAIN_HOST__"],
  landingDesign: "default",
  publicDesign: "default",
  tradeEnabled: false,
  brand: {
    name: "__DOMAIN_NAME__",
    // Accent color drives the root layout's brand theme injection
    // (--color-brand, progress bar, focus rings) — pick your brand blue.
    accentColor: "#0052ff",
  },
  features: { trading: true, informers: false },
};
