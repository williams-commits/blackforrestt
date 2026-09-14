import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCE_LOGO = path.join(process.cwd(), "public", "brands", "gbfxs", "globalfx-logo.svg");

export async function GET() {
  const source = await readFile(SOURCE_LOGO, "utf8");
  const paths = [...source.matchAll(/<path[^>]*d="([^"]+)"[^>]*fill="([^"]+)"[^>]*\/>/g)]
    .map((match) => `<path d="${match[1]}" fill="${match[2].includes("0,136,253") ? "#f0b90b" : "#f1f3f5"}"/>`)
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#0a0a0b"/><rect x="0" y="0" width="14" height="630" fill="#f0b90b"/><g transform="translate(72 106) scale(.62)">${paths}</g><text x="76" y="545" fill="#a9a9ae" font-family="Arial, Helvetica, sans-serif" font-size="24" letter-spacing="2">GLOBAL FOREX SERVICES</text></svg>`;
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
