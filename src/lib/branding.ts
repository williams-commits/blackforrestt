/**
 * Centralised branding helpers. Read from environment variables (with sensible
 * defaults) so the platform name, contact details, and legal entity can be
 * configured in one place. Server components call these directly; client
 * components read NEXT_PUBLIC_BRAND_NAME (the only value the client needs).
 *
 * Host/domain/trade-host resolution lives in ONE place —
 * src/platform/registry.ts (the domain registry) — which this module and the
 * middleware both consume. This file now only layers the primary env defaults
 * (BRAND_NAME, COMPANY_*, …) on top of the registry's per-domain brand
 * defaults, with BRAND_OVERRIDES[apex] always winning.
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
import {
  brandDomainList,
  brandOverrides,
  domainForHost,
  defaultDomain,
  familyTradeHost as registryFamilyTradeHost,
  aliasDesignKey,
  resolveHostContext,
  type DomainBrandDefaults,
} from "@/platform/registry";

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
  return (process.env.SUPPORT_EMAIL || "support@blackforrestt.com").trim();
}

/**
 * Every apex domain the platform answers on (e.g.
 * ["blackforrestt.com", "gbfxs.com"]). Delegates to the domain registry:
 * BRAND_DOMAINS/BRAND_DOMAIN env first (mirrors + runtime families), then the
 * code-declared registry hosts. The FIRST entry is canonical — authenticated
 * routes on any apex redirect to the primary trade subdomain, so sessions and
 * cookies live on exactly one host.
 */
export function brandDomains(): string[] {
  return brandDomainList();
}

/**
 * Per-request branding profile. Every domain in BRAND_DOMAINS resolves to a
 * profile; domains without a BRAND_OVERRIDES entry inherit the primary brand
 * (identical UI — the initial "same files, different domain" phase).
 */
export interface BrandProfile {
  /** Apex domain of this brand family (e.g. "gbfxs.com"). */
  domain: string;
  /** Public brand name (e.g. "Global Forex Services"). */
  name: string;
  /** Short name for tight spaces / metadata authors. */
  shortName: string;
  /** Registered legal entity for footers and legal pages. */
  legalName: string;
  /** Support/contact email shown in the UI. */
  supportEmail: string;
  /** Registered company address shown in the footer. */
  address: string;
  /** Trademark wordmark (e.g. "Global Forex Services™"). */
  trademark: string;
  /** Two-tone logo wordmark parts — [plain, accent] (["Agile", "FGS"] example). */
  wordmark: [string, string];
  companyRegistrationNumber: string;
  companyJurisdiction: string;
  companyRegulator: string;
  companyLicenseNumber: string;
  investorCompensationScheme: string;
  /**
   * True when this family's own trade subdomain (trade.<domain>) serves the
   * authenticated app — requires DNS + a TLS cert (Caddy block). While false,
   * app routes on this apex redirect to the CANONICAL trade subdomain and the
   * family shows primary-brand app chrome.
   */
  tradeEnabled: boolean;
  /** Transactional email sender (overrides the global EMAIL_FROM). */
  emailFrom: string;
  /** Transactional email reply-to (overrides EMAIL_REPLY_TO). */
  emailReplyTo: string;
  /** Accent color for email buttons and the generated favicon. */
  emailColor: string;
  /** Logo image URL for email headers (overrides EMAIL_LOGO_URL). */
  emailLogoUrl: string;
  /** Open Graph share image path (e.g. "/brands/gbfxs/og.png"). */
  ogImage: string;
  /** Brand accent color for the generated favicon glyph. */
  accentColor: string;
  /**
   * Dedicated color for brand marks (favicon glyph). Empty = accentColor.
   * Lets a brand's identity mark differ from its UI accent — e.g. the gbfxs
   * bright green mark (#63e891) over its darker UI accent (#188050).
   */
  markColor: string;
  /** Custom logo glyph (SVG path data) replacing the default tree mark. */
  glyph: BrandGlyph | null;
  /** Landing hero badge text override (empty = translated default). */
  heroBadge: string;
  /** Landing hero subtitle override (empty = translated default). */
  heroSubtitle: string;
  /** Meta description override for SEO/social (empty = translated default). */
  metaDescription: string;
  /** App-logo rendering mode: "wordmark" (glyph + wordmark) or "brackets"
   *  (glyph path pair flanking a lowercase word — the gbfxs lockup). */
  logoLockup: string;
  /** Word rendered inside the "brackets" app-logo lockup ("gbfxs"). */
  logoWord: string;
  /**
   * Per-brand crypto deposit wallets, env format
   * ("asset:network:address;…" — same as DEPOSIT_WALLET_ADDRESSES). Empty =
   * inherit the global list. Layered global → BRAND → group → per-user, so
   * each brand family's customers pay to that brand's wallets.
   */
  depositWallets: string;
  /**
   * Landing design key ("default" | "gbfxs" | …). Selects which design in the
   * src/designs/ registry renders the apex `/` for this brand
   * family ("default" → src/designs/default/). Resolution:
   * BRAND_OVERRIDES.landingTemplate → registry domain's landingDesign →
   * "default". Unknown keys fall back to "default".
   */
  landingTemplate: string;
  /**
   * Public (interior) page design key — selects the shell + page architecture
   * from the same design registry (see src/platform/composition.tsx and the
   * (content) layout). Mirrors landingTemplate unless a domain explicitly
   * splits its landing and public designs.
   */
  publicDesign: string;
}

/** SVG glyph rendered by the Logo component and the generated favicon. */
export interface BrandGlyph {
  viewBox: string;
  paths: Array<{
    d: string;
    fill?: "accent" | "ink";
    /** Crop viewBox for lockup rendering (bracket pair); the favicon uses
     *  the full glyph viewBox and ignores crops. */
    box?: string;
  }>;
  /** Optional favicon background (hex) — paints a rounded square behind the
   *  glyph so marks with fine geometry stay legible at 16px. */
  background?: string;
  /** Optional letter centered between the glyph paths in the favicon
   *  (e.g. the "e" of a bracket lockup) — system-font bold, ink fill. */
  letter?: { text: string; size: number };
}

/**
 * Per-domain brand overrides, keyed by apex domain, from the BRAND_OVERRIDES
 * JSON env var (parsed defensively by the registry). Entries are merged over
 * the registry's code-declared brand defaults — env is the operational
 * override layer, code is the shipped default.
 */
function brandOverridesMap(): Record<string, DomainBrandDefaults> {
  return brandOverrides();
}

/** Resolve the brand profile for one apex domain. Layering (highest wins):
 *  1. BRAND_OVERRIDES[apex] — per-deployment values
 *  2. the registry domain's brand defaults (src/platform/registry.ts)
 *  3. the primary env defaults (BRAND_NAME, COMPANY_*, …) / built-ins
 *  Null/undefined resolves to the primary brand — every user created before
 *  multi-branding, and unknown hosts. */
export function brandProfileForDomain(domain?: string | null): BrandProfile {
  const key = domain?.trim().toLowerCase() || brandDomains()[0];
  const override = brandOverridesMap()[key] ?? {};
  // Registry domain claiming this apex; unknown apices (env-declared mirrors,
  // localhost aliases) inherit the default domain's (empty) code defaults.
  const claimed = domainForHost(key);
  const registryDefaults = (claimed ?? defaultDomain()).brand;
  const registryTradeEnabled = (claimed ?? defaultDomain()).tradeEnabled;
  // Does BRAND_OVERRIDES carry an entry for this apex at all? (Entry-level
  // authority for tradeEnabled — see registry.familyTradeEnabled.)
  const overrideEntryExists = brandOverridesMap()[key] !== undefined;

  const layered = <T>(envOverride: T | undefined, codeDefault: T | undefined, primary: () => T): T =>
    envOverride !== undefined ? envOverride : codeDefault !== undefined ? codeDefault : primary();

  return {
    domain: key,
    name: layered(override.name, registryDefaults.name, brandName),
    shortName: layered(override.shortName, registryDefaults.shortName, brandShortName),
    legalName: layered(override.legalName, registryDefaults.legalName, companyLegalName),
    supportEmail: layered(override.supportEmail, registryDefaults.supportEmail, supportEmail),
    address: layered(override.address, registryDefaults.address, companyAddress),
    trademark: layered(override.trademark, registryDefaults.trademark, brandTrademark),
    wordmark: layered(override.wordmark, registryDefaults.wordmark, () => ["Black", "Forest"]),
    companyRegistrationNumber: layered(
      override.companyRegistrationNumber,
      registryDefaults.companyRegistrationNumber,
      companyRegistrationNumber,
    ),
    companyJurisdiction: layered(
      override.companyJurisdiction,
      registryDefaults.companyJurisdiction,
      companyJurisdiction,
    ),
    companyRegulator: layered(override.companyRegulator, registryDefaults.companyRegulator, companyRegulator),
    companyLicenseNumber: layered(override.companyLicenseNumber, registryDefaults.companyLicenseNumber, companyLicenseNumber),
    investorCompensationScheme: layered(
      override.investorCompensationScheme,
      registryDefaults.investorCompensationScheme,
      investorCompensationScheme,
    ),
    // Same precedence as registry.familyTradeEnabled: an existing override
    // ENTRY is authoritative (absent flag = not enabled); no entry → the
    // registry domain's code default.
    tradeEnabled: overrideEntryExists
      ? override.tradeEnabled === true
      : registryTradeEnabled,
    emailFrom: override.emailFrom ?? registryDefaults.emailFrom ?? "",
    emailReplyTo: override.emailReplyTo ?? registryDefaults.emailReplyTo ?? "",
    emailColor: override.emailColor ?? registryDefaults.emailColor ?? "",
    emailLogoUrl: override.emailLogoUrl ?? registryDefaults.emailLogoUrl ?? "",
    ogImage: override.ogImage ?? registryDefaults.ogImage ?? "",
    accentColor: override.accentColor ?? registryDefaults.accentColor ?? "",
    markColor: override.markColor ?? registryDefaults.markColor ?? "",
    glyph: override.glyph !== undefined ? override.glyph : (registryDefaults.glyph ?? null),
    heroBadge: override.heroBadge ?? registryDefaults.heroBadge ?? "",
    heroSubtitle: override.heroSubtitle ?? registryDefaults.heroSubtitle ?? "",
    metaDescription: override.metaDescription ?? registryDefaults.metaDescription ?? "",
    logoLockup: override.logoLockup ?? registryDefaults.logoLockup ?? "wordmark",
    logoWord: override.logoWord ?? registryDefaults.logoWord ?? "",
    depositWallets: override.depositWallets ?? registryDefaults.depositWallets ?? "",
    landingTemplate: aliasDesignKey(override.landingTemplate ?? defaultDomainFor(key).landingDesign),
    publicDesign: aliasDesignKey(override.publicDesign ?? override.landingTemplate ?? defaultDomainFor(key).publicDesign),
  };
}

/** Registry domain for an apex (never null — unknown apices get the default). */
function defaultDomainFor(apex: string) {
  return domainForHost(apex) ?? defaultDomain();
}

/**
 * The trade host serving a brand family's authenticated app
 * (e.g. "trade.gbfxs.com"). Delegates to the domain registry — the ONE
 * implementation shared with the middleware and next.config.ts.
 */
export function tradeHostForDomain(domain?: string | null): string {
  return registryFamilyTradeHost(domain) ?? tradeOrigin().replace(/^https:\/\//, "");
}

/** Valid 3–8 digit hex color (with #), or null. Guards the CSS injection. */
export function safeBrandColor(value: string | undefined | null): string | null {
  const trimmed = (value ?? "").trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(trimmed) ? trimmed.toLowerCase() : null;
}

/** The apex origin serving email action links for a brand family. Linking the
 *  apex is safe for every family: the middleware routes trade-host paths
 *  (reset, verification) to the correct trade subdomain per family. */
export function brandApexOrigin(domain?: string | null): string {
  const family = domain?.trim().toLowerCase() || brandDomains()[0];
  if (!process.env.APP_ORIGIN?.trim()) return applicationOriginFallback();
  return `https://${family}`;
}

/** applicationOrigin()'s dev fallback duplicated here to avoid importing the
 *  security/tokens chain (which pulls Prisma) into client-adjacent modules. */
function applicationOriginFallback(): string {
  const value = process.env.APP_ORIGIN?.split(",")[0]?.trim();
  if (value) return new URL(value).origin;
  return "http://localhost:3000";
}

/** Registration summary for a resolved profile (footer assurance badge). */
export function brandRegistrationSummary(brand: BrandProfile): string {
  const parts: string[] = [];
  if (brand.companyRegulator) parts.push(`${brand.legalName} is licensed by ${brand.companyRegulator}`);
  if (brand.companyLicenseNumber) parts.push(`License no. ${brand.companyLicenseNumber}`);
  if (brand.companyRegistrationNumber) parts.push(`Reg. no. ${brand.companyRegistrationNumber}`);
  if (brand.companyJurisdiction) parts.push(brand.companyJurisdiction);
  return parts.join(" · ");
}

/**
 * The brand profile for the CURRENT request, derived from the Host header
 * (honoring the reverse proxy's X-Forwarded-Host). Falls back to the primary
 * brand on localhost or an unconfigured host. Server components / route
 * handlers only — client components read the profile from <Providers>.
 */
export async function currentBrandProfile(): Promise<BrandProfile> {
  const { headers } = await import("next/headers");
  const headerList = await headers();
  const host = (headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "")
    .split(",")[0]!
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
  // Host → apex resolution is owned by the domain registry (env list first,
  // then code-declared hosts; unknown hosts fall back to the canonical apex).
  const apex = resolveHostContext(host).apex;
  return brandProfileForDomain(apex);
}

/** Public domain (e.g. "blackforrestt.com"). Always the canonical FIRST entry
 *  of the configured domain list — links, emails, sitemap, and SEO canonicals
 *  are built on it. */
export function brandDomain(): string {
  return brandDomains()[0];
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

/** Build an absolute URL on the CANONICAL trade subdomain (server-only, e.g.
 *  emails and API responses). NEVER use this for UI hrefs — render relative
 *  links instead so the middleware routes each brand family to its own trade
 *  host; an absolute URL here leaks mirror-domain visitors to the primary.
 */
export function absoluteTradeUrl(path = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${tradeOrigin()}${normalized}`;
}

/**
 * Client-safe trade URL for marketing CTAs. Always RELATIVE: on an apex
 * domain the middleware routes /login, /register, /trade/... to the correct
 * trade subdomain per brand family (trade.<family> when tradeEnabled, else
 * the canonical trade host). A build-baked absolute origin cannot know the
 * requesting family and would send mirror-domain visitors to the primary
 * trade host. NEXT_PUBLIC_TRADE_ORIGIN is no longer read.
 */
export function clientTradeUrl(path = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return normalized;
}

/** Registered company address shown in the footer and legal pages. */
export function companyAddress(): string {
  return (process.env.COMPANY_ADDRESS || "").trim();
}

/**
 * Company registration & regulatory identity. All optional — empty string when
 * unconfigured, in which case the UI shows the generic assurance badges and
 * the JSON-LD Organization schema omits the identifiers. Configure in
 * .env.production before claiming any regulatory status publicly.
 */

/** Incorporation/registration number with the company registry. */
export function companyRegistrationNumber(): string {
  return (process.env.COMPANY_REGISTRATION_NUMBER || "").trim();
}

/** Jurisdiction of incorporation (e.g. "Republic of Seychelles"). */
export function companyJurisdiction(): string {
  return (process.env.COMPANY_JURISDICTION || "").trim();
}

/** Licensing/regulatory authority name (e.g. "Financial Services Authority"). */
export function companyRegulator(): string {
  return (process.env.COMPANY_REGULATOR || "").trim();
}

/** License number issued by the regulator. */
export function companyLicenseNumber(): string {
  return (process.env.COMPANY_LICENSE_NUMBER || "").trim();
}

/** Investor compensation scheme the firm belongs to (e.g. "ICF"). */
export function investorCompensationScheme(): string {
  return (process.env.INVESTOR_COMPENSATION_SCHEME || "").trim();
}

/** One-line registration summary for the footer, about page, and JSON-LD.
 *  Empty when nothing is configured. */
export function companyRegistrationSummary(): string {
  const parts: string[] = [];
  if (companyRegulator()) parts.push(`${companyLegalName()} is licensed by ${companyRegulator()}`);
  if (companyLicenseNumber()) parts.push(`License no. ${companyLicenseNumber()}`);
  if (companyRegistrationNumber()) parts.push(`Reg. no. ${companyRegistrationNumber()}`);
  if (companyJurisdiction()) parts.push(companyJurisdiction());
  return parts.join(" · ");
}

/** True when any registration identifier is configured. */
export function hasCompanyRegistration(): boolean {
  return Boolean(
    companyRegistrationNumber() || companyLicenseNumber() || companyRegulator() || companyJurisdiction(),
  );
}

/** Brand trademark symbol (e.g. "Black Forest™"). */
export function brandTrademark(): string {
  return (process.env.BRAND_TM || "Black Forest™").trim();
}
