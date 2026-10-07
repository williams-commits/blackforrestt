import { NextResponse, type NextRequest } from "next/server";

/**
 * Trade-app edge routing. The trading platform serves ONLY its own routes;
 * marketing paths arriving on the trade origin (logo clicks, footer links)
 * bounce to the marketing app — in production the apex of the same domain
 * family (strip the trade. prefix), in local development WEB_DEV_ORIGIN
 * (default http://localhost:3000, where apps/web runs).
 */

const MARKETING_PREFIXES = [
  "/",
  "/about",
  "/contact",
  "/tools",
  "/analytics",
  "/education",
  "/docs",
  "/brand",
  "/privacy-policy",
  "/aml-policy",
  "/kyc-policy",
  "/terms-of-service",
];

const isMarketingPath = (pathname: string) =>
  MARKETING_PREFIXES.some((p) => pathname === p || (p !== "/" && pathname.startsWith(`${p}/`)));

function isLocalHost(host: string): boolean {
  return /(^|\.)(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host);
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (!isMarketingPath(pathname)) return NextResponse.next();

  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(",")[0]!.trim();
  if (isLocalHost(host)) {
    const webOrigin = process.env.WEB_DEV_ORIGIN ?? "http://localhost:3000";
    return NextResponse.redirect(new URL(`${pathname}${search}`, webOrigin), 307);
  }

  // trade.<apex> → <apex> (same family, same scheme).
  const apex = host.replace(/^[a-z0-9-]+\./i, (m) => (m.toLowerCase() === "trade." ? "" : m));
  if (apex !== host) {
    return NextResponse.redirect(new URL(`${pathname}${search}`, `https://${apex}`), 307);
  }
  return NextResponse.next();
}

export const config = {
  runtime: "nodejs" as const,
  matcher: ["/:path*"],
};
