import { currentBrandProfile } from "@/lib/branding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Default tree-mark glyph (identical to the Logo component's inline SVG). */
const DEFAULT_GLYPH_PATHS = [
  "M12 1.5 7.5 9H10l-3 5.5H9.5L7 19h10l-2.5-4.5H17l-3-5.5h2.5L12 1.5Z",
  "M11 19h2v3.5h-2z",
];

/**
 * GET /brand/icon.svg — per-domain favicon generated from the request's brand
 * profile (custom glyph + accent color, defaulting to the primary tree mark).
 * Served through the app origin so it inherits the family's host and TLS.
 */
export async function GET() {
  const brand = await currentBrandProfile();
  const accent = brand.markColor || brand.accentColor || "#fd7e14";
  const viewBox = brand.glyph?.viewBox ?? "0 0 24 24";
  const paths = brand.glyph?.paths ?? DEFAULT_GLYPH_PATHS.map((d) => ({ d, fill: "accent" as const }));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${paths
    .map((path) => `<path d="${path.d}" fill="${path.fill === "ink" ? "#111827" : accent}"/>`)
    .join("")}</svg>`;
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      // Per-host content behind one URL — keep it out of shared CDNs caches.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
