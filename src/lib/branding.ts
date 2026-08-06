/**
 * Centralised branding helpers. Read from environment variables (with sensible
 * defaults) so the platform name, contact details, and legal entity can be
 * configured in one place. Server components call these directly; client
 * components read NEXT_PUBLIC_BRAND_NAME (the only value the client needs).
 *
 * The email subsystem (src/server/email/templates.ts) keeps its own EMAIL_*
 * vars but defaults EMAIL_BRAND_NAME to brandName() so the two stay consistent.
 *
 * IMPORTANT: these helpers use `||` (not `??`) because Next.js bake-time env
 * vars can arrive as empty strings (e.g. an unset Docker build ARG defaults to
 * ""). `??` only catches null/undefined, so an empty string would silently win
 * over the fallback — producing an empty brand name in the title. `||` treats
 * empty strings as falsy, so the fallback always applies when no real value is
 * present.
 */

/** Public brand name shown in the UI (e.g. "Black Forest Digital"). Client-safe via NEXT_PUBLIC_. */
export function brandName(): string {
  return (process.env.NEXT_PUBLIC_BRAND_NAME || process.env.BRAND_NAME || "Black Forest Digital").trim();
}

/** Short brand name for tight spaces / wordmark (e.g. "Black Forest"). */
export function brandShortName(): string {
  return (process.env.BRAND_NAME || "Black Forest").trim();
}

/** Registered legal entity name used in legal pages and the footer (e.g. "Black Forest Digital LTD"). */
export function companyLegalName(): string {
  return (process.env.COMPANY_LEGAL_NAME || `${brandName()} LTD`).trim();
}

/** Support/contact email shown in the UI and legal pages. */
export function supportEmail(): string {
  return (process.env.SUPPORT_EMAIL || "support@example.com").trim();
}

/** Public domain (e.g. "blackforestd.net"). */
export function brandDomain(): string {
  return (process.env.BRAND_DOMAIN || "example.com").trim();
}

/**
 * The authenticated application subdomain origin (e.g.
 * "https://trade.blackforrestt.com"). The trade subdomain hosts login/register,
 * the trading terminal, account portal, admin console, and the authenticated
 * API surface. The apex domain (`blackforrestt.com`) serves marketing only.
 *
 * Override the subdomain prefix with the `TRADE_SUBDOMAIN` env var (default
 * "trade") if you ever use a different label (e.g. "app").
 *
 * Server-only: reads BRAND_DOMAIN at runtime. For client components, use
 * `clientTradeUrl()` instead (which reads NEXT_PUBLIC_ vars baked at build).
 */
export function tradeOrigin(): string {
  const sub = (process.env.TRADE_SUBDOMAIN || "trade").trim();
  return `https://${sub}.${brandDomain()}`;
}

/** Build an absolute URL on the trade subdomain for a relative path (server). */
export function absoluteTradeUrl(path = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${tradeOrigin()}${normalized}`;
}

/**
 * Client-safe trade origin for use in client components. Reads
 * NEXT_PUBLIC_TRADE_ORIGIN (an absolute origin baked at build time). When unset
 * (e.g. local development with a single domain), falls back to "" so relative
 * links are used — keeping the link on the same origin.
 */
export function clientTradeUrl(path = "/"): string {
  const origin = (process.env.NEXT_PUBLIC_TRADE_ORIGIN || "").trim();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return origin ? `${origin}${normalized}` : normalized;
}

/** Registered company address shown in the footer and legal pages. */
export function companyAddress(): string {
  return (process.env.COMPANY_ADDRESS || "").trim();
}

/** Brand trademark symbol (e.g. "blckforest™"). */
export function brandTrademark(): string {
  return (process.env.BRAND_TM || "blckforest™").trim();
}
