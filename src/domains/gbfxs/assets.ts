/**
 * GBFXS asset registry — every public asset the domain references. Validators
 * resolve each path against public/ at domain:validate / doctor time.
 */
export const GBFXS_ASSETS = {
  ogImage: "/brands/gbfxs/og.png",
  heroBackground: "/brands/gbfxs/backgrounds/hero-bg.jpg",
  ctaBackground: "/brands/gbfxs/backgrounds/cta-bg.jpg",
  testimonialAvatars: "/brands/gbfxs/testimonials/",
} as const;
