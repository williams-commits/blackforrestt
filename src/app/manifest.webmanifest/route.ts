import { currentBrandProfile } from "@/lib/branding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /manifest.webmanifest — per-domain PWA manifest (installable name and
 * theme follow the requesting brand family; icons use the generated
 * /brand/icon.svg). Replaces the static app/manifest.ts so mirror domains
 * such as agilefgs.com install under their own brand.
 */
export async function GET() {
  const brand = await currentBrandProfile();
  const manifest = {
    name: brand.name,
    short_name: brand.shortName,
    description: "Multi-asset online trading platform for forex, commodities, indices and crypto.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: brand.accentColor || "#fd7e14",
    icons: [
      { src: "/brand/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
