/**
 * THE authoritative domain registry + host-resolution layer.
 *
 * One module answers every "which domain/brand/design is this host?" question
 * for the whole platform. Consumers: src/middleware.ts (routing + cookies),
 * src/lib/branding.ts (brand profiles), next.config.ts (CSP origins), and
 * src/platform/resolve.ts (server request entry).
 *
 * CONFIGURATION MODEL (two layers, env wins):
 * 1. CODE layer — domain manifests under src/domains/<key>/domain.config.ts,
 *    assembled by the GENERATED registry (src/domains/.generated/domains.ts).
 *    Adding a domain = platform CLI scaffolds the package + the registry is
 *    regenerated — no hand-maintained arrays anywhere.
 * 2. ENV layer — the operational surface (BRAND_DOMAINS, BRAND_OVERRIDES,
 *    TRADE_SUBDOMAIN). Production can add mirror hosts, override any code
 *    default, or stand up a family WITHOUT a rebuild. See
 *    docs/domains/ADDING_A_DOMAIN.md.
 */
export type {
  DomainDefinition,
  DomainBrandDefaults,
  BrandGlyphConfig,
  DomainFeatures,
  HostContext,
  EnvLike,
} from "./registry-types";
import type { DomainBrandDefaults, DomainDefinition, EnvLike, HostContext } from "./registry-types";

// Domain manifests come from the GENERATED registry (scan of
// src/domains/<key>/domain.config.ts) — never hand-maintained here.
export { DOMAINS } from "./generated-domains";
import { DOMAINS } from "./generated-domains";

export const DEFAULT_DOMAIN_KEY = "blackforrest";

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
  return found ?? defaultDomain();
}

/** The default (first) registry domain — canonical apex + fallback owner. */
export function defaultDomain(): DomainDefinition {
  return DOMAINS[0]!;
}

/** Legacy design-key alias: pre-rename env files may still say
 *  landingTemplate/publicDesign "agile". Without this, an old override would
 *  silently fall back to the DEFAULT design instead of the gbfxs design. */
export function aliasDesignKey(key: string): string {
  return key === "agile" ? "gbfxs" : key;
}

/**
 * resolveHostContext(host) → domain identity → brand, content and design selections.
 *
 * THE one entry point every public request flows through. Precedence:
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

  const apex = envMatch ?? claimed?.hosts.find((host) => hostWithinApex(normalized, host.toLowerCase())) ?? domains[0]!;
  const domain = claimed ?? defaultDomain();
  const override = brandOverrides(env)[apex] ?? {};

  return {
    host: normalized,
    apex,
    domain,
    landingDesign: aliasDesignKey(override.landingTemplate ?? domain.landingDesign),
    publicDesign: aliasDesignKey(override.publicDesign ?? override.landingTemplate ?? domain.publicDesign),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Trade-host resolution (manifest-driven; DOMAIN_N pairs are gone)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The trade host serving a brand family's authenticated app
 * (e.g. "trade.gbfxs.com"), or null when the family has none. Resolution:
 *   1. BRAND_OVERRIDES[apex].tradeHost — per-deployment override.
 *   2. tradeEnabled (env flag wins, else manifest default) → TRADE_SUBDOMAIN.<apex>.
 *   3. Neither → the canonical trade host of the first domain.
 */
export function familyTradeHost(apex: string | null | undefined, env: EnvLike = process.env): string | null {
  const family = apex?.trim().toLowerCase() || brandDomainList(env)[0];
  const override = brandOverrides(env)[family];
  if (override?.tradeHost?.trim()) return override.tradeHost.trim().toLowerCase();
  const sub = (env.TRADE_SUBDOMAIN || "trade").trim().toLowerCase();
  if (familyTradeEnabled(family, env)) return `${sub}.${family}`;
  return `${sub}.${brandDomainList(env)[0]}`;
}

/** tradeEnabled for a family: an EXPLICIT override flag wins; otherwise the
 *  MANIFEST default (the code-level authority). An override entry written
 *  for other fields (wallets, identity) does NOT suppress the manifest's
 *  trade-host declaration. */
export function familyTradeEnabled(apex: string, env: EnvLike = process.env): boolean {
  const entry = brandOverrides(env)[apex.trim().toLowerCase()];
  if (entry?.tradeEnabled !== undefined) return entry.tradeEnabled === true;
  const claimed = domainForHost(apex);
  return claimed?.tradeEnabled ?? false;
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
