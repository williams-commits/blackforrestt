"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WalletModal } from "./WalletModal";

interface Props {
  user: { name: string; email: string; accountNo: string; createdAt: Date | string; verified: boolean };
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
}

/** Account summary cards: profile, balance stats, wallets. */
export function AccountOverview({ user, metrics, wallets, openCount, depositUiEnabled = true, disabledPaymentMethods = [] }: Props) {
  const router = useRouter();
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletMode, setWalletMode] = useState<"deposit" | "withdraw">("deposit");
  const floating = metrics.floatingPl;
  const floatingUp = floating >= 0;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Profile card */}
      <div className="bg-canvas border border-border rounded-lg p-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-brand-soft flex items-center justify-center text-brand font-semibold text-lg">
            {(user.name || user.email)[0]?.toUpperCase()}
          </div>
          <div>
            <div className="font-semibold text-sm">{user.name}</div>
            <div className="text-xs text-text-muted">{user.email}</div>
          </div>
        </div>
        <dl className="mt-4 space-y-2 text-xs">
          <Row label="Account Number" value={user.accountNo} />
          <Row label="Member Since" value={new Date(user.createdAt).toLocaleDateString("en-GB")} />
          <Row
            label="Status"
            value={user.verified ? "Verified" : "Unverified"}
            valueClass={user.verified ? "text-up" : "text-down"}
          />
          <Row label="Open Positions" value={String(openCount)} />
        </dl>
      </div>

      {/* Balance stats */}
      <div className="bg-canvas border border-border rounded-lg p-5">
        <h3 className="text-xs font-medium text-text-muted uppercase mb-4">Account Balance</h3>
        <div className="space-y-3">
          <StatBig label="Balance" value={usd(metrics.balance)} />
          <StatBig label="Equity" value={usd(metrics.equity)} />
          <StatBig
            label="Floating P/L"
            value={`${floating >= 0 ? "+" : ""}${floating.toFixed(2)}`}
            valueClass={floatingUp ? "text-up" : "text-down"}
          />
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border-soft">
            <StatSmall label="Margin" value={usd(metrics.margin)} />
            <StatSmall label="Free" value={usd(metrics.free)} />
            <StatSmall label="Credit" value={usd(metrics.credit)} />
            <StatSmall
              label="Margin Level"
              value={metrics.marginLevel != null ? `${metrics.marginLevel.toFixed(2)}%` : "—"}
            />
          </div>
        </div>
      </div>

      {/* Wallets */}
      <div className="bg-canvas border border-border rounded-lg p-5">
        <h3 className="text-xs font-medium text-text-muted uppercase mb-4">Wallets</h3>
        <div className="space-y-2">
          {wallets.map((w) => (
            <div key={w.asset} className="flex items-center justify-between py-2 border-b border-border-soft last:border-0">
              <div>
                <div className="text-sm font-medium">{w.asset}</div>
                <div className="text-[11px] text-text-faint">Locked: {w.locked.toFixed(2)}</div>
              </div>
              <div className="text-right">
                <div className="text-sm tnum">{w.free.toFixed(2)}</div>
              </div>
            </div>
          ))}
          {wallets.length === 0 && <div className="text-xs text-text-faint py-4 text-center">No wallets.</div>}
        </div>
        <div className={`grid gap-2 mt-4 ${depositUiEnabled ? "grid-cols-2" : "grid-cols-1"}`}>
          {depositUiEnabled ? (
            <button
              onClick={() => { setWalletMode("deposit"); setWalletOpen(true); }}
              className="h-9 rounded bg-up text-white text-xs font-semibold hover:brightness-110"
            >
              Deposit
            </button>
          ) : null}
          <button
            onClick={() => { setWalletMode("withdraw"); setWalletOpen(true); }}
            className="h-9 rounded bg-panel-2 border border-border text-text-muted text-xs font-medium hover:text-text hover:bg-panel-3"
          >
            Withdraw
          </button>
        </div>
      </div>

      <WalletModal
        open={walletOpen}
        mode={walletMode}
        depositEnabled={depositUiEnabled}
        disabledMethods={disabledPaymentMethods as ("CARD" | "BANK_TRANSFER" | "CRYPTO")[]}
        onClose={() => setWalletOpen(false)}
        onDone={() => router.refresh()}
      />
    </div>
  );
}

function Row({ label, value, valueClass = "" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-text-muted">{label}</dt>
      <dd className={`tnum ${valueClass}`}>{value}</dd>
    </div>
  );
}
function StatBig({ label, value, valueClass = "" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-xs text-text-muted">{label}</span>
      <span className={`text-lg font-semibold tnum ${valueClass}`}>{value}</span>
    </div>
  );
}
function StatSmall({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-text-faint">{label}</div>
      <div className="text-sm tnum">{value}</div>
    </div>
  );
}

function usd(v: number): string {
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " USD";
}
