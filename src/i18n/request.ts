import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";
import { defaultLocale, LOCALE_COOKIE, normalizeLocale, type Locale } from "./config";

/**
 * next-intl server-side locale resolver (cookie-based, non-routing mode).
 *
 * Resolution order:
 *   1. `NEXT_LOCALE` cookie (set by the LanguageSwitcher; shared across the apex
 *      and trade.* subdomains).
 *   2. `Accept-Language` header (first supported prefix).
 *   3. `defaultLocale` ("en").
 *
 * Returns `{ locale, messages }` for `NextIntlClientProvider`. Message files
 * live at src/messages/<locale>.json and are loaded eagerly (small, static).
 *
 * Reads `headers()` (the request cookie + Accept-Language) so it works under
 * `force-dynamic` rendering without any URL segment.
 */
export default getRequestConfig(async () => {
  const hdrs = await headers();
  const cookieHeader = hdrs.get("cookie") ?? "";
  const acceptLang = hdrs.get("accept-language") ?? "";

  // 1. Cookie
  let locale: Locale = defaultLocale;
  const cookieMatch = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${LOCALE_COOKIE}=`));
  if (cookieMatch) {
    locale = normalizeLocale(decodeURIComponent(cookieMatch.split("=")[1] ?? ""));
  } else {
    // 2. Accept-Language — take the first supported prefix
    const candidates = acceptLang
      .split(",")
      .map((part) => part.trim().split(";")[0])
      .filter(Boolean);
    for (const cand of candidates) {
      const norm = normalizeLocale(cand);
      if (norm !== defaultLocale || cand.toLowerCase().startsWith("en")) {
        locale = norm;
        break;
      }
    }
  }

  // Load messages for the resolved locale (and always have the default as a
  // fallback merged in so missing keys fall back to English).
  const [localeMsgs, defaultMsgs] = await Promise.all([
    import(`../messages/${locale}.json`),
    import(`../messages/${defaultLocale}.json`),
  ]);

  return {
    locale,
    messages: { ...(defaultMsgs.default as Record<string, unknown>), ...(localeMsgs.default as Record<string, unknown>) },
  };
});
