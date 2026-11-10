import { readFile } from "node:fs/promises";
import path from "node:path";
import { currentBrandProfile } from "@/lib/branding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_GLYPH_PATHS = [
  "M12 1.5 7.5 9H10l-3 5.5H9.5L7 19h10l-2.5-4.5H17l-3-5.5h2.5L12 1.5Z",
  "M11 19h2v3.5h-2z",
];

export async function GET() {
  const brand = await currentBrandProfile();
  if ((brand.domain || "").split(".")[0] === "gbfxs") {
    const svg = await readFile(
      path.join(process.cwd(), "public", "brands", "gbfxs", "favicon.svg"),
      "utf8",
    );
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  const accent = brand.markColor || brand.accentColor || "#fd7e14";
  const viewBox = brand.glyph?.viewBox ?? "0 0 24 24";
  const paths = brand.glyph?.paths ?? DEFAULT_GLYPH_PATHS.map((d) => ({ d, fill: "accent" as const }));
  const rawBg = brand.glyph?.background ?? "";
  const background = /^#[0-9a-fA-F]{3,8}$/.test(rawBg) ? rawBg : null;
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
      "Cache-Control": "private, max-age=3600",
    },
  });
}
