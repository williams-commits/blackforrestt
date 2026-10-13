"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WalletModal } from "./WalletModal";
import { InstrumentIcon } from "@/components/icons/InstrumentIcon";
import { Button } from "@/components/ui/Button";
import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, Info, Lock, Wallet } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { InfoHint } from "@/components/ui/InfoHint";
import { Tooltip } from "@/components/ui/Tooltip";
import { fmtDate } from "@/lib/dates";
import type { WalletAddressEntry } from "@/server/userSettings";

interface Props {
  /** Equity/margin ratio that marks the margin warning (user settings → env default 125). */
  marginWarningPercent?: number;
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

/** Account overview: identity + verification state, a dominant equity
 *  presentation with the risk metrics, and asset wallet rows. Financial
 *  hierarchy first — equity leads, supporting metrics follow, actions stay
 *  reachable. All values come from the live account metrics. */
export function AccountOverview({ user, metrics, wallets, openCount, depositUiEnabled = true, disabledPaymentMethods = [], walletAddresses = [], kyc, onOpenVerification, marginWarningPercent = 125, }: Props) {
  const router = useRouter();
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletMode, setWalletMode] = useState<"deposit" | "withdraw">("deposit");
  const floating = metrics.floatingPl;
  const floatingUp = floating >= 0;
  const money = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const walletTotal = wallets.reduce((sum, w) => sum + w.free + w.locked, 0);
  const walletLocked = wallets.reduce((sum, w) => sum + w.locked, 0);

  // Margin-level risk bands: below 100% the account can be margin-called,
  // below the configured warning threshold it is in the warning band
  // (user settings → env default 125%).
  const ml = metrics.marginLevel;
  const mlTone = ml == null ? "text-text" : ml < 100 ? "text-down" : ml < marginWarningPercent ? "text-brand" : "text-up";
  const kycStatus = kyc?.status ?? "NOT_SUBMITTED";

  return (
    <div className="space-y-5">
      {/* Equity hero + identity */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Equity presentation — the financial anchor of the portal */}
        <section aria-label="Account equity" className="rounded-lg border border-border bg-canvas p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-text-muted">Equity</div>
              <p className="mt-1.5 text-[28px] font-semibold tnum leading-none sm:text-[32px]">
                <span className="text-text-faint mr-1 text-xl align-top">$</span>{money(metrics.equity)}
              </p>
              <p className={`mt-2 text-sm font-medium tnum ${floatingUp ? "text-up" : "text-down"}`}>
                {floatingUp ? "▲" : "▼"} {money(Math.abs(floating))} floating P/L
                <span className="ml-2 font-normal text-text-faint">{openCount} open</span>
              </p>
            </div>
            <div className="flex gap-2">
              {depositUiEnabled && (
                <Button type="button" variant="brand" onClick={() => { setWalletMode("deposit"); setWalletOpen(true); }}>
                  <ArrowDownToLine size={14} strokeWidth={2} aria-hidden /> Deposit
                </Button>
              )}
              <Button type="button" variant={depositUiEnabled ? "default" : "brand"} onClick={() => { setWalletMode("withdraw"); setWalletOpen(true); }}>
                <ArrowUpFromLine size={14} strokeWidth={2} aria-hidden /> Withdraw
              </Button>
            </div>
          </div>

          {/* Supporting metrics — one tonal band, dividers instead of boxes */}
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border-soft pt-4 sm:grid-cols-4">
            <Metric label="Balance" value={money(metrics.balance)} hint="Settled funds: approved deposits/withdrawals and closed-trade P/L. Excludes floating P/L." />
            <Metric label="Free Margin" value={money(metrics.free)} hint="Margin available to open new positions." />
            <Metric label="Margin" value={money(metrics.margin)} hint="Collateral currently held against open positions." icon={<Lock size={12} strokeWidth={1.75} aria-hidden />} />
            <Metric label="Credit" value={money(metrics.credit)} hint="Bonus or administrative credit granted to the account." />
          </dl>
          <div className="mt-4 flex items-center justify-between border-t border-border-soft pt-3">
            <span className="flex items-center text-(length:--term-text-xs) text-text-faint">
              Margin Level
              <InfoHint text={`Margin level = equity ÷ margin. Below ${marginWarningPercent}% is a warning; below 100% risks a margin call.`} />
            </span>
            <span className={`text-sm font-semibold tnum ${mlTone}`}>
              {ml != null ? `${ml.toFixed(2)}%` : "—"}
            </span>
          </div>
          {ml != null && ml < marginWarningPercent && (
            <p className={`mt-1.5 flex items-start gap-1.5 text-(length:--term-text-xs) ${ml < 100 ? "text-down" : "text-brand"}`} role="status">
              <Info size={12} strokeWidth={2} aria-hidden className="mt-px shrink-0" />
              {ml < 100 ? "Margin call territory — reduce exposure or deposit funds." : "Approaching margin thresholds — monitor open positions."}
            </p>
          )}
        </section>

        {/* Identity + verification — compact companion column */}
        <section aria-label="Profile and verification" className="rounded-lg border border-border bg-canvas p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
              <span className="text-lg font-semibold">{(user.name || user.email)[0]?.toUpperCase()}</span>
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{user.name}</div>
              <div className="truncate text-xs text-text-muted">{user.email}</div>
            </div>
          </div>
          <dl className="mt-4 space-y-2 text-xs">
            <Row label="Account Number" value={user.accountNo} />
            <Row label="Member Since" value={fmtDate(user.createdAt)} />
            <div className="flex items-center justify-between gap-2">
              <dt className="text-text-muted">Verification</dt>
              <dd className="flex items-center gap-2">
                <KycStatusChip status={kycStatus} />
                {(kycStatus === "NOT_SUBMITTED" || kycStatus === "REJECTED") && (
                  <button
                    type="button"
                    onClick={onOpenVerification}
                    className="inline-flex items-center gap-1 text-(length:--term-text-2xs) font-semibold text-brand hover:underline"
                  >
                    {kycStatus === "REJECTED" ? "Resubmit" : "Start"}<ArrowRight size={11} strokeWidth={2} aria-hidden />
                  </button>
                )}
              </dd>
            </div>
            {kycStatus === "REJECTED" && kyc?.note && (
              <p className="text-(length:--term-text-2xs) leading-snug text-down" title={kyc.note}>
                Reason: {kyc.note}
              </p>
            )}
          </dl>
        </section>
      </div>

      {/* Wallets — asset rows, not boxed per-cell */}
      <section aria-label="Wallet balances" className="rounded-lg border border-border bg-canvas p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">Wallets</h2>
          <span className="text-sm tnum font-semibold">{money(walletTotal)} <span className="font-normal text-text-faint">total</span></span>
        </div>
        {walletLocked > 0 && (
          <p className="mt-0.5 text-(length:--term-text-xs) text-text-faint">{money(walletLocked)} locked in pending operations</p>
        )}
        <div className="mt-3">
          {wallets.length > 0 ? (
            <ul>
              {wallets.map((w) => (
                <li key={w.asset} className="flex items-center justify-between gap-3 border-b border-border-soft py-3 last:border-0 last:pb-0">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <InstrumentIcon symbol={w.asset} size={20} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{w.asset}</div>
                      {w.locked > 0 && (
                        <div className="text-(length:--term-text-xs) text-text-muted">
                          <Tooltip text="Reserved for pending withdrawals and open positions.">{w.locked.toFixed(2)} locked</Tooltip>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm tnum font-medium">{w.free.toFixed(2)}</div>
                    <div className="text-(length:--term-text-2xs) text-text-faint">
                      <Tooltip text="Free funds available to withdraw or trade.">available</Tooltip>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={<Wallet size={18} />} title="No wallets yet" hint="Fund your account to open your first wallet." />
          )}
        </div>
      </section>

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
    PENDING: { className: "bg-(--term-warning-bg) text-(--term-warning-fg)", label: "Under review" },
    APPROVED: { className: "bg-(--term-success-bg) text-(--term-success-fg)", label: "Verified" },
    REJECTED: { className: "bg-(--term-danger-bg) text-(--term-danger-fg)", label: "Rejected" },
  };
  const { className, label } = styles[status];
  return <span className={`rounded-full px-2 py-0.5 text-(length:--term-text-2xs) font-semibold ${className}`}>{label}</span>;
}

function Row({ label, value, valueClass = "" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-text-muted">{label}</dt>
      <dd className={`tnum ${valueClass}`}>{value}</dd>
    </div>
  );
}

function Metric({ label, value, hint, icon }: { label: string; value: string; hint?: string; icon?: React.ReactNode }) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-(length:--term-text-xs) text-text-faint">
        {icon}{label}{hint && <InfoHint text={hint} />}
      </dt>
      <dd className="mt-1 text-[17px] font-semibold tnum leading-tight">{value}</dd>
    </div>
  );
}
