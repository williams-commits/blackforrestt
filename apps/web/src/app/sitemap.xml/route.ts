import { currentBrandProfile } from "@/lib/branding";
import { headers } from "next/headers";
import { locales } from "@/i18n/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTES: { path: string; priority: string; changeFrequency: string }[] = [
  { path: "", priority: "1.0", changeFrequency: "weekly" },
  { path: "/about", priority: "0.8", changeFrequency: "monthly" },
  { path: "/contact", priority: "0.8", changeFrequency: "monthly" },
  { path: "/analytics/news", priority: "0.7", changeFrequency: "daily" },
  { path: "/analytics/technical", priority: "0.7", changeFrequency: "daily" },
  { path: "/analytics/fundamental", priority: "0.7", changeFrequency: "daily" },
  { path: "/analytics/trend", priority: "0.7", changeFrequency: "weekly" },
  { path: "/tools/informers", priority: "0.6", changeFrequency: "weekly" },
  { path: "/tools/calendars", priority: "0.6", changeFrequency: "daily" },
  { path: "/tools/calculators", priority: "0.6", changeFrequency: "monthly" },
  { path: "/tools/signals", priority: "0.6", changeFrequency: "daily" },
  { path: "/education/beginners", priority: "0.6", changeFrequency: "monthly" },
  { path: "/education/advanced", priority: "0.6", changeFrequency: "monthly" },
  { path: "/education/beginners-vods", priority: "0.6", changeFrequency: "monthly" },
  { path: "/education/advanced-vods", priority: "0.6", changeFrequency: "monthly" },
  { path: "/education/crypto-vods", priority: "0.6", changeFrequency: "monthly" },
  { path: "/legal/terms", priority: "0.3", changeFrequency: "monthly" },
  { path: "/legal/privacy", priority: "0.3", changeFrequency: "monthly" },
  { path: "/legal/kyc", priority: "0.3", changeFrequency: "monthly" },
  { path: "/legal/aml", priority: "0.3", changeFrequency: "monthly" },
];

function localePath(path: string, locale: string): string {
  if (locale === locales[0]) return path || "/";
  return `/${locale}${path}`;
}

function xmlEscape(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/**
 * GET /sitemap.xml — per-host sitemap. Every brand family advertises ITS OWN
 * URLs (self-canonical site), including hreflang alternates per locale.
 * Authenticated routes are excluded — they live behind login on the trade
 * subdomain.
 */
export async function GET() {
  await currentBrandProfile(); // family resolution (unused value; keeps parity with robots)
  const headerList = await headers();
  const host = (headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "").split(",")[0]!.trim();
  const proto = (headerList.get("x-forwarded-proto") ?? "https").split(",")[0]!.trim() || "https";
  const base = `${proto}://${host}`;
  const now = new Date().toISOString();

  const entries = ROUTES.map(({ path, priority, changeFrequency }) => {
    const alternates = locales
      .map((locale) => `    <xhtml:link rel="alternate" hreflang="${locale}" href="${xmlEscape(`${base}${localePath(path, locale)}`)}"/>`)
      .join("\n");
    return [
      "  <url>",
      `    <loc>${xmlEscape(`${base}${path}`)}</loc>`,
      `    <lastmod>${now}</lastmod>`,
      `    <changefreq>${changeFrequency}</changefreq>`,
      `    <priority>${priority}</priority>`,
      alternates,
      "  </url>",
    ].join("\n");
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join("\n")}
</urlset>
`;
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
