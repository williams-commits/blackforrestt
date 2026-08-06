import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { mutationOriginAllowed } from "@/server/security/origin";

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
  "/api/auth",
  "/api/account",
  "/api/kyc",
  "/api/password",
  "/api/positions",
  "/api/profile",
  "/api/transactions",
  "/api/wallet",
  "/api/notifications",
  "/api/security",
  "/api/admin",
  "/api/register",
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
  const { pathname, search } = url;

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
 * Protect authenticated client pages and APIs. Admin routes retain their own
 * explicit role checks. A valid authenticated session is always required.
 */
export default auth((req) => {
  // Domain routing runs first, before auth — it's a pure host/path check.
  const redirect = domainRedirect(req);
  if (redirect) return redirect;

  const { pathname } = req.nextUrl;
  const isProtectedPage = PROTECTED_PAGES.some((prefix) => pathname.startsWith(prefix));
  const isGuestOnlyPage = pathname === "/login" || pathname === "/register";
  const isProtectedApi = PROTECTED_APIS.some((prefix) => pathname.startsWith(prefix));

  // Auth.js protects its own callback endpoints with its CSRF/state controls.
  // Applying the app-wide Origin gate to /api/auth/* breaks credentials login
  // when the site is reached through an allowed reverse-proxy host or local
  // alias (for example 127.0.0.1 instead of localhost).
  const isAuthApi = pathname.startsWith("/api/auth/");
  if (!isAuthApi && pathname.startsWith("/api/") && !mutationOriginAllowed(req)) {
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
  ],
};
