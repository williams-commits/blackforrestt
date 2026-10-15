"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WalletModal } from "./WalletModal";
import { InstrumentIcon } from "@/components/icons/InstrumentIcon";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, Info, Lock, Wallet } from "lucide-react";
import { IdentityTile, initialsOf } from "@/components/ui/Initial";
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

/** Account overview in native shadcn structure — equity hero Card, identity
 *  Card, wallet Card. All values come from the live account metrics. */
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
  const mlTone = ml == null ? "" : ml < 100 ? "text-down" : ml < marginWarningPercent ? "text-brand" : "text-up";
  const kycStatus = kyc?.status ?? "NOT_SUBMITTED";

  return (
    <div className="space-y-8">
      {/* Equity hero + identity */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Equity</CardTitle>
            <CardDescription>
              {openCount} open {openCount === 1 ? "position" : "positions"} · live account value including floating P/L
            </CardDescription>
            <CardAction className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-none sm:flex">
              {depositUiEnabled && (
                <Button type="button" onClick={() => { setWalletMode("deposit"); setWalletOpen(true); }} className="w-full sm:w-auto">
                  <ArrowDownToLine size={14} strokeWidth={2} aria-hidden /> Deposit
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => { setWalletMode("withdraw"); setWalletOpen(true); }} className="w-full sm:w-auto">
                <ArrowUpFromLine size={14} strokeWidth={2} aria-hidden /> Withdraw
              </Button>
            </CardAction>
            <div className="pt-1">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
                <span className="text-3xl font-semibold tracking-tight tabular-nums">
                  <span className="align-top text-lg font-normal text-muted-foreground">$</span>{money(metrics.equity)}
                </span>
                <span className={`text-sm font-medium tabular-nums ${floatingUp ? "text-up" : "text-down"}`}>
                  {floatingUp ? "▲" : "▼"} {money(Math.abs(floating))} floating P/L
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {/* Supporting metrics — one band under the hero, dividers between */}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
              <Metric label="Balance" value={money(metrics.balance)} hint="Settled funds: approved deposits/withdrawals and closed-trade P/L. Excludes floating P/L." />
              <Metric label="Free Margin" value={money(metrics.free)} hint="Margin available to open new positions." />
              <Metric label="Margin" value={money(metrics.margin)} hint="Collateral currently held against open positions." icon={<Lock size={12} strokeWidth={1.75} aria-hidden />} />
              <Metric label="Credit" value={money(metrics.credit)} hint="Bonus or administrative credit granted to the account." />
              <Metric
                label="Margin Level"
                value={ml != null ? `${ml.toFixed(2)}%` : "—"}
                valueClass={mlTone}
                hint={`Margin level = equity ÷ margin. Below ${marginWarningPercent}% is a warning; below 100% risks a margin call.`}
              />
            </dl>
            {ml != null && ml < marginWarningPercent && (
              <p className={`mt-4 flex items-start gap-1.5 text-xs ${ml < 100 ? "text-down" : "text-brand"}`} role="status">
                <Info size={12} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0" />
                {ml < 100 ? "Margin call territory — reduce exposure or deposit funds." : "Approaching margin thresholds — monitor open positions."}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Identity + verification — compact companion column */}
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <IdentityTile size="lg" tone="brand" className="text-base font-semibold">
                {initialsOf(user.name || user.email)}
              </IdentityTile>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{user.name}</div>
                <div className="truncate text-xs text-muted-foreground">{user.email}</div>
              </div>
            </div>
            <dl className="space-y-2.5 border-t-0 pt-4 text-sm">
              <Row label="Account Number" value={user.accountNo} />
              <Row label="Member Since" value={fmtDate(user.createdAt)} />
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Verification</dt>
                <dd className="flex items-center gap-2">
                  <KycStatusChip status={kycStatus} />
                  {(kycStatus === "NOT_SUBMITTED" || kycStatus === "REJECTED") && (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={onOpenVerification}
                    >
                      {kycStatus === "REJECTED" ? "Resubmit" : "Start"}<ArrowRight size={11} strokeWidth={2} aria-hidden />
                    </Button>
                  )}
                </dd>
              </div>
              {kycStatus === "REJECTED" && kyc?.note && (
                <p className="text-xs leading-snug text-down" title={kyc.note}>
                  Reason: {kyc.note}
                </p>
              )}
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Wallets */}
      <Card>
        <CardHeader>
          <CardTitle>Wallets</CardTitle>
          {walletLocked > 0 && (
            <CardDescription>{money(walletLocked)} locked in pending operations</CardDescription>
          )}
          <CardAction className="text-sm font-semibold tabular-nums">
            {money(walletTotal)} <span className="font-normal text-muted-foreground">total</span>
          </CardAction>
        </CardHeader>
        <CardContent>
          {wallets.length > 0 ? (
            <ul className="-my-2 space-y-1">
              {wallets.map((w) => (
                <li key={w.asset} className="flex items-center justify-between gap-3 rounded-lg px-3 py-3 transition-colors bg-muted/30 hover:bg-muted/60">
                  <div className="flex min-w-0 items-center gap-3">
                    <InstrumentIcon symbol={w.asset} size={24} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium leading-none">{w.asset}</div>
                      {w.locked > 0 && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          <Tooltip text="Reserved for pending withdrawals and open positions.">{w.locked.toFixed(2)} locked</Tooltip>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="whitespace-nowrap text-right text-sm font-medium tabular-nums">
                    <Tooltip text="Free funds available to withdraw or trade.">
                      <span>{w.free.toFixed(2)} <span className="font-normal text-muted-foreground">available</span></span>
                    </Tooltip>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-muted/40 py-10 text-center">
              <Wallet size={18} strokeWidth={1.75} className="text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium">No wallets yet</p>
              <p className="text-xs text-muted-foreground">Fund your account to open your first wallet.</p>
            </div>
          )}
        </CardContent>
      </Card>

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
  const tones: Record<typeof status, string> = {
    NOT_SUBMITTED: "bg-secondary text-muted-foreground",
    PENDING: "bg-(--term-warning-bg) text-(--term-warning-fg)",
    APPROVED: "bg-(--term-success-bg) text-(--term-success-fg)",
    REJECTED: "bg-(--term-danger-bg) text-(--term-danger-fg)",
  };
  const labels: Record<typeof status, string> = {
    NOT_SUBMITTED: "Not submitted",
    PENDING: "Under review",
    APPROVED: "Verified",
    REJECTED: "Rejected",
  };
  return <Badge variant="secondary" className={tones[status]}>{labels[status]}</Badge>;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function Metric({ label, value, valueClass = "", hint, icon }: { label: string; value: string; valueClass?: string; hint?: string; icon?: React.ReactNode }) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}{label}{hint && <InfoHint text={hint} />}
      </dt>
      <dd className={`mt-1 text-lg font-semibold tabular-nums leading-tight ${valueClass}`}>{value}</dd>
    </div>
  );
}
