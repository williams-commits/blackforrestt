/**
 * THE authoritative domain registry + host-resolution layer.
 *
 * One module answers every "which domain/brand/design is this host?" question
 * for the whole platform. It previously lived as three divergent copies
 * (src/lib/branding.ts, src/middleware.ts, next.config.ts — each carrying a
 * "keep in sync" comment); they now all consume THIS module.
 *
 * ⚠️ HARD CONSTRAINTS ON THIS FILE
 * - ZERO imports (not even type imports). It is loaded by next.config.ts at
 *   build/boot, bundled into the middleware chain, and imported from client-
 *   adjacent modules. Any dependency — especially anything touching node:* —
 *   re-breaks the middleware bundle (see the history noted in
 *   src/middleware.ts).
 * - PURE functions only: `(host, env) => answer`. No next/*, no fetch, no
 *   headers(). Server-side request resolution lives in resolve.ts.
 *
 * CONFIGURATION MODEL (two layers, env wins):
 * 1. CODE layer — the DOMAINS registry below. One entry per brand family:
 *    identity defaults, apex hosts, design selections, features. This is what
 *    makes the repository self-describing: a developer can read every domain
 *    the platform ships without opening an .env file.
 * 2. ENV layer — the operational surface (BRAND_DOMAINS, BRAND_OVERRIDES,
 *    DOMAIN_N/TRADE_DOMAIN_N, TRADE_SUBDOMAIN). Production can add mirror
 *    hosts, override any code default, or stand up a new family WITHOUT a
 *   rebuild (custom server reads env at boot). See docs/MULTI_DOMAIN_SETUP.md.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Contracts
// ─────────────────────────────────────────────────────────────────────────────

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
  /** Stable key ("blackforrest", "agile"). Used in logs, tests, and content
   *  packages — never for routing (hosts do that). */
  key: string;
  /** Apex hosts this family answers on. The FIRST domain in DOMAINS whose
   *  hosts match serves any host not claimed by another entry. */
  hosts: string[];
  /** Landing design key → src/landing/designs.ts registry ("default" | "agile"). */
  landingDesign: string;
  /** Public (interior) page design key → src/landing/designs.ts registry. */
  publicDesign: string;
  /** True when this family runs its own trade subdomain (DNS + TLS exist). */
  tradeEnabled: boolean;
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

// ─────────────────────────────────────────────────────────────────────────────
// The registry
// ─────────────────────────────────────────────────────────────────────────────

// Per-domain configurations. These imports are VALUE imports of pure data
// modules (domain.config.ts files import only types from this file — erased at
// runtime, so there is no runtime cycle and the zero-dependency guarantee of
// this module's public surface is preserved).
import { BLACKFOREST_DOMAIN } from "./blackforrest/domain.config";
import { AGILE_DOMAIN } from "./agile/domain.config";

/** Every domain the platform ships, one explicit configuration per family
 *  (see src/domains/<domain>/domain.config.ts). Order matters: the FIRST
 *  entry is the DEFAULT domain (canonical apex, fallback for unknown/mirror
 *  hosts, owner of the canonical trade subdomain).
 *
 *  To add a domain: copy src/domains/_template/, then register its config
 *  here — see .platform/workflows/new-domain.md. */
export const DOMAINS: readonly DomainDefinition[] = [BLACKFOREST_DOMAIN, AGILE_DOMAIN];

export const DEFAULT_DOMAIN_KEY = "blackforrest";

// ─────────────────────────────────────────────────────────────────────────────
// Env access (injected for tests)
// ─────────────────────────────────────────────────────────────────────────────

export type EnvLike = Record<string, string | undefined>;

/** Every apex domain the platform answers on: env-declared list first (the
 *  operational truth — mirrors and runtime-added families), falling back to
 *  the registry's code-declared hosts. First entry is canonical. */
export function brandDomainList(env: EnvLike = process.env): string[] {
  const raw = (env.BRAND_DOMAINS || env.BRAND_DOMAIN || "").trim().toLowerCase();
  const list = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.includes(".") && !entry.includes("://"));
  if (list.length > 0) return [...new Set(list)];
  const registryHosts = DOMAINS.flatMap((domain) => domain.hosts.map((host) => host.toLowerCase()));
  return registryHosts.length > 0 ? registryHosts : ["blackforrestt.com"];
}

/** BRAND_OVERRIDES JSON, parsed defensively (invalid JSON = {} — never takes
 *  the site down). Same contract as src/lib/branding.ts. */
export function brandOverrides(env: EnvLike = process.env): Record<string, DomainBrandDefaults> {
  const raw = (env.BRAND_OVERRIDES || "").trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, DomainBrandDefaults>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Host normalization + matching
// ─────────────────────────────────────────────────────────────────────────────

/** Host header → routing host: lowercase, port stripped, "www." stripped. */
export function normalizeHost(host: string | null | undefined): string {
  const bare = (host ?? "").trim().toLowerCase().replace(/:\d+$/, "");
  return bare.startsWith("www.") ? bare.slice(4) : bare;
}

/** True when host IS the apex or a subdomain of it (trade.gbfxs.com ⊑ gbfxs.com). */
export function hostWithinApex(host: string, apex: string): boolean {
  return host === apex || host.endsWith(`.${apex}`);
}

/** The registry domain that owns a host (apex or any subdomain), or null for
 *  hosts no entry claims (localhost, IP literals, env-declared mirrors). */
export function domainForHost(host: string | null | undefined): DomainDefinition | null {
  const normalized = normalizeHost(host);
  if (!normalized) return null;
  for (const domain of DOMAINS) {
    for (const apex of domain.hosts) {
      if (hostWithinApex(normalized, apex.toLowerCase())) return domain;
    }
  }
  return null;
}

/** Registry lookup by key; unknown keys resolve to the default domain so a
 *  bad value can never blank the site. */
export function domainByKey(key: string | null | undefined): DomainDefinition {
  const found = DOMAINS.find((domain) => domain.key === key);
  return found ?? domainByKey(DEFAULT_DOMAIN_KEY);
}

/** The default (first) registry domain — canonical apex + fallback owner. */
export function defaultDomain(): DomainDefinition {
  return DOMAINS[0]!;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-host resolution: host → domain identity + design selections
// ─────────────────────────────────────────────────────────────────────────────

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
  /** Effective public-page design key (env override → registry default).
   *  Falls back to the env landingTemplate override for back-compat with
   *  deployments that select both designs with one key. */
  publicDesign: string;
}

/**
 * resolveHost(host) → domain identity → brand, content and design selections.
 *
 * THE one entry point every public request flows through (middleware, root
 * layout, landing/public dispatchers). Precedence:
 *   1. env BRAND_DOMAINS membership (mirrors + runtime families)
 *   2. code-declared registry hosts
 *   3. unknown host → default domain (previous behavior preserved)
 * Design keys: BRAND_OVERRIDES[apex].landingTemplate / .publicDesign override
 * the registry's code defaults.
 */
export function resolveHostContext(host: string | null | undefined, env: EnvLike = process.env): HostContext {
  const normalized = normalizeHost(host);
  const domains = brandDomainList(env);
  const envMatch = domains.find((apex) => hostWithinApex(normalized, apex));
  const claimed = domainForHost(normalized);

  // The apex this family is served under: env-declared list wins, else the
  // registry entry's own host, else the canonical apex.
  const apex = envMatch ?? claimed?.hosts.find((h) => hostWithinApex(normalized, h.toLowerCase())) ?? domains[0]!;
  const domain = claimed ?? defaultDomain();
  const override = brandOverrides(env)[apex] ?? {};

  return {
    host: normalized,
    apex,
    domain,
    landingDesign: override.landingTemplate ?? domain.landingDesign,
    publicDesign: override.publicDesign ?? override.landingTemplate ?? domain.publicDesign,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Trade-host resolution (one implementation; was triplicated)
// ─────────────────────────────────────────────────────────────────────────────

/** The DOMAIN_N / TRADE_DOMAIN_N deployment pairs (exactly what Caddy serves),
 *  as [apex, tradeHost] tuples. */
export function tradeHostPairs(env: EnvLike = process.env): Array<[string, string]> {
  const pairs: Array<[string | undefined, string | undefined]> = [
    [env.DOMAIN, env.TRADE_DOMAIN],
    [env.DOMAIN_2, env.TRADE_DOMAIN_2],
    [env.DOMAIN_3, env.TRADE_DOMAIN_3],
  ];
  return pairs
    .map(([apex, trade]) => [
      (apex ?? "").trim().toLowerCase(),
      (trade ?? "").trim().toLowerCase(),
    ] as [string, string])
    .filter(([apex, trade]) => apex !== "" && trade !== "");
}

/** tradeEnabled for a family: when BRAND_OVERRIDES carries an ENTRY for the
 *  apex, that entry is authoritative (an absent flag inside an existing
 *  entry means NOT enabled — the operator spoke without asserting the trade
 *  host's DNS/TLS, so routing must stay conservative and use the canonical
 *  host). With NO entry, the registry's code default applies. Invalid JSON
 *  safely means "registry default". */
export function familyTradeEnabled(apex: string, env: EnvLike = process.env): boolean {
  const entry = brandOverrides(env)[apex.trim().toLowerCase()];
  if (entry !== undefined) return entry.tradeEnabled === true;
  const claimed = domainForHost(apex);
  return claimed?.tradeEnabled ?? false;
}

/**
 * The trade host serving a brand family's authenticated app
 * (e.g. "trade.gbfxs.com"), or null when the family has none. Resolution
 * order — the DEPLOYMENT'S OWN declaration wins:
 *   1. DOMAIN_N / TRADE_DOMAIN_N env pairs (what Caddy actually serves).
 *   2. tradeEnabled (env flag, else registry default) → TRADE_SUBDOMAIN.<apex>.
 *   3. Neither → the family's app traffic uses the canonical trade host.
 */
export function familyTradeHost(apex: string | null | undefined, env: EnvLike = process.env): string | null {
  const family = apex?.trim().toLowerCase() || brandDomainList(env)[0];
  for (const [pairApex, trade] of tradeHostPairs(env)) {
    if (pairApex === family) return trade;
  }
  const sub = (env.TRADE_SUBDOMAIN || "trade").trim().toLowerCase();
  if (familyTradeEnabled(family, env)) return `${sub}.${family}`;
  return `${sub}.${brandDomainList(env)[0]}`;
}

/** True when host is a local/dev origin that bypasses domain routing. */
export function isLocalHost(host: string | null | undefined): boolean {
  const normalized = (host ?? "").trim().toLowerCase().replace(/:\d+$/, "");
  return (
    normalized === "localhost" ||
    normalized.startsWith("127.0.0.1") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(normalized)
  );
}
