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
type LeverageClient = Pick<Prisma.TransactionClient, "instrument" | "riskRule" | "userLeveragePreference">;

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
  selected: Prisma.Decimal | null;
  preference: Prisma.Decimal | null;
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

function cappedPreference(value: Prisma.Decimal | undefined, maximum: Prisma.Decimal): Prisma.Decimal | null {
  return value && value.gte(MIN_LEVERAGE) ? Prisma.Decimal.min(value, maximum) : null;
}

export function resolvePreferredLeverage(
  defaultRatio: Prisma.Decimal,
  maximum: Prisma.Decimal,
  classPreference?: Prisma.Decimal,
  assetPreference?: Prisma.Decimal,
): Prisma.Decimal {
  return cappedPreference(assetPreference, maximum) ??
    cappedPreference(classPreference, maximum) ??
    defaultRatio;
}

export async function resolveEffectiveLeverage(
  userId: string,
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
  const preferences = await client.userLeveragePreference.findMany({
    where: {
      userId,
      scopeKey: { in: [`class:${instrument.category}`, `asset:${instrument.symbol}`] },
    },
    select: { scopeKey: true, leverage: true },
  });
  const limits = assetLimits(instrument, classLimits[instrument.category]);
  if (!limits) {
    return {
      enabled: false,
      default: null,
      maximum: null,
      selected: null,
      preference: null,
      contractSize: instrument.contractSize,
    };
  }

  const preferenceByScope = new Map(preferences.map((preference) => [preference.scopeKey, preference.leverage]));
  const assetPreference = preferenceByScope.get(`asset:${instrument.symbol}`) ?? null;
  const selected = resolvePreferredLeverage(
    limits.default,
    limits.maximum,
    preferenceByScope.get(`class:${instrument.category}`),
    assetPreference ?? undefined,
  );

  return {
    enabled: true,
    default: limits.default,
    maximum: limits.maximum,
    selected,
    preference: assetPreference,
    contractSize: instrument.contractSize,
  };
}

export async function getUserLeverageSettings(userId: string) {
  const [classLimits, instruments, preferences] = await Promise.all([
    loadClassLimits(),
    prisma.instrument.findMany({
      where: { active: true },
      orderBy: [{ category: "asc" }, { symbol: "asc" }],
      select: {
        symbol: true,
        name: true,
        category: true,
        contractSize: true,
        leverageEnabled: true,
        leverageDefault: true,
        leverageMax: true,
      },
    }),
    prisma.userLeveragePreference.findMany({
      where: { userId },
      select: { scopeKey: true, leverage: true },
    }),
  ]);
  const preferenceByScope = new Map(preferences.map((item) => [item.scopeKey, item.leverage]));

  const categories = LEVERAGE_CATEGORIES.map((category) => {
    const limits = classLimits[category];
    const preference = preferenceByScope.get(`class:${category}`);
    return {
      category,
      enabled: limits != null,
      default: limits?.default.toNumber() ?? null,
      maximum: limits?.maximum.toNumber() ?? null,
      preference: preference?.toNumber() ?? null,
      selected: limits
        ? cappedPreference(preference, limits.maximum)?.toNumber() ?? limits.default.toNumber()
        : null,
    };
  });

  const assets = instruments.map((instrument) => {
    const limits = assetLimits(instrument, classLimits[instrument.category]);
    const assetPreference = preferenceByScope.get(`asset:${instrument.symbol}`);
    const classPreference = preferenceByScope.get(`class:${instrument.category}`);
    const selected = limits
      ? resolvePreferredLeverage(limits.default, limits.maximum, classPreference, assetPreference)
      : null;
    return {
      symbol: instrument.symbol,
      name: instrument.name,
      category: instrument.category,
      enabled: limits != null,
      default: limits?.default.toNumber() ?? null,
      maximum: limits?.maximum.toNumber() ?? null,
      preference: assetPreference?.toNumber() ?? null,
      selected: selected?.toNumber() ?? null,
    };
  });

  return { categories, assets };
}

export async function saveUserLeveragePreference(
  userId: string,
  scopeKey: string,
  leverage: number | null,
): Promise<void> {
  if (leverage === null) {
    await prisma.userLeveragePreference.deleteMany({ where: { userId, scopeKey } });
    return;
  }
  const requested = ratioValue(leverage);
  if (!requested) {
    throw new LeverageSettingsError("Leverage must be a ratio between 1x and 500x.");
  }

  let maximum: Prisma.Decimal | null = null;
  if (scopeKey.startsWith("class:")) {
    const category = scopeKey.slice("class:".length) as InstrumentCategory;
    if (!LEVERAGE_CATEGORIES.includes(category)) {
      throw new LeverageSettingsError("Unknown instrument class.");
    }
    maximum = (await loadClassLimits())[category]?.maximum ?? null;
  } else if (scopeKey.startsWith("asset:")) {
    const symbol = scopeKey.slice("asset:".length);
    const instrument = await prisma.instrument.findUnique({
      where: { symbol },
      select: {
        symbol: true,
        category: true,
        contractSize: true,
        leverageEnabled: true,
        leverageDefault: true,
        leverageMax: true,
      },
    });
    if (!instrument) throw new LeverageSettingsError("Instrument not found.", 404);
    const classLimits = await loadClassLimits();
    const limits = assetLimits(instrument, classLimits[instrument.category]);
    if (!limits) throw new LeverageSettingsError("Leverage is not enabled for this instrument.", 409);
    maximum = limits.maximum;
  } else {
    throw new LeverageSettingsError("Invalid leverage preference scope.");
  }

  if (!maximum) throw new LeverageSettingsError("Leverage is not configured for this scope.", 409);
  if (requested.gt(maximum)) {
    throw new LeverageSettingsError(`Leverage cannot exceed the configured ${maximum.toString()}x maximum.`);
  }

  await prisma.userLeveragePreference.upsert({
    where: { userId_scopeKey: { userId, scopeKey } },
    update: { leverage: requested },
    create: { userId, scopeKey, leverage: requested },
  });
}
