import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";

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
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", `${pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(url, 307);
  }
  return NextResponse.next();
});

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Never run the auth() wrapper over Auth.js's own endpoints: the wrapper
  // and the route handler each initialize the CSRF cookie independently,
  // emitting two different values in one response — the browser keeps the
  // second while the returned token matches the first, so every login
  // submit fails with MissingCSRF. Auth.js routes carry their own
  // CSRF/state protection.
  if (pathname === "/api/auth" || pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
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
