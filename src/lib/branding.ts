/**
 * Centralised branding helpers. Read from environment variables (with sensible
 * defaults) so the platform name, contact details, and legal entity can be
 * configured in one place. Server components call these directly; client
 * components read NEXT_PUBLIC_BRAND_NAME (the only value the client needs).
 *
 * The email subsystem (src/server/email/templates.ts) keeps its own EMAIL_*
 * vars but defaults EMAIL_BRAND_NAME to brandName() so the two stay consistent.
 */

/** Public brand name shown in the UI (e.g. "Black Forest Digital"). Client-safe via NEXT_PUBLIC_. */
export function brandName(): string {
  return (process.env.NEXT_PUBLIC_BRAND_NAME ?? process.env.BRAND_NAME ?? "Black Forest Digital").trim();
}

/** Short brand name for tight spaces / wordmark (e.g. "Black Forest"). */
export function brandShortName(): string {
  return (process.env.BRAND_NAME ?? "Black Forest").trim();
}

/** Registered legal entity name used in legal pages and the footer (e.g. "Black Forest Digital LTD"). */
export function companyLegalName(): string {
  return (process.env.COMPANY_LEGAL_NAME ?? `${brandName()} LTD`).trim();
}

/** Support/contact email shown in the UI and legal pages. */
export function supportEmail(): string {
  return (process.env.SUPPORT_EMAIL ?? "support@example.com").trim();
}

/** Public domain (e.g. "blackforestd.net"). */
export function brandDomain(): string {
  return (process.env.BRAND_DOMAIN ?? "example.com").trim();
}

/** Registered company address shown in the footer and legal pages. */
export function companyAddress(): string {
  return (process.env.COMPANY_ADDRESS ?? "").trim();
}

/** Brand trademark symbol (e.g. "blckforest™"). */
export function brandTrademark(): string {
  return (process.env.BRAND_TM ?? "blckforest™").trim();
}
