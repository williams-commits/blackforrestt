/**
 * GBFXS SEO defaults — mirrored into the manifest's brand block at build time;
 * env (BRAND_OVERRIDES.metaDescription etc.) still overrides at runtime.
 */
export const GBFXS_SEO = {
  titleSuffix: "GBFXS",
  metaDescription:
    "Trade forex, indices, commodities and crypto on GBFXS — one multi-asset platform with live quotes, transparent pricing and segregated client funds.",
  ogImage: "/brands/gbfxs/og.png",
} as const;
