/**
 * PURE domain-registry types — zero runtime, zero imports. Safe for
 * next.config, the middleware chain, and the generated registries.
 */

/** Brand identity defaults declared in code. Structurally compatible with the
 *  BRAND_OVERRIDES entry shape in src/lib/branding.ts — env values win. */
export interface DomainBrandDefaults {
  name?: string;
  shortName?: string;
  legalName?: string;
  supportEmail?: string;
  address?: string;
  trademark?: string;
  wordmark?: [string, string];
  companyRegistrationNumber?: string;
  companyJurisdiction?: string;
  companyRegulator?: string;
  companyLicenseNumber?: string;
  investorCompensationScheme?: string;
  tradeEnabled?: boolean;
  emailFrom?: string;
  emailReplyTo?: string;
  emailColor?: string;
  emailLogoUrl?: string;
  ogImage?: string;
  accentColor?: string;
  markColor?: string;
  glyph?: BrandGlyphConfig | null;
  heroBadge?: string;
  heroSubtitle?: string;
  metaDescription?: string;
  logoLockup?: string;
  logoWord?: string;
  depositWallets?: string;
  landingTemplate?: string;
  /** Public-page design override; defaults to landingTemplate when unset. */
  publicDesign?: string;
  /** Explicit trade host for this family (per-deployment override). */
  tradeHost?: string;
}

/** SVG glyph config (same shape as BrandGlyph in src/lib/branding.ts). */
export interface BrandGlyphConfig {
  viewBox: string;
  paths: Array<{ d: string; fill?: "accent" | "ink"; box?: string }>;
  background?: string;
  letter?: { text: string; size: number };
}

/** One brand family on the platform. ONE DOMAIN = ONE EXPLICIT CONFIGURATION. */
export interface DomainDefinition {
  /** Stable key ("blackforrest", "gbfxs"). Used in logs, tests, and content
   *  packages — never for routing (hosts do that). */
  key: string;
  /** Apex hosts this family answers on. FIRST-CLASS hosts — first entry is
   *  the canonical apex. Entries ending in ".localhost" are dev mirrors
   *  (local development only; excluded from production routing/deploys). */
  hosts: string[];
  /** Optional mirror/alias apexes that serve the SAME family (e.g. a ccTLD
   *  variant). Distinct from `hosts`: aliases are additional names, never
   *  the canonical identity, and are excluded from key/brand/SEO checks. */
  aliases?: string[];
  /** Landing design key → design registry ("default" | "gbfxs" | …). */
  landingDesign: string;
  /** Public (interior) page design key → design registry. */
  publicDesign: string;
  /** True when this family runs its own trade subdomain (DNS + TLS exist). */
  tradeEnabled: boolean;
  /** Explicit package refs (validated by `platform domain validate`) — the
   *  manifest self-describes where its content lives, inside
   *  src/domains/<key>/. Paths are relative to the package root, no
   *  extension. Selectors only; the referenced files are implementations. */
  content?: {
    landing: string;
    public: string;
  };
  navigation?: string;
  seo?: string;
  assets?: string;
  /** Brand identity defaults; BRAND_OVERRIDES[host] entries override these. */
  brand: DomainBrandDefaults;
  /** Platform features this family exposes on its marketing surface. */
  features: DomainFeatures;
}

export interface DomainFeatures {
  /** Live trading app on this family's trade host. */
  trading: boolean;
  /** Ticker widget embeds (/widgets/ticker). */
  informers: boolean;
}

/** Everything host resolution decides for one request host. */
export interface HostContext {
  /** Normalized routing host (no port, no www). */
  host: string;
  /** The brand-family apex this host belongs to (env list first, then
   *  registry hosts), or the canonical apex for unknown hosts. */
  apex: string;
  /** Registry domain serving this host; mirrors/unknown hosts → default. */
  domain: DomainDefinition;
  /** Effective landing design key (env override → registry default). */
  landingDesign: string;
  /** Effective public-page design key (env override → registry default). */
  publicDesign: string;
}

export type EnvLike = Record<string, string | undefined>;
