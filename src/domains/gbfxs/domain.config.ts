/**
 * AGILE domain configuration — Global Forex Services (gbfxs.com).
 *
 * One domain = one explicit configuration. The brand identity defaults below
 * mirror the production BRAND_OVERRIDES entry so the repository self-describes
 * the family; env still overrides everything at runtime (deposit wallet
 * addresses intentionally stay env-only — operational payment data, not code).
 *
 * MUST stay a pure data module (type-only imports): it is composed into
 * registry.ts, which next.config.ts and the middleware also load.
 */
import type { BrandGlyphConfig, DomainDefinition } from "@/platform/registry";

/** Glyph lockup for gbfxs — bracket pair around a "G", on brand yellow. */
const GBFXS_GLYPH: BrandGlyphConfig = {
  viewBox: "0 0 24 24",
  background: "#f0b90b",
  letter: { text: "G", size: 9.5 },
  paths: [
    {
      d: "M6.42 7C6.67 6.75 7.08 6.75 7.33 7L8.26 7.93C8.51 8.18 8.51 8.58 8.26 8.84L5.07 12.01L8.24 15.17C8.5 15.43 8.5 15.83 8.24 16.08L7.33 16.99C7.08 17.24 6.67 17.24 6.42 16.99L1.85 12.44C1.6 12.19 1.6 11.79 1.85 11.53L6.42 7Z",
      fill: "ink",
      box: "1.5 6.67 7.07 10.66",
    },
    {
      d: "M17.58 7C17.33 6.75 16.92 6.75 16.67 7L15.74 7.93C15.49 8.18 15.49 8.58 15.74 8.84L18.93 12.01L15.76 15.17C15.5 15.43 15.5 15.83 15.76 16.08L16.67 16.99C16.92 17.24 17.33 17.24 17.58 16.99L22.15 12.44C22.4 12.19 22.4 11.79 22.15 11.53L17.58 7Z",
      fill: "ink",
      box: "15.1 6.67 7.07 10.66",
    },
  ],
};

/** GFX brand identity defaults (production values; BRAND_OVERRIDES wins). */
export const GBFXS_DOMAIN: DomainDefinition = {
  key: "gbfxs",
  hosts: ["gbfxs.com", "gbfxs.localhost"],
  landingDesign: "gbfxs",
  publicDesign: "gbfxs",
  tradeEnabled: true,
  brand: {
    name: "Global Forex Services",
    shortName: "GFX",
    legalName: "Global Forex Services Ltd",
    supportEmail: "support@gbfxs.com",
    address: "Airedale House, 423 Kirkstall Road, Leeds, England, LS4 2EW",
    trademark: "GFX™",
    wordmark: ["Global Forex", "Services"],
    tradeEnabled: true,
    accentColor: "#f0b90b",
    emailColor: "#f0b90b",
    glyph: GBFXS_GLYPH,
    heroBadge: "GFX — Multi-asset execution",
    heroSubtitle:
      "Trade forex, indices, commodities and crypto on GFX — one multi-asset platform with live quotes, transparent pricing and segregated client funds.",
    ogImage: "/brands/gbfxs/og.png",
    markColor: "#f0b90b",
    logoLockup: "brackets",
    logoWord: "gbfxs",
    metaDescription:
      "Trade forex, indices, commodities and crypto on GBFXS — one multi-asset platform with live quotes, transparent pricing and segregated client funds.",
    landingTemplate: "gbfxs",
  },
  features: { trading: true, informers: true },
};
