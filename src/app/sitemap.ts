import type { MetadataRoute } from "next";
import { brandDomain } from "@/lib/branding";
import { locales } from "@/i18n/config";
import { localePath } from "@/lib/seo";

/**
 * Dynamic sitemap for the marketing domain. Only public/marketing routes are
 * listed — authenticated routes (/trade, /account, /admin, etc.) are excluded
 * because they live on the trade subdomain and require a login.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const domain = brandDomain();
  const base = `https://${domain}`;
  const now = new Date();

  const routes: { path: string; priority: number; changeFrequency: "monthly" | "weekly" | "daily" }[] = [
    { path: "", priority: 1.0, changeFrequency: "weekly" },
    { path: "/about", priority: 0.8, changeFrequency: "monthly" },
    { path: "/contact", priority: 0.8, changeFrequency: "monthly" },
    { path: "/analytics/news", priority: 0.7, changeFrequency: "daily" },
    { path: "/analytics/technical", priority: 0.7, changeFrequency: "daily" },
    { path: "/analytics/fundamental", priority: 0.7, changeFrequency: "daily" },
    { path: "/analytics/trend", priority: 0.7, changeFrequency: "weekly" },
    { path: "/tools/informers", priority: 0.6, changeFrequency: "weekly" },
    { path: "/tools/calendars", priority: 0.6, changeFrequency: "daily" },
    { path: "/tools/calculators", priority: 0.6, changeFrequency: "monthly" },
    { path: "/tools/signals", priority: 0.6, changeFrequency: "daily" },
    { path: "/education/beginners", priority: 0.6, changeFrequency: "monthly" },
    { path: "/education/advanced", priority: 0.6, changeFrequency: "monthly" },
    { path: "/education/beginners-vods", priority: 0.6, changeFrequency: "monthly" },
    { path: "/education/advanced-vods", priority: 0.6, changeFrequency: "monthly" },
    { path: "/education/crypto-vods", priority: 0.6, changeFrequency: "monthly" },
    { path: "/legal/terms", priority: 0.3, changeFrequency: "monthly" },
    { path: "/legal/privacy", priority: 0.3, changeFrequency: "monthly" },
    { path: "/legal/kyc", priority: 0.3, changeFrequency: "monthly" },
    { path: "/legal/aml", priority: 0.3, changeFrequency: "monthly" },
  ];

  return routes.map(({ path, priority, changeFrequency }) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
    // One entry per page with hreflang alternates — crawlers discover every
    // locale variant (/fr/about, /de/about, …) from the default-language URL.
    alternates: {
      languages: Object.fromEntries(
        locales.map((locale) => [locale, `${base}${localePath(path, locale)}`]),
      ) satisfies Record<string, string>,
    },
  }));
}
