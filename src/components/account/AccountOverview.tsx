"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WalletModal } from "./WalletModal";
import { InstrumentIcon } from "@/components/icons/InstrumentIcon";
import { Button } from "@/components/ui/Button";
import { InfoHint } from "@/components/ui/InfoHint";
import { Tooltip } from "@/components/ui/Tooltip";
import { fmtDate } from "@/lib/dates";
import type { WalletAddressEntry } from "@/server/userSettings";

interface Props {
  user: { name: string; email: string; accountNo: string; createdAt: Date | string; verified: boolean };
  /** Live KYC review state — drives the Verification row. null = never submitted. */
  kyc?: { status: "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED"; note: string | null } | null;
  metrics: {
    balance: number;
    credit: number;
    equity: number;
    margin: number;
    marginLevel: number | null;
    free: number;
    floatingPl: number;
  };
  wallets: { asset: string; free: number; locked: number }[];
  openCount: number;
  depositUiEnabled?: boolean;
  disabledPaymentMethods?: string[];
  walletAddresses?: WalletAddressEntry[];
  onOpenVerification?: () => void;
}

/** Account summary: profile, equity hero with risk metrics, wallets. */
export function AccountOverview({ user, metrics, wallets, openCount, depositUiEnabled = true, disabledPaymentMethods = [], walletAddresses = [], kyc, onOpenVerification }: Props) {
  const router = useRouter();
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletMode, setWalletMode] = useState<"deposit" | "withdraw">("deposit");
  const floating = metrics.floatingPl;
  const floatingUp = floating >= 0;
  const money = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const walletTotal = wallets.reduce((sum, w) => sum + w.free + w.locked, 0);
  const walletLocked = wallets.reduce((sum, w) => sum + w.locked, 0);

  // Margin-level risk bands: below 100% the account can be margin-called,
  // below 125% it is in the warning band (matches the trading engine default).
  const ml = metrics.marginLevel;
  const mlTone = ml == null ? "text-text" : ml < 100 ? "text-down" : ml < 125 ? "text-brand" : "text-up";

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Profile card */}
      <div className="bg-canvas border border-border rounded-lg p-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-brand-soft flex items-center justify-center text-brand font-semibold text-lg">
            {(user.name || user.email)[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">{user.name}</div>
            <div className="text-xs text-text-muted truncate">{user.email}</div>
          </div>
        </div>
        <dl className="mt-4 space-y-2 text-xs">
          <Row label="Account Number" value={user.accountNo} />
          <Row label="Member Since" value={fmtDate(user.createdAt)} />
          <div className="flex items-center justify-between">
            <dt className="text-text-muted">Verification</dt>
            <dd className="flex items-center gap-2">
              <KycStatusChip status={kyc?.status ?? "NOT_SUBMITTED"} />
              {((kyc?.status ?? "NOT_SUBMITTED") === "NOT_SUBMITTED" || kyc?.status === "REJECTED") && (
                <button
                  type="button"
                  onClick={onOpenVerification}
                  className="text-[10px] font-semibold text-brand hover:underline"
                >
                  {kyc?.status === "REJECTED" ? "Resubmit →" : "Start →"}
                </button>
              )}
            </dd>
          </div>
          {kyc?.status === "REJECTED" && kyc.note && (
            <p className="text-[10px] leading-snug text-down" title={kyc.note}>
              Reason: {kyc.note}
            </p>
          )}
          <Row label="Open Positions" value={String(openCount)} />
        </dl>
      </div>

      {/* Equity hero + risk metrics */}
      <div className="bg-canvas border border-border rounded-lg p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium text-text-muted uppercase">Equity</h3>
          <span className="text-[10px] text-text-faint">All values in USD</span>
        </div>
        <p className="mt-2 text-3xl font-semibold tnum leading-tight">{money(metrics.equity)}</p>
        <p className={`mt-1 text-xs font-medium tnum ${floatingUp ? "text-up" : "text-down"}`}>
          {floatingUp ? "▲" : "▼"} {money(Math.abs(floating))} floating P/L
        </p>
        <p className="mt-1 text-[10px] text-text-faint">Equity = balance + floating P/L on open positions.</p>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border-soft pt-3">
          <StatSmall label="Balance" value={money(metrics.balance)} hint="Settled funds: approved deposits/withdrawals and closed-trade P/L. Excludes floating P/L." />
          <StatSmall label="Credit" value={money(metrics.credit)} hint="Bonus or administrative credit granted to the account." />
          <StatSmall label="Margin" value={money(metrics.margin)} hint="Collateral currently held against open positions." />
          <StatSmall label="Free Margin" value={money(metrics.free)} hint="Margin available to open new positions." />
        </div>
        <div className="mt-3 border-t border-border-soft pt-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center text-[11px] text-text-faint">Margin Level<InfoHint text="Margin level = equity ÷ margin. Below 125% is a warning; below 100% risks a margin call." /></span>
            <span className={`text-sm font-semibold tnum ${mlTone}`}>
              {ml != null ? `${ml.toFixed(2)}%` : "—"}
            </span>
          </div>
          {ml != null && ml < 125 && (
            <p className={`mt-1 text-[10px] ${ml < 100 ? "text-down" : "text-brand"}`}>
              {ml < 100 ? "Margin call territory — reduce exposure or deposit funds." : "Approaching margin thresholds — monitor open positions."}
            </p>
          )}
        </div>
      </div>

      {/* Wallets */}
      <div className="bg-canvas border border-border rounded-lg p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium text-text-muted uppercase">Wallets</h3>
          <span className="text-xs tnum font-semibold">{money(walletTotal)}</span>
        </div>
        {walletLocked > 0 && (
          <p className="text-[10px] text-text-faint">{money(walletLocked)} locked in pending operations</p>
        )}
        <div className="space-y-2">
          {wallets.map((w) => (
            <div key={w.asset} className="flex items-center justify-between py-2 border-b border-border-soft last:border-0">
              <div className="flex items-center gap-2">
                <InstrumentIcon symbol={w.asset} size={18} />
                <div>
                  <div className="text-sm font-medium">{w.asset}</div>
                  {w.locked > 0 && (
                    <div className="text-[11px] text-text-muted">
                      <Tooltip text="Reserved for pending withdrawals and open positions.">{w.locked.toFixed(2)} locked</Tooltip>
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm tnum">{w.free.toFixed(2)}</div>
                <div className="text-[10px] text-text-faint">
                  <Tooltip text="Free funds available to withdraw or trade.">available</Tooltip>
                </div>
              </div>
            </div>
          ))}
          {wallets.length === 0 && <div className="text-xs text-text-faint py-4 text-center">No wallets.</div>}
        </div>
        <div className={`grid gap-2 mt-4 ${depositUiEnabled ? "grid-cols-2" : "grid-cols-1"}`}>
          {depositUiEnabled && (
            <Button type="button" size="sm" variant="buy" onClick={() => { setWalletMode("deposit"); setWalletOpen(true); }}>
              Deposit
            </Button>
          )}
          <Button type="button" size="sm" onClick={() => { setWalletMode("withdraw"); setWalletOpen(true); }}>
            Withdraw
          </Button>
        </div>
      </div>

      <WalletModal
        open={walletOpen}
        mode={walletMode}
        depositEnabled={depositUiEnabled}
        disabledMethods={disabledPaymentMethods as ("CARD" | "BANK_TRANSFER" | "CRYPTO")[]}
        walletAddresses={walletAddresses}
        onClose={() => setWalletOpen(false)}
        onDone={() => router.refresh()}
      />
    </div>
  );
}

/** Honest KYC review state — explicit labels instead of a generic "Verified". */
function KycStatusChip({ status }: { status: "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED" }) {
  const styles: Record<typeof status, { className: string; label: string }> = {
    NOT_SUBMITTED: { className: "bg-panel-3 text-text-muted", label: "Not submitted" },
    PENDING: { className: "bg-brand-soft text-brand", label: "Under review" },
    APPROVED: { className: "bg-up/10 text-up", label: "Verified" },
    REJECTED: { className: "bg-down/10 text-down", label: "Rejected" },
  };
  const { className, label } = styles[status];
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${className}`}>{label}</span>;
}

function Row({ label, value, valueClass = "" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-text-muted">{label}</dt>
      <dd className={`tnum ${valueClass}`}>{value}</dd>
    </div>
  );
}

function StatSmall({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="flex items-center text-[11px] text-text-faint">{label}{hint && <InfoHint text={hint} />}</div>
      <div className="text-sm tnum">{value}</div>
    </div>
  );
}
