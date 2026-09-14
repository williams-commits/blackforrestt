import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCE_LOGO = path.join(process.cwd(), "public", "brands", "gbfxs", "globalfx-logo.svg");

export async function GET(request: Request) {
  const theme = new URL(request.url).searchParams.get("theme");
  const dark = theme === "dark";
  const primary = dark ? "#f1f3f5" : "#151517";
  const accent = "#f0b90b";
  const source = await readFile(SOURCE_LOGO, "utf8");
  const svg = source
    .replaceAll("rgb(2,25,62)", primary)
    .replaceAll("rgb(0,136,253)", accent)
    .replace(/\s(width|height)="[^"]*"/g, "");

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
