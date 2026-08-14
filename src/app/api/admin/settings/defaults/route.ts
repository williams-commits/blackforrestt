import { NextResponse } from "next/server";
import { AdminError, requireAdmin } from "@/server/admin";
import { resolveUserSettings } from "@/server/userSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/settings/defaults — returns the resolved global defaults
 *  (read from process.env at runtime). Lets admins see the actual production
 *  configuration before applying per-group or per-user overrides. */
export async function GET() {
  try {
    await requireAdmin("ADMIN_DASHBOARD");

    // Resolve settings for a non-existent user → returns global defaults only.
    const defaults = await resolveUserSettings("__global_defaults__");

    return NextResponse.json({
      defaults: {
        trading: {
          enabled: defaults.trading.enabled,
          allowedCategories: defaults.trading.allowedCategories,
          maxOrderLots: defaults.trading.maxOrderLots,
          marginWarningPercent: defaults.trading.marginWarningPercent,
        },
        deposits: {
          uiEnabled: defaults.deposits.uiEnabled,
          allowedMethods: defaults.deposits.allowedMethods,
        },
        withdrawals: {
          requireKyc: defaults.withdrawals.requireKyc,
          dailyLimit: defaults.withdrawals.dailyLimit,
          monthlyLimit: defaults.withdrawals.monthlyLimit,
        },
        pnl: {
          spreadMarkupPips: defaults.pnl.spreadMarkupPips,
          commissionPerLotOverride: defaults.pnl.commissionPerLotOverride,
          pnlAdjustmentPercent: defaults.pnl.pnlAdjustmentPercent,
        },
        balance: {
          demoStartingBalance: defaults.balance.demoStartingBalance,
          maxCreditBonus: defaults.balance.maxCreditBonus,
        },
        referrals: {
          enabled: defaults.referrals.enabled,
          referrerReward: defaults.referrals.referrerReward,
          referredReward: defaults.referrals.referredReward,
        },
      },
      env: {
        DEPOSIT_UI_ENABLED: process.env.DEPOSIT_UI_ENABLED ?? "(unset → true)",
        PAYMENT_METHODS_DISABLED: process.env.PAYMENT_METHODS_DISABLED ?? "(unset → none)",
        ALLOW_UNVERIFIED_WITHDRAWALS: process.env.ALLOW_UNVERIFIED_WITHDRAWALS ?? "(unset → false)",
        MAX_POSITION_LOTS: process.env.MAX_POSITION_LOTS ?? "(unset → 100)",
        REGISTRATION_REQUIRE_EMAIL_VERIFICATION: process.env.REGISTRATION_REQUIRE_EMAIL_VERIFICATION ?? "(unset → false)",
        MARKET_DATA_MODE: process.env.MARKET_DATA_MODE ?? "(unset → simulation)",
        SIMPLE_PAYMENT_APPROVAL: process.env.SIMPLE_PAYMENT_APPROVAL ?? "(unset → false)",
        BRAND_DOMAIN: process.env.BRAND_DOMAIN ?? "(unset)",
        TRADE_SUBDOMAIN: process.env.TRADE_SUBDOMAIN ?? "(unset → trade)",
      },
    });
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to load defaults." : (error as Error).message }, { status });
  }
}
