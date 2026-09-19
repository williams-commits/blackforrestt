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

export const VISTEST_DOMAIN: DomainDefinition = {
  key: "vistest",
  hosts: ["vistest.localhost"],
  landingDesign: "convertio",
  publicDesign: "convertio",
  tradeEnabled: false,
  brand: {
    name: "Vistest",
  },
  features: { trading: true, informers: false },
};
