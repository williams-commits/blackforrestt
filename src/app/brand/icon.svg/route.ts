import { readFile } from "node:fs/promises";
import path from "node:path";
import { currentBrandProfile } from "@/lib/branding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Default tree-mark glyph (identical to the Logo component's inline SVG). */
const DEFAULT_GLYPH_PATHS = [
  "M12 1.5 7.5 9H10l-3 5.5H9.5L7 19h10l-2.5-4.5H17l-3-5.5h2.5L12 1.5Z",
  "M11 19h2v3.5h-2z",
];

/** Brands with a custom favicon file at public/brands/<slug>/favicon.svg —
 *  the actual logo artwork, served verbatim. Everyone else gets the
 *  glyph-generated mark below. */
const CUSTOM_FAVICON_SLUGS = new Set(["gbfxs"]);

/**
 * GET /brand/icon.svg — per-domain favicon. Brands with a favicon.svg in
 * their brand asset folder get that exact logo; other brands get the mark
 * generated from their profile (custom glyph + accent, default tree mark).
 * Served through the app origin so it inherits the family's host and TLS.
 */
export async function GET() {
  const brand = await currentBrandProfile();
  const slug = (brand.domain || "").split(".")[0];

  if (CUSTOM_FAVICON_SLUGS.has(slug)) {
    try {
      const svg = await readFile(
        path.join(process.cwd(), "public", "brands", slug, "favicon.svg"),
        "utf8",
      );
      return new Response(svg, {
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "private, max-age=3600",
        },
      });
    } catch {
      // fall through to the generated mark if the file is missing
    }
  }

  const accent = brand.markColor || brand.accentColor || "#fd7e14";
  const viewBox = brand.glyph?.viewBox ?? "0 0 24 24";
  const paths = brand.glyph?.paths ?? DEFAULT_GLYPH_PATHS.map((d) => ({ d, fill: "accent" as const }));
  // Optional brand background: a rounded square behind the glyph (guards
  // legibility of fine marks at favicon sizes). Validated like safeBrandColor.
  const rawBg = brand.glyph?.background ?? "";
  const background = /^#[0-9a-fA-F]{3,8}$/.test(rawBg) ? rawBg : null;
  // Optional center letter (e.g. the "e" of a bracket lockup) — bold system
  // sans so the favicon never depends on webfont loading.
  const letter = brand.glyph?.letter;
  const letterText =
    letter && /^[A-Za-z0-9]$/.test(letter.text)
      ? `<text x="12" y="12.2" text-anchor="middle" dominant-baseline="central" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="${letter.size}" fill="#111827">${letter.text}</text>`
      : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${
    background ? `<rect x="0" y="0" width="24" height="24" rx="5.5" fill="${background}"/>` : ""
  }${paths
    .map((path) => `<path d="${path.d}" fill="${path.fill === "ink" ? "#111827" : accent}"/>`)
    .join("")}${letterText}</svg>`;
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      // Per-host content behind one URL — keep it out of shared CDNs caches.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
