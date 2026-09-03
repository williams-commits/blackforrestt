import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { consumeApiMutation } from "@/server/security/rateLimit";

// The auth() wrapper decodes the session JWT (jose, no DB hit) so decisions
// are made on a VERIFIED session — never on mere cookie presence. This
// matters when a cookie was encrypted under a previous AUTH_SECRET: an
// undecryptable cookie decodes to no session, the user is sent to /login,
// and signing in issues a fresh cookie. With a cookie-presence check the
// user would bounce between / (needs session) and /login (sees a cookie)
// forever with no way out.
const PUBLIC_PREFIXES = ["/login", "/api/auth", "/api/health"];

// Asset paths must never pass through the auth wrapper: a redirect here
// makes the browser load the login HTML for a <script src>, which surfaces
// as "Uncaught SyntaxError: Unexpected token '<'". NOTE: these CANNOT be
// excluded via a custom-regex matcher (negative lookahead) — the
// nodejs-runtime middleware in Next 15.5 does not honor custom-regex
// matchers, and the middleware then runs on asset paths anyway. Keep this
// list as an in-code bypass; the matcher below stays regex-free.
const ASSET_PREFIXES = ["/_next/", "/favicon.ico", "/icon.svg", "/manifest.webmanifest", "/robots.txt"];

/** Baseline security headers on every response (edge Caddy adds HSTS). */
function withSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return response;
}

/** Client IP for rate limiting (behind Caddy in production). */
function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Same-origin gate for mutating API calls (defense-in-depth on top of
 * Auth.js CSRF): when a browser sends an Origin header it must match the
 * request host. Server-to-server callers (the platform bridge) send no
 * Origin and pass.
 */
function mutationOriginAllowed(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host;
    const requestHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
    return originHost === requestHost;
  } catch {
    return false;
  }
}

const authHandler = auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const hasSession = Boolean(req.auth?.user?.id);

  if (isPublic) {
    // A genuinely signed-in user has no business on the login page; a stale
    // cookie decodes to no session and falls through to the form.
    if (pathname === "/login" && hasSession) {
      return withSecurityHeaders(NextResponse.redirect(new URL("/", req.url)));
    }
    return withSecurityHeaders(NextResponse.next());
  }

  // Mutating API calls: same-origin check + per-IP throttle.
  if (pathname.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    if (!mutationOriginAllowed(req)) {
      return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 });
    }
    const limit = consumeApiMutation(clientIp(req));
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests — slow down." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
      );
    }
  }

  if (!hasSession) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", `${pathname}${req.nextUrl.search}`);
    return withSecurityHeaders(NextResponse.redirect(url, 307));
  }
  return withSecurityHeaders(NextResponse.next());
});

export default async function middleware(req: NextRequest) {
  // Never run the auth() wrapper over Auth.js's own endpoints: the wrapper
  // and the route handler each initialize the CSRF cookie independently,
  // emitting two different values in one response — the browser keeps the
  // second while the returned token matches the first, so every login
  // submit fails with MissingCSRF. Auth.js routes carry their own
  // CSRF/state protection.
  const { pathname } = req.nextUrl;
  if (pathname === "/api/auth" || pathname.startsWith("/api/auth/")) {
    return withSecurityHeaders(NextResponse.next());
  }

  // Static assets pass through untouched (see ASSET_PREFIXES note above).
  if (ASSET_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // auth()'s second parameter (route context) is unused here; satisfy its
  // type without depending on Next's event shape.
  return authHandler(req, { params: Promise.resolve({}) });
}

export const config = {
  // Auth imports Prisma and bcrypt, so middleware runs on the Node.js
  // runtime (Next.js 15.5+) rather than an Edge bundle. The matcher must
  // stay free of custom regex — see the ASSET_PREFIXES note. (No `as const`
  // here: Next's config parser cannot read TS const assertions.)
  runtime: "nodejs",
  matcher: ["/:path*"],
};
