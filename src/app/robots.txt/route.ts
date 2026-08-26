import { currentBrandProfile } from "@/lib/branding";
import { headers } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /robots.txt — per-host robots. Each brand family is its own indexable
 * site: the sitemap/host directives point at the REQUESTING domain, not the
 * primary. Authenticated routes are disallowed everywhere (they live behind
 * login on the trade subdomain).
 */
export async function GET() {
  // CurrentBrandProfile resolves the family; the origin comes from proxy
  // headers so www/apex/trade all advertise their own host.
  await currentBrandProfile();
  const headerList = await headers();
  const host = (headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "").split(",")[0]!.trim();
  const proto = (headerList.get("x-forwarded-proto") ?? "https").split(",")[0]!.trim() || "https";
  const origin = `${proto}://${host}`;
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /trade/",
    "Disallow: /account",
    "Disallow: /admin",
    "Disallow: /reports",
    "Disallow: /login",
    "Disallow: /register",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    `Host: ${origin}`,
    "",
  ].join("\n");
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
