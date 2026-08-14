"use client";

import { useState, useEffect } from "react";

/**
 * Reusable settings form for both group settings and per-user profile overrides.
 * Renders all configurable fields as toggles, inputs, and checkboxes.
 * On save, calls onSave with the full settings JSON object.
 */

export interface UserSettingsConfig {
  trading?: {
    enabled?: boolean;
    allowedCategories?: string[];
    maxOrderLots?: number;
    marginWarningPercent?: number;
  };
  deposits?: {
    uiEnabled?: boolean;
    allowedMethods?: string[];
  };
  withdrawals?: {
    requireKyc?: boolean;
    dailyLimit?: number | null;
    monthlyLimit?: number | null;
  };
  pnl?: {
    spreadMarkupPips?: number;
    commissionPerLotOverride?: number | null;
    pnlAdjustmentPercent?: number;
  };
  balance?: {
    demoStartingBalance?: number;
    maxCreditBonus?: number;
  };
  referrals?: {
    enabled?: boolean;
    referrerReward?: number;
    referredReward?: number;
  };
}

const ALL_CATEGORIES = ["FOREX", "CRYPTO", "COMMODITY", "INDEX", "STOCK"];
const ALL_METHODS = ["CARD", "BANK_TRANSFER", "CRYPTO"];

interface Props {
  initial: UserSettingsConfig;
  onSave: (settings: UserSettingsConfig) => Promise<void>;
  saving?: boolean;
  /** Label for the save button. */
  saveLabel?: string;
}

interface GlobalDefaults {
  trading: { enabled: boolean; allowedCategories: string[]; maxOrderLots: number; marginWarningPercent: number };
  deposits: { uiEnabled: boolean; allowedMethods: string[] };
  withdrawals: { requireKyc: boolean; dailyLimit: number | null; monthlyLimit: number | null };
  pnl: { spreadMarkupPips: number; commissionPerLotOverride: number | null; pnlAdjustmentPercent: number };
  balance: { demoStartingBalance: number; maxCreditBonus: number };
  referrals: { enabled: boolean; referrerReward: number; referredReward: number };
}

export function SettingsForm({ initial, onSave, saving = false, saveLabel = "Save Settings" }: Props) {
  const [s, setS] = useState<UserSettingsConfig>(initial);
  const [defaults, setDefaults] = useState<GlobalDefaults | null>(null);

  useEffect(() => { setS(initial); }, [initial]);

  // Load global defaults (from .env) to show as hints.
  useEffect(() => {
    fetch("/api/admin/settings/defaults", { cache: "no-store" })
      .then(async (res) => res.ok ? (await res.json()).defaults : null)
      .then((d) => d ? setDefaults(d) : null)
      .catch(() => {});
  }, []);

  const update = (path: string[], value: unknown) => {
    setS((prev) => {
      const next = structuredClone(prev) as Record<string, unknown>;
      let cursor = next;
      for (let i = 0; i < path.length - 1; i++) {
        cursor[path[i]] = (cursor[path[i]] as Record<string, unknown>) ?? {};
        cursor = cursor[path[i]] as Record<string, unknown>;
      }
      cursor[path[path.length - 1]] = value;
      return next as UserSettingsConfig;
    });
  };

  const toggleArrayItem = (path: string[], item: string) => {
    let current: string[] = [];
    try {
      const resolved = path.reduce<unknown>((acc, key) => (acc as Record<string, unknown>)?.[key], s);
      if (Array.isArray(resolved)) current = resolved as string[];
    } catch { /* default empty */ }
    const next = current.includes(item) ? current.filter((x) => x !== item) : [...current, item];
    update(path, next);
  };

  /** Combine a human description with the env default value for hint display. */
  const fmtHint = (desc: string, defVal?: number | null, prefix = "", suffix = "") =>
    defVal != null ? `${desc} · Default: ${prefix}${defVal}${suffix}` : desc;

  return (
    <div className="space-y-5">
      {/* ── Trading ── */}
      <SettingsSection title="Trading">
        <Toggle
          label="Trading enabled"
          checked={s.trading?.enabled ?? defaults?.trading.enabled ?? true}
          onChange={(v) => update(["trading", "enabled"], v)}
        />
        <div>
          <p className="text-xs text-text-muted mb-1.5">Allowed instrument categories</p>
          <div className="flex flex-wrap gap-2">
            {ALL_CATEGORIES.map((cat) => {
              const active = s.trading?.allowedCategories?.includes(cat) ?? true;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleArrayItem(["trading", "allowedCategories"], cat)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium border transition ${
                    active ? "bg-brand text-white border-brand" : "bg-panel-2 text-text-muted border-border"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
        <NumberInput
          label="Max order volume (lots)"
          value={s.trading?.maxOrderLots}
          placeholder={defaults ? String(defaults.trading.maxOrderLots) : "100"}
          onChange={(v) => update(["trading", "maxOrderLots"], v)}
          hint={fmtHint("Maximum lots per order", defaults?.trading.maxOrderLots)}
        />
        <NumberInput
          label="Margin warning (%)"
          value={s.trading?.marginWarningPercent}
          placeholder={defaults ? String(defaults.trading.marginWarningPercent) : "125"}
          onChange={(v) => update(["trading", "marginWarningPercent"], v)}
          hint={fmtHint("Equity/margin ratio that triggers a warning", defaults?.trading.marginWarningPercent, "", "%")}
        />
      </SettingsSection>

      {/* ── Deposits ── */}
      <SettingsSection title="Deposits">
        <Toggle
          label="Deposit UI enabled"
          checked={s.deposits?.uiEnabled ?? defaults?.deposits.uiEnabled ?? true}
          onChange={(v) => update(["deposits", "uiEnabled"], v)}
        />
        <div>
          <p className="text-xs text-text-muted mb-1.5">Allowed payment methods</p>
          <div className="flex flex-wrap gap-2">
            {ALL_METHODS.map((method) => {
              const active = s.deposits?.allowedMethods?.includes(method) ?? true;
              return (
                <button
                  key={method}
                  type="button"
                  onClick={() => toggleArrayItem(["deposits", "allowedMethods"], method)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium border transition ${
                    active ? "bg-brand text-white border-brand" : "bg-panel-2 text-text-muted border-border"
                  }`}
                >
                  {method}
                </button>
              );
            })}
          </div>
        </div>
      </SettingsSection>

      {/* ── Withdrawals ── */}
      <SettingsSection title="Withdrawals">
        <Toggle
          label="Require KYC verification"
          checked={s.withdrawals?.requireKyc ?? defaults?.withdrawals.requireKyc ?? true}
          onChange={(v) => update(["withdrawals", "requireKyc"], v)}
        />
        <NumberInput
          label="Daily withdrawal limit (USD)"
          value={s.withdrawals?.dailyLimit ?? undefined}
          placeholder={defaults?.withdrawals.dailyLimit ? String(defaults.withdrawals.dailyLimit) : "No limit"}
          onChange={(v) => update(["withdrawals", "dailyLimit"], v)}
          hint={fmtHint("Leave empty for no daily limit", defaults?.withdrawals.dailyLimit ?? undefined, "$")}
        />
        <NumberInput
          label="Monthly withdrawal limit (USD)"
          value={s.withdrawals?.monthlyLimit ?? undefined}
          placeholder={defaults?.withdrawals.monthlyLimit ? String(defaults.withdrawals.monthlyLimit) : "No limit"}
          onChange={(v) => update(["withdrawals", "monthlyLimit"], v)}
          hint={fmtHint("Leave empty for no monthly limit", defaults?.withdrawals.monthlyLimit ?? undefined, "$")}
        />
      </SettingsSection>

      {/* ── P/L Manipulation ── */}
      <SettingsSection title="P/L Manipulation">
        <NumberInput
          label="Spread markup (pips)"
          value={s.pnl?.spreadMarkupPips}
          placeholder="0"
          onChange={(v) => update(["pnl", "spreadMarkupPips"], v)}
          hint={fmtHint("Extra pips added to the spread for this user/group", defaults?.pnl.spreadMarkupPips)}
        />
        <NumberInput
          label="Commission per lot override (USD)"
          value={s.pnl?.commissionPerLotOverride ?? undefined}
          placeholder="Use instrument default"
          onChange={(v) => update(["pnl", "commissionPerLotOverride"], v)}
          hint={fmtHint("Leave empty to use the instrument's default commission", defaults?.pnl.commissionPerLotOverride ?? undefined, "$")}
        />
        <NumberInput
          label="P/L adjustment (%)"
          value={s.pnl?.pnlAdjustmentPercent}
          placeholder="0"
          onChange={(v) => update(["pnl", "pnlAdjustmentPercent"], v)}
          hint={fmtHint("Negative value reduces displayed P/L (e.g. -5 = -5%)", defaults?.pnl.pnlAdjustmentPercent, "", "%")}
        />
      </SettingsSection>

      {/* ── Balance ── */}
      <SettingsSection title="Balance & Bonus">
        <NumberInput
          label="Demo starting balance (USD)"
          value={s.balance?.demoStartingBalance}
          placeholder={defaults ? String(defaults.balance.demoStartingBalance) : "10000"}
          onChange={(v) => update(["balance", "demoStartingBalance"], v)}
          hint={fmtHint("Starting balance for new demo accounts", defaults?.balance.demoStartingBalance, "$")}
        />
        <NumberInput
          label="Max credit/bonus (USD)"
          value={s.balance?.maxCreditBonus}
          placeholder={defaults ? String(defaults.balance.maxCreditBonus) : "5000"}
          onChange={(v) => update(["balance", "maxCreditBonus"], v)}
          hint={fmtHint("Caps total bonus accumulation per user", defaults?.balance.maxCreditBonus, "$")}
        />
      </SettingsSection>

      {/* ── Referrals ── */}
      <SettingsSection title="Referrals">
        <Toggle
          label="Referrals enabled"
          checked={s.referrals?.enabled ?? defaults?.referrals.enabled ?? true}
          onChange={(v) => update(["referrals", "enabled"], v)}
        />
        <NumberInput
          label="Referrer reward (USD)"
          value={s.referrals?.referrerReward}
          placeholder={defaults ? String(defaults.referrals.referrerReward) : "25"}
          onChange={(v) => update(["referrals", "referrerReward"], v)}
          hint={fmtHint("Bonus paid to the person who shared the referral link", defaults?.referrals.referrerReward, "$")}
        />
        <NumberInput
          label="Referred reward (USD)"
          value={s.referrals?.referredReward}
          placeholder={defaults ? String(defaults.referrals.referredReward) : "10"}
          onChange={(v) => update(["referrals", "referredReward"], v)}
          hint={fmtHint("Bonus paid to the new user who used the referral link", defaults?.referrals.referredReward, "$")}
        />
      </SettingsSection>

      {/* ── Save ── */}
      <div className="pt-2 border-t border-border-soft">
        <button
          type="button"
          onClick={() => void onSave(s)}
          disabled={saving}
          className="rounded-lg bg-brand px-5 py-2.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50 transition"
        >
          {saving ? "Saving…" : saveLabel}
        </button>
      </div>
    </div>
  );
}

// ─── UI primitives ───────────────────────────────────────────────────────────

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-panel p-4">
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-text-faint mb-3">{title}</h4>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-xs text-text">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-brand" : "bg-panel-3"}`}
        aria-pressed={checked}
      >
        <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-150 ${checked ? "translate-x-4" : "translate-x-0"}`} />
      </button>
    </label>
  );
}

function NumberInput({
  label,
  value,
  placeholder,
  onChange,
  hint,
}: {
  label: string;
  value: number | undefined;
  placeholder?: string;
  onChange: (v: number | undefined) => void;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-text-muted mb-1">{label}</label>
      <input
        type="number"
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        className="w-full h-9 rounded-lg border border-border bg-canvas px-3 text-sm outline-none focus:border-brand"
      />
      {hint && <p className="mt-1 text-[10px] text-text-faint">{hint}</p>}
    </div>
  );
}
