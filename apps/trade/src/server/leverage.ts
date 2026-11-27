import { Prisma, type InstrumentCategory } from "@prisma/client";
import { prisma } from "@/server/db";

export const LEVERAGE_CATEGORIES = [
  "FOREX",
  "CRYPTO",
  "COMMODITY",
  "INDEX",
  "STOCK",
] as const satisfies readonly InstrumentCategory[];

const MIN_LEVERAGE = new Prisma.Decimal(1);
const MAX_LEVERAGE = new Prisma.Decimal(500);
const POLICY_CODE = "LEVERAGE_POLICY";
type LeverageClient = Pick<Prisma.TransactionClient, "instrument" | "riskRule">;

export interface LeverageClassLimits {
  default: Prisma.Decimal;
  maximum: Prisma.Decimal;
}

export interface LeverageInstrumentInput {
  symbol: string;
  category: InstrumentCategory;
  contractSize: Prisma.Decimal;
  leverageEnabled: boolean;
  leverageDefault: Prisma.Decimal | null;
  leverageMax: Prisma.Decimal | null;
}

export interface EffectiveLeverage {
  enabled: boolean;
  default: Prisma.Decimal | null;
  maximum: Prisma.Decimal | null;
  contractSize: Prisma.Decimal | null;
}

export class LeverageSettingsError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "LeverageSettingsError";
  }
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function ratioValue(value: unknown): Prisma.Decimal | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  try {
    const ratio = new Prisma.Decimal(value);
    return ratio.isFinite() && ratio.gte(MIN_LEVERAGE) && ratio.lte(MAX_LEVERAGE) ? ratio : null;
  } catch {
    return null;
  }
}

function parseLimits(value: unknown): Partial<Record<InstrumentCategory, LeverageClassLimits>> {
  const root = objectValue(value);
  const defaults = objectValue(root?.defaults);
  const maximums = objectValue(root?.maximums);
  if (!defaults || !maximums) return {};

  const result: Partial<Record<InstrumentCategory, LeverageClassLimits>> = {};
  for (const category of LEVERAGE_CATEGORIES) {
    const defaultRatio = ratioValue(defaults[category]);
    const maxRatio = ratioValue(maximums[category]);
    if (defaultRatio && maxRatio && defaultRatio.lte(maxRatio)) {
      result[category] = { default: defaultRatio, maximum: maxRatio };
    }
  }
  return result;
}

export function validateLeveragePolicyConfiguration(value: unknown): string | null {
  const limits = parseLimits(value);
  for (const category of LEVERAGE_CATEGORIES) {
    if (!limits[category]) {
      return `Leverage policy requires a valid default and maximum for ${category}.`;
    }
  }
  return null;
}

export function hasValidContractSize(contractSize: Prisma.Decimal): boolean {
  return contractSize.isFinite() && contractSize.gt(0);
}

export function leverageMaximumForCategory(
  value: unknown,
  category: InstrumentCategory,
): Prisma.Decimal | null {
  return parseLimits(value)[category]?.maximum ?? null;
}

async function loadClassLimits(
  client: LeverageClient = prisma,
): Promise<Partial<Record<InstrumentCategory, LeverageClassLimits>>> {
  const rule = await client.riskRule.findUnique({
    where: { code: POLICY_CODE },
    select: { enabled: true, configuration: true },
  });
  return rule?.enabled ? parseLimits(rule.configuration) : {};
}

function assetLimits(
  instrument: LeverageInstrumentInput,
  classLimits: LeverageClassLimits | undefined,
): LeverageClassLimits | null {
  if (
    !classLimits ||
    !instrument.leverageEnabled ||
    !hasValidContractSize(instrument.contractSize)
  ) return null;
  const maximum = instrument.leverageMax
    ? Prisma.Decimal.min(instrument.leverageMax, classLimits.maximum)
    : classLimits.maximum;
  if (maximum.lt(MIN_LEVERAGE)) return null;
  const requestedDefault = instrument.leverageDefault ?? classLimits.default;
  return {
    default: Prisma.Decimal.min(requestedDefault, maximum),
    maximum,
  };
}

export async function resolveEffectiveLeverage(
  symbol: string,
  client: LeverageClient = prisma,
): Promise<EffectiveLeverage> {
  const [instrument, classLimits] = await Promise.all([
    client.instrument.findUnique({
      where: { symbol },
      select: {
        symbol: true,
        category: true,
        contractSize: true,
        leverageEnabled: true,
        leverageDefault: true,
        leverageMax: true,
      },
    }),
    loadClassLimits(client),
  ]);
  if (!instrument) throw new LeverageSettingsError("Instrument leverage configuration is unavailable.", 404);
  const limits = assetLimits(instrument, classLimits[instrument.category]);
  if (!limits) {
    return {
      enabled: false,
      default: null,
      maximum: null,
      contractSize: instrument.contractSize,
    };
  }

  return {
    enabled: true,
    default: limits.default,
    maximum: limits.maximum,
    contractSize: instrument.contractSize,
  };
}

export function leverageForOrder(
  settings: EffectiveLeverage,
  requestedValue?: number | null,
): Prisma.Decimal | null {
  if (!settings.enabled) {
    if (requestedValue != null) {
      throw new LeverageSettingsError("Leverage is disabled for this instrument.", 409);
    }
    return null;
  }
  if (settings.default == null || settings.maximum == null) {
    throw new LeverageSettingsError("Leverage defaults are not configured for this instrument.", 409);
  }

  const requested = requestedValue == null ? settings.default : ratioValue(requestedValue);
  if (!requested) throw new LeverageSettingsError("Leverage must be a ratio between 1x and 500x.");
  if (requested.gt(settings.maximum)) {
    throw new LeverageSettingsError(`Leverage cannot exceed the configured ${settings.maximum.toString()}x maximum.`);
  }
  return requested;
}
