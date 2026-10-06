import { prisma } from "@/server/db";

export interface TradingRiskPolicy {
  maxOrderLots: number;
  maxQuoteAgeMs: number;
}

const SAFE_DEFAULTS: TradingRiskPolicy = {
  maxOrderLots: 100,
  maxQuoteAgeMs: 15_000,
};

function objectValue(value: unknown, key: string): unknown {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

function positiveNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Load the operational trading policy. Missing/malformed rows never expand the
 * secure baseline: defaults remain in force until an approved maker-checker
 * change produces a valid value.
 */
export async function loadTradingRiskPolicy(): Promise<TradingRiskPolicy> {
  const rules = await prisma.riskRule.findMany({
    where: { enabled: true, code: { in: ["MAX_ORDER_VOLUME", "STALE_QUOTE_BLOCK"] } },
    select: { code: true, configuration: true },
  });
  const policy = { ...SAFE_DEFAULTS };
  for (const rule of rules) {
    if (rule.code === "MAX_ORDER_VOLUME") {
      policy.maxOrderLots = Math.min(
        SAFE_DEFAULTS.maxOrderLots,
        positiveNumber(objectValue(rule.configuration, "maxLots"), SAFE_DEFAULTS.maxOrderLots),
      );
    }
    if (rule.code === "STALE_QUOTE_BLOCK") {
      policy.maxQuoteAgeMs = Math.min(
        SAFE_DEFAULTS.maxQuoteAgeMs,
        positiveNumber(objectValue(rule.configuration, "maxAgeMs"), SAFE_DEFAULTS.maxQuoteAgeMs),
      );
    }
  }
  return policy;
}
