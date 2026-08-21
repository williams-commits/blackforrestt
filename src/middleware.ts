import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { mutationOriginAllowed } from "@/server/security/origin";

// Duplicated from @/i18n/config (importing that module here changes how the
// middleware bundle is compiled — node: imports in the auth chain then fail
// to resolve). Keep this list in sync with src/i18n/config.ts.
const LOCALES = ["en", "fr", "de", "es", "ja", "zh", "ru", "ar", "ko"] as const;
const DEFAULT_LOCALE = "en";
const LOCALE_COOKIE = "NEXT_LOCALE";

const PROTECTED_PAGES = ["/trade", "/account", "/reports"];
const PROTECTED_APIS = [
  "/api/account",
  "/api/kyc",
  "/api/password",
  "/api/positions",
  "/api/profile",
  "/api/transactions",
  "/api/wallet",
  "/api/security/mfa",
  "/api/security/sessions",
  "/api/security/step-up",
  "/api/support/cases",
];

/**
 * Routes that belong on the trade subdomain. If a request for any of these
 * arrives on the apex (marketing) domain, redirect to the same path on
 * `https://trade.<brand domain>`. This keeps authenticated traffic off the
 * marketing origin entirely.
 */
const TRADE_DOMAIN_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/trade",
  "/account",
  "/reports",
  "/admin",
  // NOTE: /api/auth and /api/notifications are intentionally NOT redirected —
  // they are called by the root layout's Providers (SessionProvider +
  // ToastNotifications) on EVERY page including the apex marketing domain.
  // Redirecting them causes cross-origin CORS failures. They work same-origin
  // on both domains; on the apex they return unauthenticated/empty.
  "/api/account",
  "/api/kyc",
  "/api/password",
  "/api/positions",
  "/api/profile",
  "/api/transactions",
  "/api/wallet",
  "/api/security",
  "/api/admin",
  "/api/register",
  "/api/support/cases",
];

/**
 * Marketing routes that belong on the apex domain. If a request for these
 * arrives on the trade subdomain, redirect to the apex domain. The trade
 * subdomain is for the authenticated application only.
 */
const MARKETING_DOMAIN_PREFIXES = [
  "/about",
  "/contact",
  "/analytics",
  "/tools",
  "/education",
  "/legal",
];

/**
 * Resolve the host (hostname only, no port) from the request, honoring the
 * X-Forwarded-Host header set by the reverse proxy (Caddy).
 */
function requestHost(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-host");
  if (forwarded) return forwarded.split(",")[0]!.trim().toLowerCase();
  return (req.headers.get("host") ?? "").toLowerCase();
}

/**
 * Domain routing: ensure each route is served on its intended origin.
 *
 * - Apex domain (e.g. blackforrestt.com): marketing + public market data only.
 *   Trade/auth/admin routes redirect to the trade subdomain.
 * - Trade subdomain (e.g. trade.blackforrestt.com): authenticated app only.
 *   Marketing content routes redirect to the apex domain.
 *
 * Only enforced when BRAND_DOMAIN is set (production). Local development on
 * localhost / 127.0.0.1 bypasses domain routing entirely.
 */
function domainRedirect(req: Request): NextResponse | null {
  const brandDomain = (process.env.BRAND_DOMAIN ?? "").trim().toLowerCase();
  if (!brandDomain) return null; // not configured — skip domain routing

  const host = requestHost(req);
  // Strip a leading "www." so www.blackforrestt.com is treated as the apex.
  const apex = host.startsWith("www.") ? host.slice(4) : host;
  const tradeSub = `${(process.env.TRADE_SUBDOMAIN ?? "trade").trim()}.${brandDomain}`;

  // Local development: don't redirect localhost / 127.0.0.1 / IP literals.
  if (host === "localhost" || host.startsWith("127.0.0.1") || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return null;
  }

  const url = new URL(req.url);
  const { pathname } = url;

  // On the apex domain: bounce trade/auth/admin routes to the trade subdomain.
  if (apex === brandDomain && pathname !== "/") {
    if (TRADE_DOMAIN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      url.hostname = tradeSub;
      return NextResponse.redirect(url, 307);
    }
  }

  // On the trade subdomain: bounce marketing routes to the apex.
  // The landing page ("/") and all (content) routes are marketing — they
  // belong on the apex domain. Without this, clicking the logo on
  // trade.blackforrestt.com stays on the trade subdomain instead of going
  // to the marketing site.
  if (host === tradeSub) {
    const isMarketing =
      pathname === "/" ||
      MARKETING_DOMAIN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
    if (isMarketing) {
      url.hostname = brandDomain;
      return NextResponse.redirect(url, 307);
    }
  }

  return null;
}

/**
 * URL-based locales for search engines: marketing URLs may carry a locale
 * prefix (e.g. /fr/about). The prefix is stripped and the locale injected via
 * the NEXT_LOCALE cookie on the forwarded request, so the existing cookie
 * resolver (src/i18n/request.ts) renders that language while the browser keeps
 * the prefixed URL. Crawlers (cookie-less) see one consistent language per URL,
 * which hreflang alternates + the sitemap advertise.
 *
 *   /about        → default locale (en), no prefix — canonical for en
 *   /fr/about     → renders French (rewrite, URL preserved)
 *   /en/about     → 308 redirect to /about (single canonical per language)
 */
const LOCALE_PREFIX_RE = new RegExp(`^/(${LOCALES.join("|")})(?=/|$)`);

export default auth((req) => {
  // Locale-prefix extraction runs before everything: later checks (domain
  // routing, auth) operate on the stripped path so prefixed URLs behave
  // exactly like their unprefixed counterparts.
  const prefixMatch = LOCALE_PREFIX_RE.exec(req.nextUrl.pathname);
  const localePrefix = prefixMatch?.[1];
  const originalPathname = req.nextUrl.pathname;
  const strippedPath = localePrefix
    ? req.nextUrl.pathname.slice(prefixMatch![0].length) || "/"
    : req.nextUrl.pathname;
  if (localePrefix) {
    req.nextUrl.pathname = strippedPath;
  }

  // Domain routing runs first, before auth — it's a pure host/path check.
  const redirect = domainRedirect(req);
  if (redirect) {
    // Preserve the locale prefix across cross-domain redirects (e.g. /fr/about
    // opened on the trade host → apex /fr/about).
    if (localePrefix) {
      const location = redirect.headers.get("location");
      if (location) {
        const target = new URL(location);
        target.pathname = originalPathname;
        return NextResponse.redirect(target, 307);
      }
    }
    return redirect;
  }

  if (localePrefix) {
    // Prefixed default locale → permanent redirect to the unprefixed canonical.
    if (localePrefix === DEFAULT_LOCALE) {
      return NextResponse.redirect(new URL(originalPathname.replace(LOCALE_PREFIX_RE, "") || "/", req.url), 308);
    }
    // Non-default locale: rewrite to the stripped path with the locale cookie
    // injected into the forwarded request headers (read by request.ts) and
    // persisted on the response so subsequent unprefixed links keep the locale.
    const headers = new Headers(req.headers);
    const cookie = headers.get("cookie") ?? "";
    const updated = cookie.includes(`${LOCALE_COOKIE}=`)
      ? cookie.replace(new RegExp(`${LOCALE_COOKIE}=[^;]*`), `${LOCALE_COOKIE}=${localePrefix}`)
      : `${cookie ? `${cookie}; ` : ""}${LOCALE_COOKIE}=${localePrefix}`;
    headers.set("cookie", updated);
    // A fresh same-origin URL (not the mutated nextUrl) keeps this an internal
    // rewrite — passing nextUrl makes dev-mode treat it as a proxy target.
    const response = NextResponse.rewrite(new URL(strippedPath, req.url), { request: { headers } });
    response.cookies.set(LOCALE_COOKIE, localePrefix, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return response;
  }

  const { pathname } = req.nextUrl;
  const isProtectedPage = PROTECTED_PAGES.some((prefix) => pathname.startsWith(prefix));
  const isGuestOnlyPage = pathname === "/login" || pathname === "/register";
  const isProtectedApi = PROTECTED_APIS.some((prefix) => pathname.startsWith(prefix));

  // Auth.js protects its own callback endpoints with its CSRF/state controls.
  // Applying the app-wide Origin gate to /api/auth/* breaks credentials login
  // when the site is reached through an allowed reverse-proxy host or local
  // alias (for example 127.0.0.1 instead of localhost).
  const isAuthApi = pathname.startsWith("/api/auth/");
  // The public support intake form is unauthenticated and accepts submissions
  // from both domains; the Origin gate would reject cross-subdomain POSTs if
  // APP_ORIGIN isn't perfectly configured. Honeypot + rate limit defend it.
  const isPublicSupportApi = pathname === "/api/support";
  if (!isAuthApi && !isPublicSupportApi && pathname.startsWith("/api/") && !mutationOriginAllowed(req)) {
    return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 });
  }
  if (isGuestOnlyPage && req.auth?.user?.id) {
    const accountUrl = req.nextUrl.clone();
    accountUrl.pathname = "/account";
    accountUrl.search = "";
    return NextResponse.redirect(accountUrl);
  }
  if (!isProtectedPage && !isProtectedApi) return;
  if (req.auth?.user?.id) return;

  if (isProtectedApi) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("callbackUrl", `${pathname}${req.nextUrl.search}`);
  return NextResponse.redirect(url);
});

export const config = {
  // Auth imports Prisma and bcrypt, so run middleware on the stable Node.js
  // runtime available in Next.js 15.5+ instead of attempting an Edge bundle.
  runtime: "nodejs",
  matcher: [
    // Trade / authenticated routes (existing).
    "/trade/:path*",
    "/account/:path*",
    "/reports/:path*",
    "/login",
    "/register",
    "/api/:path*",
    // Marketing content routes — needed so domainRedirect() can fire and send
    // them to the apex when accessed from the trade subdomain.
    "/about/:path*",
    "/contact/:path*",
    "/analytics/:path*",
    "/tools/:path*",
    "/education/:path*",
    "/legal/:path*",
    // Admin + auth-flow pages accessed on the apex need redirecting to trade.
    "/admin/:path*",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    // The root: landing on the apex, but redirect to trade if it ever needs to.
    "/",
    // Locale-prefixed marketing URLs (/fr/about) — handled at the top of the
    // middleware: prefix stripped, locale injected via the NEXT_LOCALE cookie.
    // Locale-prefixed marketing URLs (/fr, /fr/about). NOTE: the segment is
    // intentionally UNCONSTRAINED — custom-regex matchers like
    // /:locale(en|fr|…) break the nodejs-runtime middleware compilation in
    // Next 15.5 (node: imports in the auth chain stop resolving). The
    // LOCALE_PREFIX_RE inside the middleware filters real locales; other
    // first segments fall through untouched.
    "/:locale/:path*",
  ],
};
