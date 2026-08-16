/**
 * User settings resolution — the core of the per-user/per-group settings system.
 *
 * Resolution order (first non-null wins per field):
 *   1. UserProfile.settings (per-user overrides)
 *   2. UserGroup.settings (group defaults via the user's primary group)
 *   3. Global defaults (env vars + risk rules — the existing platform config)
 *
 * Settings are stored as JSON with a nested structure:
 *   { trading: {...}, deposits: {...}, withdrawals: {...}, pnl: {...}, balance: {...} }
 *
 * Missing fields at any layer fall through to the next layer. This means a
 * group or profile can override just one field (e.g. spreadMarkupPips) without
 * having to re-specify the entire settings object.
 */

import { prisma } from "./db";
import { PAYMENT_METHODS, disabledPaymentMethods } from "./paymentMethodDetails";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TradingSettings {
  enabled?: boolean;
  allowedCategories?: string[];
  maxOrderLots?: number;
  marginWarningPercent?: number;
}

export interface DepositSettings {
  uiEnabled?: boolean;
  allowedMethods?: string[];
  walletAddresses?: WalletAddressEntry[];
}

/** A platform crypto wallet shown to users on the deposit screen. */
export interface WalletAddressEntry {
  /** Optional display name, e.g. "Main USDT". */
  label?: string;
  /** Asset ticker: USDT | USDC | BTC | ETH. */
  asset: string;
  /** Network name, e.g. "TRON (TRC20)". */
  network: string;
  /** The deposit address users pay to. */
  address: string;
}

/**
 * Parse DEPOSIT_WALLET_ADDRESSES (global default wallet list).
 * Format: "asset:network:address;asset:network:address" — semicolon-separated
 * entries, colon-separated fields. Addresses never contain : or ; so this
 * stays env-friendly (no quoting dance like JSON in .env files).
 * Invalid entries are ignored. Unset/empty → [].
 */
export function parseEnvWalletAddresses(raw = process.env.DEPOSIT_WALLET_ADDRESSES ?? ""): WalletAddressEntry[] {
  return raw
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split(":").map((p) => p.trim());
      if (parts.length !== 3) return null;
      const [asset, network, address] = parts;
      if (!asset || !network || address.length < 8) return null;
      return { asset: asset.toUpperCase(), network, address } satisfies WalletAddressEntry;
    })
    .filter((entry): entry is WalletAddressEntry => entry !== null);
}

export interface WithdrawalSettings {
  requireKyc?: boolean;
  dailyLimit?: number | null;
  monthlyLimit?: number | null;
}

export interface PnlSettings {
  spreadMarkupPips?: number;
  commissionPerLotOverride?: number | null;
  pnlAdjustmentPercent?: number;
}

export interface BalanceSettings {
  demoStartingBalance?: number;
  maxCreditBonus?: number;
}

export interface ReferralSettings {
  enabled?: boolean;
  referrerReward?: number;
  referredReward?: number;
}

export interface UserSettingsConfig {
  trading?: TradingSettings;
  deposits?: DepositSettings;
  withdrawals?: WithdrawalSettings;
  pnl?: PnlSettings;
  balance?: BalanceSettings;
  referrals?: ReferralSettings;
}

/** Fully resolved settings (all fields guaranteed non-null). */
export interface ResolvedSettings {
  trading: {
    enabled: boolean;
    allowedCategories: string[];
    maxOrderLots: number;
    marginWarningPercent: number;
  };
  deposits: {
    uiEnabled: boolean;
    allowedMethods: string[];
    walletAddresses: WalletAddressEntry[];
  };
  withdrawals: {
    requireKyc: boolean;
    dailyLimit: number | null;
    monthlyLimit: number | null;
  };
  pnl: {
    spreadMarkupPips: number;
    commissionPerLotOverride: number | null;
    pnlAdjustmentPercent: number;
  };
  balance: {
    demoStartingBalance: number;
    maxCreditBonus: number;
  };
  referrals: {
    enabled: boolean;
    referrerReward: number;
    referredReward: number;
  };
  /** The group name if resolved from a group (for UI display). */
  groupName: string | null;
  /** The group color if resolved from a group. */
  groupColor: string | null;
}

// ─── Global defaults ─────────────────────────────────────────────────────────

function getGlobalDefaults(): ResolvedSettings {
  return {
    trading: {
      enabled: true,
      allowedCategories: ["FOREX", "CRYPTO", "COMMODITY", "INDEX", "STOCK"],
      maxOrderLots: Number(process.env.MAX_POSITION_LOTS ?? 100),
      marginWarningPercent: 125,
    },
    deposits: {
      uiEnabled: (process.env.DEPOSIT_UI_ENABLED ?? "true").toLowerCase() !== "false",
      // Derive from PAYMENT_METHODS_DISABLED so the admin UI, client wallet
      // selector, and API enforcement all agree on which methods are available.
      allowedMethods: PAYMENT_METHODS.filter((m) => !disabledPaymentMethods().has(m)),
      walletAddresses: parseEnvWalletAddresses(),
    },
    withdrawals: {
      requireKyc: (process.env.ALLOW_UNVERIFIED_WITHDRAWALS ?? "false").toLowerCase() !== "true"
        ? true
        : false,
      dailyLimit: null,
      monthlyLimit: null,
    },
    pnl: {
      spreadMarkupPips: 0,
      commissionPerLotOverride: null,
      pnlAdjustmentPercent: 0,
    },
    balance: {
      demoStartingBalance: 10000,
      maxCreditBonus: 5000,
    },
    referrals: {
      enabled: true,
      referrerReward: 25,
      referredReward: 10,
    },
    groupName: null,
    groupColor: null,
  };
}

// ─── Merge logic ─────────────────────────────────────────────────────────────

/** Deep-merge a partial config layer onto a resolved baseline. */
function applyLayer(base: ResolvedSettings, layer: UserSettingsConfig | null): ResolvedSettings {
  if (!layer) return base;
  return {
    trading: {
      enabled: layer.trading?.enabled ?? base.trading.enabled,
      allowedCategories: layer.trading?.allowedCategories ?? base.trading.allowedCategories,
      maxOrderLots: layer.trading?.maxOrderLots ?? base.trading.maxOrderLots,
      marginWarningPercent: layer.trading?.marginWarningPercent ?? base.trading.marginWarningPercent,
    },
    deposits: {
      uiEnabled: layer.deposits?.uiEnabled ?? base.deposits.uiEnabled,
      allowedMethods: layer.deposits?.allowedMethods ?? base.deposits.allowedMethods,
      // First non-empty list wins; an empty array means "not set" so cleared
      // lists inherit from the layer below (user → group → env default).
      walletAddresses:
        layer.deposits?.walletAddresses && layer.deposits.walletAddresses.length > 0
          ? layer.deposits.walletAddresses
          : base.deposits.walletAddresses,
    },
    withdrawals: {
      requireKyc: layer.withdrawals?.requireKyc ?? base.withdrawals.requireKyc,
      dailyLimit: layer.withdrawals?.dailyLimit ?? base.withdrawals.dailyLimit,
      monthlyLimit: layer.withdrawals?.monthlyLimit ?? base.withdrawals.monthlyLimit,
    },
    pnl: {
      spreadMarkupPips: layer.pnl?.spreadMarkupPips ?? base.pnl.spreadMarkupPips,
      commissionPerLotOverride: layer.pnl?.commissionPerLotOverride ?? base.pnl.commissionPerLotOverride,
      pnlAdjustmentPercent: layer.pnl?.pnlAdjustmentPercent ?? base.pnl.pnlAdjustmentPercent,
    },
    balance: {
      demoStartingBalance: layer.balance?.demoStartingBalance ?? base.balance.demoStartingBalance,
      maxCreditBonus: layer.balance?.maxCreditBonus ?? base.balance.maxCreditBonus,
    },
    referrals: {
      enabled: layer.referrals?.enabled ?? base.referrals.enabled,
      referrerReward: layer.referrals?.referrerReward ?? base.referrals.referrerReward,
      referredReward: layer.referrals?.referredReward ?? base.referrals.referredReward,
    },
    groupName: base.groupName,
    groupColor: base.groupColor,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Per-request cache to avoid repeated DB lookups within a single tick. */
const cache = new Map<string, { settings: ResolvedSettings; ts: number }>();
const CACHE_TTL_MS = 5_000;
const CACHE_MAX_SIZE = 500;

/** Periodic sweep to evict stale entries and prevent unbounded memory growth. */
function sweepCache() {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.ts > CACHE_TTL_MS * 2) cache.delete(key);
  }
  // Hard cap: if still too large, drop the oldest entries.
  if (cache.size > CACHE_MAX_SIZE) {
    const sorted = Array.from(cache.entries()).sort((a, b) => a[1].ts - b[1].ts);
    for (let i = 0; i < sorted.length - CACHE_MAX_SIZE; i++) {
      cache.delete(sorted[i][0]);
    }
  }
}
let sweepCounter = 0;

/**
 * Resolve the effective settings for a user by merging:
 * global defaults → group settings → per-user profile settings.
 *
 * Results are cached for 5 seconds per user to avoid hammering the DB during
 * rapid market ticks (every position mark calls this).
 */
export async function resolveUserSettings(userId: string): Promise<ResolvedSettings> {
  const cached = cache.get(userId);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.settings;
  }

  // Periodic sweep to prevent unbounded growth (every 50 lookups).
  if (++sweepCounter >= 50) { sweepCounter = 0; sweepCache(); }

  // Load the user's profile + primary group in one query.
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    include: {
      group: { select: { name: true, color: true, settings: true } },
    },
  });

  // Also check group memberships if no profile or profile.groupId is null.
  let groupSettings: UserSettingsConfig | null = null;
  let groupName: string | null = null;
  let groupColor: string | null = null;

  if (profile?.group) {
    groupSettings = profile.group.settings as UserSettingsConfig;
    groupName = profile.group.name;
    groupColor = profile.group.color;
  } else {
    // Fallback: check memberships for the first group with settings.
    const membership = await prisma.userGroupMembership.findFirst({
      where: { userId },
      include: { group: { select: { name: true, color: true, settings: true } } },
      orderBy: { assignedAt: "desc" },
    });
    if (membership?.group) {
      groupSettings = membership.group.settings as UserSettingsConfig;
      groupName = membership.group.name;
      groupColor = membership.group.color;
    }
  }

  const profileSettings = (profile?.settings as UserSettingsConfig) ?? null;

  // Merge: global → group → profile
  let resolved = getGlobalDefaults();
  resolved.groupName = groupName;
  resolved.groupColor = groupColor;
  resolved = applyLayer(resolved, groupSettings);
  resolved = applyLayer(resolved, profileSettings);

  cache.set(userId, { settings: resolved, ts: Date.now() });
  return resolved;
}

/** Clear the cache for a specific user (call after admin updates their settings). */
export function invalidateUserSettings(userId: string): void {
  cache.delete(userId);
}

/** Clear the entire cache (call after bulk group changes). */
export function invalidateAllSettings(): void {
  cache.clear();
}
