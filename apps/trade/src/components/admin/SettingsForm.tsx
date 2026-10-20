"use client";

import { useState, useEffect } from "react";
import type { WalletAddressEntry } from "@/server/userSettings";
import { validateDepositAddress } from "@/lib/paymentNetworks";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/switch";
import { CalendarDays, CalendarRange, Gauge, Gift, Layers, Network, Percent, Plus, RotateCcw, Save, Share2, SlidersHorizontal, Tag, TrendingDown, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/label";

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
    walletAddresses?: WalletAddressEntry[];
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
const WALLET_ASSETS = ["USDT", "USDC", "BTC", "ETH"];

interface Props {
  initial: UserSettingsConfig;
  onSave: (settings: UserSettingsConfig) => Promise<void>;
  saving?: boolean;
  /** Label for the save button. */
  saveLabel?: string;
}

interface GlobalDefaults {
  trading: { enabled: boolean; allowedCategories: string[]; maxOrderLots: number; marginWarningPercent: number };
  deposits: { uiEnabled: boolean; allowedMethods: string[]; walletAddresses: WalletAddressEntry[] };
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

  const toggleArrayItem = (path: string[], item: string, base?: string[]) => {
    // When nothing is stored yet, start from the effective (inherited/default)
    // list so the FIRST click only flips ONE chip instead of silently
    // materializing a single-item array that disables everything else.
    let current = base ?? [];
    if (!base) {
      try {
        const resolved = path.reduce<unknown>((acc, key) => (acc as Record<string, unknown>)?.[key], s);
        if (Array.isArray(resolved)) current = resolved as string[];
      } catch { /* default empty */ }
    }
    const next = current.includes(item) ? current.filter((x) => x !== item) : [...current, item];
    update(path, next);
  };

  /** Combine a human description with the env default value for hint display. */
  const fmtHint = (desc: string, defVal?: number | null, prefix = "", suffix = "") =>
    defVal != null ? `${desc} · Default: ${prefix}${defVal}${suffix}` : desc;

  const wallets = s.deposits?.walletAddresses ?? [];
  // A wallet row is invalid when its address fails the per-network format
  // check (catches placeholder values like "TXyZ...abc" before they reach users).
  const walletErrors = wallets.map((w) =>
    w.address.trim() === "" || w.network.trim() === "" ? null : validateDepositAddress(w.asset, w.network, w.address.trim()),
  );
  const hasWalletErrors = walletErrors.some(Boolean);
  // Effective chip lists: stored override, else the resolved default.
  const effectiveCategories = s.trading?.allowedCategories ?? defaults?.trading.allowedCategories ?? ALL_CATEGORIES;
  const categoriesInherited = s.trading?.allowedCategories == null;
  const effectiveMethods = s.deposits?.allowedMethods ?? defaults?.deposits.allowedMethods ?? ALL_METHODS;
  const methodsInherited = s.deposits?.allowedMethods == null;
  const dirty = JSON.stringify(s) !== JSON.stringify(initial);
  const setWallets = (next: WalletAddressEntry[]) => update(["deposits", "walletAddresses"], next);
  const updateWallet = (index: number, patch: Partial<WalletAddressEntry>) => {
    setWallets(wallets.map((w, i) => (i === index ? { ...w, ...patch } : w)));
  };

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
          <div className="flex items-baseline justify-between">
            <p className="text-xs text-muted-foreground mb-1.5">Allowed instrument categories</p>
            {categoriesInherited && <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inherited</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            {ALL_CATEGORIES.map((cat) => {
              const active = effectiveCategories.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleArrayItem(["trading", "allowedCategories"], cat, effectiveCategories)}
                  className={`h-7 cursor-pointer rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring ${
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent/60 hover:text-foreground"
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
          icon={<Layers size={13} strokeWidth={2} aria-hidden />}
          value={s.trading?.maxOrderLots}
          placeholder={defaults ? String(defaults.trading.maxOrderLots) : "100"}
          onChange={(v) => update(["trading", "maxOrderLots"], v)}
          hint={fmtHint("Maximum lots per order", defaults?.trading.maxOrderLots)}
        />
        <NumberInput
          label="Margin warning (%)"
          icon={<Gauge size={13} strokeWidth={2} aria-hidden />}
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
          <div className="flex items-baseline justify-between">
            <p className="text-xs text-muted-foreground mb-1.5">Allowed payment methods (Deposit and Withdrawal)</p>
            {methodsInherited && <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inherited</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            {ALL_METHODS.map((method) => {
              const active = effectiveMethods.includes(method);
              return (
                <button
                  key={method}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleArrayItem(["deposits", "allowedMethods"], method, effectiveMethods)}
                  className={`h-7 cursor-pointer rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring ${
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                }`}
                >
                  {method}
                </button>
              );
            })}
          </div>
        </div>
      </SettingsSection>

      {/* ── Deposit Wallets ── */}
      <SettingsSection title="Deposit Wallets (Crypto)">
        <p className="text-xs text-muted-foreground">
          Crypto addresses shown to users on the deposit screen. User-level wallets
          override group wallets; group wallets override the global default
          {defaults && defaults.deposits.walletAddresses.length > 0
            ? ` (${defaults.deposits.walletAddresses.length} from environment)`
            : ""}.
          Leave empty to inherit.
        </p>
        {wallets.length === 0 ? (
          <div className="border-dashed py-4 text-center">
            <p className="text-xs text-muted-foreground">
              No wallets set — using the next layer up (group / global default).
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {wallets.map((wallet, index) => (
              <div key={index} className="p-2.5 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">#{index + 1}</span>
                  <Input
                    value={wallet.label ?? ""}
                    onChange={(e) => updateWallet(index, { label: e.target.value })}
                    placeholder="Label (optional), e.g. Main USDT"
                    maxLength={40}
                    className="h-8 flex-1"
                    startIcon={<Tag size={13} strokeWidth={2} aria-hidden />}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setWallets(wallets.filter((_, i) => i !== index))}
                    aria-label={`Remove wallet ${index + 1}`}
                    className="h-8 w-8 shrink-0 hover:text-down"
                  >
                    <X size={14} strokeWidth={2} aria-hidden />
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-[100px_1fr]">
                  <NativeSelect
                    value={WALLET_ASSETS.includes(wallet.asset) ? wallet.asset : "USDT"}
                    onChange={(e) => updateWallet(index, { asset: e.target.value })}
                    aria-label="Asset"
                    className="h-8"
                  >
                    {WALLET_ASSETS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </NativeSelect>
                  <Input
                    value={wallet.network}
                    onChange={(e) => updateWallet(index, { network: e.target.value })}
                    placeholder="Network, e.g. TRON (TRC20)"
                    maxLength={60}
                    className="h-8"
                    startIcon={<Network size={13} strokeWidth={2} aria-hidden />}
                  />
                </div>
                <Input
                  value={wallet.address}
                  onChange={(e) => updateWallet(index, { address: e.target.value })}
                  placeholder="Deposit address"
                  maxLength={256}
                  aria-invalid={Boolean(walletErrors[index])}
                  className="h-8 w-full font-mono text-xs"
                  startIcon={<Wallet size={13} strokeWidth={2} aria-hidden />}
                />
                {walletErrors[index] && (
                  <p className="text-xs text-down">{walletErrors[index]}</p>
                )}
              </div>
            ))}
          </div>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setWallets([...wallets, { asset: "USDT", network: "", address: "" }])}
        >
          <Plus size={13} strokeWidth={2} aria-hidden /> Add wallet
        </Button>
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
          icon={<CalendarDays size={13} strokeWidth={2} aria-hidden />}
          value={s.withdrawals?.dailyLimit ?? undefined}
          placeholder={defaults?.withdrawals.dailyLimit ? String(defaults.withdrawals.dailyLimit) : "No limit"}
          onChange={(v) => update(["withdrawals", "dailyLimit"], v)}
          hint={fmtHint("Overrides the env daily cap when set; empty inherits it", defaults?.withdrawals.dailyLimit ?? undefined, "$")}
        />
        <NumberInput
          label="Monthly withdrawal limit (USD)"
          icon={<CalendarRange size={13} strokeWidth={2} aria-hidden />}
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
          icon={<SlidersHorizontal size={13} strokeWidth={2} aria-hidden />}
          value={s.pnl?.spreadMarkupPips}
          placeholder="0"
          onChange={(v) => update(["pnl", "spreadMarkupPips"], v)}
          hint={fmtHint("Extra pips added to the spread for this user/group", defaults?.pnl.spreadMarkupPips)}
        />
        <NumberInput
          label="Commission per lot override (USD)"
          icon={<Percent size={13} strokeWidth={2} aria-hidden />}
          value={s.pnl?.commissionPerLotOverride ?? undefined}
          placeholder="Use instrument default"
          onChange={(v) => update(["pnl", "commissionPerLotOverride"], v)}
          hint={fmtHint("Leave empty to use the instrument's default commission", defaults?.pnl.commissionPerLotOverride ?? undefined, "$")}
        />
        <NumberInput
          label="P/L adjustment (%)"
          icon={<TrendingDown size={13} strokeWidth={2} aria-hidden />}
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
          icon={<Wallet size={13} strokeWidth={2} aria-hidden />}
          value={s.balance?.demoStartingBalance}
          placeholder={defaults ? String(defaults.balance.demoStartingBalance) : "10000"}
          onChange={(v) => update(["balance", "demoStartingBalance"], v)}
          hint={fmtHint("Auto-credited to new accounts (0 = start empty)", defaults?.balance.demoStartingBalance, "$")}
        />
        <NumberInput
          label="Max credit/bonus (USD)"
          icon={<Gift size={13} strokeWidth={2} aria-hidden />}
          value={s.balance?.maxCreditBonus}
          placeholder={defaults ? String(defaults.balance.maxCreditBonus) : "5000"}
          onChange={(v) => update(["balance", "maxCreditBonus"], v)}
          hint={fmtHint("Caps total referral bonus accumulation per user", defaults?.balance.maxCreditBonus, "$")}
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
          icon={<Share2 size={13} strokeWidth={2} aria-hidden />}
          value={s.referrals?.referrerReward}
          placeholder={defaults ? String(defaults.referrals.referrerReward) : "25"}
          onChange={(v) => update(["referrals", "referrerReward"], v)}
          hint={fmtHint("Bonus paid to the person who shared the referral link", defaults?.referrals.referrerReward, "$")}
        />
        <NumberInput
          label="Referred reward (USD)"
          icon={<Gift size={13} strokeWidth={2} aria-hidden />}
          value={s.referrals?.referredReward}
          placeholder={defaults ? String(defaults.referrals.referredReward) : "10"}
          onChange={(v) => update(["referrals", "referredReward"], v)}
          hint={fmtHint("Bonus paid to the new user who used the referral link", defaults?.referrals.referredReward, "$")}
        />
      </SettingsSection>

      {/* ── Save ── */}
      <div className="flex items-center gap-3 border-t border-border pt-3">
        <Button
          type="button"
          onClick={() => void onSave(s)}
          disabled={saving || hasWalletErrors}
          loading={saving}
          loadingLabel="Saving"
          title={hasWalletErrors ? "Fix the invalid wallet address(es) above before saving." : undefined}
        >
          <Save size={13} strokeWidth={2} aria-hidden /> {saveLabel}
        </Button>
        {hasWalletErrors && (
          <span className="text-xs text-down">Fix the invalid wallet address{walletErrors.filter(Boolean).length > 1 ? "es" : ""} above to save.</span>
        )}
        {dirty && !saving && !hasWalletErrors && (
          <>
            <span className="text-xs text-primary">Unsaved changes</span>
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setS(initial)}>
              <RotateCcw size={13} strokeWidth={2} aria-hidden /> Reset
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── UI primitives ───────────────────────────────────────────────────────────

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-muted/30 p-4">
      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">{title}</h4>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Label className="flex cursor-pointer items-center justify-between">
      <span className="text-xs text-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </Label>
  );
}

function NumberInput({
  label,
  value,
  placeholder,
  onChange,
  hint,
  icon,
}: {
  label: string;
  value: number | undefined;
  placeholder?: string;
  onChange: (v: number | undefined) => void;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1 block text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        startIcon={icon}
      />
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
