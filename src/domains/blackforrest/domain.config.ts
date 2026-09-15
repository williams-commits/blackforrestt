/**
 * BLACKFOREST domain configuration — the platform's primary brand family
 * (Black Forest Digital / blackforrestt.com).
 *
 * One domain = one explicit configuration. This file declares everything the
 * code layer knows about the family: its apex hosts, design selections, and
 * brand identity defaults. The operational env layer (BRAND_DOMAINS,
 * BRAND_OVERRIDES, DOMAIN_N/TRADE_DOMAIN_N) still overrides every value at
 * runtime — see src/domains/registry.ts for the precedence rules.
 *
 * MUST stay a pure data module (type-only imports): it is composed into
 * registry.ts, which next.config.ts and the middleware also load.
 */
import type { DomainDefinition } from "../registry";

/** Primary brand identity defaults mirror the env fallbacks in
 *  src/lib/branding.ts (which already defaults every field), so this entry
 *  intentionally carries only what code should assert: designs + trade host. */
export const BLACKFOREST_DOMAIN: DomainDefinition = {
  key: "blackforrest",
  hosts: ["blackforrestt.com"],
  landingDesign: "default",
  publicDesign: "default",
  tradeEnabled: true,
  brand: {},
  features: { trading: true, informers: true },
};
