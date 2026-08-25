import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { mutationOriginAllowed } from "@/server/security/origin";

// Duplicated from @/i18n/config (importing that module here changes how the
// middleware bundle is compiled — node: imports in the auth chain then fail
// to resolve). Keep this list in sync with src/i18n/config.ts.
const LOCALES = ["en", "fr", "de", "es", "ja", "zh", "ru", "ar", "ko"] as const;
const DEFAULT_LOCALE = "en";
const LOCALE_COOKIE = "NEXT_LOCALE";

// Duplicated from @/lib/branding (same bundling concern as LOCALES above —
// keep this list logic in sync with brandDomains()/brandDomain() there).
// BRAND_DOMAINS is a comma-separated list of apex domains serving the same
// files; the FIRST entry is canonical (redirect targets, cookies' dot-domain,
// emails, SEO). BRAND_DOMAIN alone still works as a single-entry list.
function brandDomainList(): string[] {
  const raw = (process.env.BRAND_DOMAINS || process.env.BRAND_DOMAIN || "").trim().toLowerCase();
  const list = raw.split(",").map((entry) => entry.trim()).filter((entry) => entry.includes(".") && !entry.includes("://"));
  return list.length > 0 ? [...new Set(list)] : [];
}

// "tradeEnabled": true in BRAND_OVERRIDES — minimal duplicate of the
// BRAND_OVERRIDES read in src/lib/branding.ts (same bundling concern as
// brandDomainList above). Invalid JSON safely means "not enabled".
function familyTradeEnabled(domain: string): boolean {
  const raw = (process.env.BRAND_OVERRIDES || "").trim();
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as Record<string, { tradeEnabled?: boolean }>;
    return parsed[domain]?.tradeEnabled === true;
  } catch {
    return false;
  }
}

// Trade host serving a brand family's app, or null when the family has none.
// Resolution order — the DEPLOYMENT'S OWN declaration wins:
//   1. The DOMAIN_N / TRADE_DOMAIN_N env pairs (exactly what Caddy serves —
//      set in .env.production). This is the primary signal: if you stood up
//      TRADE_DOMAIN_2, routing follows automatically.
//   2. "tradeEnabled": true in BRAND_OVERRIDES (operator asserts the
//      subdomain's DNS + TLS exist even without a TRADE_DOMAIN_N pair).
//   3. Neither → the family's app traffic uses the canonical trade host.
// Reading only BRAND_OVERRIDES caused a silent cross-brand leak: forgetting
// the JSON flag sent agilefgs.com/logins to trade.blackforrestt.com while
// Caddy was happily serving trade.agilefgs.com.
function familyTradeHost(domain: string): string | null {
  const pairs: Array<[string | undefined, string | undefined]> = [
    [process.env.DOMAIN, process.env.TRADE_DOMAIN],
    [process.env.DOMAIN_2, process.env.TRADE_DOMAIN_2],
    [process.env.DOMAIN_3, process.env.TRADE_DOMAIN_3],
  ];
  for (const [apexVar, tradeVar] of pairs) {
    const apex = (apexVar ?? "").trim().toLowerCase();
    const trade = (tradeVar ?? "").trim().toLowerCase();
    if (apex === domain && trade) return trade;
  }
  if (familyTradeEnabled(domain)) return `${(process.env.TRADE_SUBDOMAIN ?? "trade").trim()}.${domain}`;
  return null;
}

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
 * The public origin of the incoming request, from proxy headers.
 *
 * NEVER build redirect/rewrite URLs from `req.url` here: with AUTH_URL set to
 * the trade subdomain (as in production), middleware's req.url can carry that
 * host regardless of the actual Host header — redirect targets then point at
 * the wrong origin and the two domains bounce a request between them forever
 * (ERR_TOO_MANY_REDIRECTS). This helper derives scheme + host from the real
 * request headers instead.
 */
function publicOrigin(req: Request): string {
  const proto = (req.headers.get("x-forwarded-proto") ?? "http").split(",")[0]!.trim() || "http";
  return `${proto}://${requestHost(req)}`;
}

/**
 * Domain routing: ensure each route is served on its intended origin.
 *
 * - Apex domains (e.g. blackforrestt.com AND any mirror domains configured in
 *   BRAND_DOMAINS): marketing + public market data only. Trade/auth/admin
 *   routes redirect to the CANONICAL trade subdomain (trade.<first domain>),
 *   so authentication/cookies always live on one host.
 * - Trade subdomains (e.g. trade.blackforrestt.com): authenticated app only.
 *   Marketing content routes redirect back to the apex of the same domain
 *   family, keeping mirror-domain visitors on the domain they arrived on.
 *
 * Only enforced when a brand domain is set (production). Local development on
 * localhost / 127.0.0.1 bypasses domain routing entirely.
 */
function domainRedirect(req: Request): NextResponse | null {
  const domains = brandDomainList();
  if (domains.length === 0) return null; // not configured — skip domain routing
  const brandDomain = domains[0]; // canonical domain for cross-family targets
  const tradeSubdomain = (process.env.TRADE_SUBDOMAIN ?? "trade").trim();
  const tradeHosts = new Set(domains.map((domain) => `${tradeSubdomain}.${domain}`));
  const tradeSub = tradeHosts.values().next().value as string; // canonical trade host

  const host = requestHost(req);
  // Strip a leading "www." so www.blackforrestt.com is treated as the apex.
  const apex = host.startsWith("www.") ? host.slice(4) : host;

  // Local development: don't redirect localhost / 127.0.0.1 / IP literals.
  if (host === "localhost" || host.startsWith("127.0.0.1") || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return null;
  }

  // req.url's path is reliable; its host is not (see publicOrigin) — rebuild
  // the URL on the real request origin.
  const incoming = new URL(req.url);
  const url = new URL(`${incoming.pathname}${incoming.search}`, publicOrigin(req));
  const { pathname } = url;

  // On any apex domain (primary or mirror): bounce trade/auth/admin routes to
  // that family's trade host (from DOMAIN_N/TRADE_DOMAIN_N or tradeEnabled);
  // families without one fall back to the canonical trade host.
  if (domains.includes(apex) && pathname !== "/") {
    if (TRADE_DOMAIN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      url.hostname = familyTradeHost(apex) ?? tradeSub;
      return NextResponse.redirect(url, 307);
    }
  }

  // On any trade subdomain: bounce marketing routes to the apex of the SAME
  // domain family, so mirror-domain visitors stay on their domain.
  // The landing page ("/") and all (content) routes are marketing — they
  // belong on the apex domain. Without this, clicking the logo on
  // trade.blackforrestt.com stays on the trade subdomain instead of going
  // to the marketing site.
  if (tradeHosts.has(host)) {
    const isMarketing =
      pathname === "/" ||
      MARKETING_DOMAIN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
    if (isMarketing) {
      const family = domains.find((domain) => host === `${tradeSubdomain}.${domain}`) ?? brandDomain;
      url.hostname = family;
      return NextResponse.redirect(url, 307);
    }
  }

  return null;
}

/** The configured brand domain that owns this host (apex or subdomain of it),
 *  or null for unknown hosts (e.g. localhost or an unconfigured alias). */
function cookieDomainForHost(host: string): string | null {
  const stripped = host.startsWith("www.") ? host.slice(4) : host;
  for (const domain of brandDomainList()) {
    if (stripped === domain || stripped.endsWith(`.${domain}`)) return domain;
  }
  return null;
}

/**
 * Cookie options for locale writes, scoped to the SAME dot-domain the
 * LanguageSwitcher uses (.brandDomain). Without the domain attribute the
 * middleware would create a HOST-ONLY cookie alongside the switcher's
 * dot-domain one — the browser then sends both, host-only first, and the
 * stale one wins (language appears stuck after switching back to English).
 */
function localeCookieOptions() {
  return {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax" as const,
  };
}

/** Write the locale cookie to BOTH scopes (host-only + dot-domain). Older
 *  middleware versions created a host-only cookie; a dot-domain-only write
 *  would leave that stale one winning, since browsers send host-only first.
 *  The cookies API replaces by name, so the dot-domain variant is appended
 *  as a raw Set-Cookie header to emit BOTH. The dot-domain is derived from
 *  the REQUEST host — a Domain=.primary.com attribute set while serving a
 *  mirror domain would be rejected by the browser and silently dropped. */
function setLocaleCookies(response: NextResponse, locale: string, req: Request) {
  response.cookies.set(LOCALE_COOKIE, locale, localeCookieOptions());
  const cookieDomain = cookieDomainForHost(requestHost(req));
  if (cookieDomain) {
    response.headers.append("set-cookie", `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax; Domain=.${cookieDomain}`);
  }
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
    // The cookie is stamped too: a visitor carrying a previous non-default
    // locale cookie would otherwise see the old language on the unprefixed URL.
    if (localePrefix === DEFAULT_LOCALE) {
      const canonicalPath = originalPathname.replace(LOCALE_PREFIX_RE, "") || "/";
      const response = NextResponse.redirect(new URL(`${canonicalPath}${req.nextUrl.search}`, publicOrigin(req)), 308);
      setLocaleCookies(response, DEFAULT_LOCALE, req);
      return response;
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
    // Marker so the sticky-prefix redirect below can tell this internally
    // rewritten request apart from a fresh unprefixed one — without it the
    // rewrite re-enters the middleware and redirects back to itself forever.
    headers.set("x-locale-resolved", localePrefix);
    // Absolute URL on the REAL request origin (Next requires a URL object; a
    // relative string 500s). Built from publicOrigin(req) — never req.url,
    // whose host can be the other origin (AUTH_URL), which turns the rewrite
    // into a cross-origin proxy that bounces between the domains forever.
    const response = NextResponse.rewrite(new URL(`${strippedPath}${req.nextUrl.search}`, publicOrigin(req)), { request: { headers } });
    setLocaleCookies(response, localePrefix, req);
    return response;
  }

  // Sticky locale prefix: an unprefixed marketing URL requested with a
  // non-default locale cookie redirects to the prefixed URL, so the visible
  // URL always matches the rendered language and shared links carry the
  // language. Crawlers send no cookies and always see the unprefixed
  // canonical. Skipped for API requests and on the trade host (the app area
  // has no locale-prefixed URLs — there the cookie alone decides rendering).
  const cookieLocale = req.cookies.get(LOCALE_COOKIE)?.value;
  const tradeSubdomainLabel = (process.env.TRADE_SUBDOMAIN ?? "trade").trim();
  const onTradeHost = brandDomainList().some((domain) => requestHost(req) === `${tradeSubdomainLabel}.${domain}`);
  if (
    cookieLocale &&
    (LOCALES as readonly string[]).includes(cookieLocale) &&
    cookieLocale !== DEFAULT_LOCALE &&
    !strippedPath.startsWith("/api/") &&
    !onTradeHost &&
    !req.headers.get("x-locale-resolved")
  ) {
    const target = new URL(`/${cookieLocale}${strippedPath}${req.nextUrl.search}`, publicOrigin(req));
    return NextResponse.redirect(target, 307);
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
