import type { DesignManifest } from "@/designs/contracts";

/**
 * CONVERTIO design — elegant institutional trading platform.
 *
 * Inspired by the Coinbase design language: white-canvas editorial calm,
 * a single brand-blue accent, weight-400 display type, pill CTAs,
 * dark-hero band rotation with floating product-UI mockup cards.
 *
 * Font substitutes per the spec: Inter (display + body), JetBrains Mono (numbers).
 */
export const design: DesignManifest = {
  key: "convertio",
  landing: async () => (await import("./landing/ConvertioLanding")).ConvertioLanding,
  publicShell: async () => (await import("./public/ConvertioPublicShell")).ConvertioPublicShell,
};
