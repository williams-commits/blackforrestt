import type { MetadataRoute } from "next";
import { brandDomain } from "@/lib/branding";

/**
 * robots.txt — allow all crawlers to index the marketing domain. Authenticated
 * routes (/trade/*, /account, /admin, /api/*) are disallowed because they live
 * behind login on the trade subdomain.
 */
export default function robots(): MetadataRoute.Robots {
  const domain = brandDomain();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/trade/", "/account", "/admin", "/reports", "/login", "/register"],
      },
    ],
    sitemap: `https://${domain}/sitemap.xml`,
    host: `https://${domain}`,
  };
}
