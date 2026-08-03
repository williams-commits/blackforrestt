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
 * Protect authenticated client pages and APIs. Admin routes retain their own
 * explicit role checks. A valid authenticated session is always required.
 */
export default auth((req) => {
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
    "/trade/:path*",
    "/account/:path*",
    "/reports/:path*",
    "/login",
    "/register",
    "/api/:path*",
  ],
};
