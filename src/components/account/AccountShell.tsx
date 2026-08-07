"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountOverview } from "./AccountOverview";
import { PositionHistory } from "./PositionHistory";
import { TransactionsTab } from "./TransactionsTab";
import { VerificationTab } from "./VerificationTab";
import { SettingsTab } from "./SettingsTab";
import { ReportsView } from "./ReportsView";
import { PaymentTimeline } from "./PaymentTimeline";
import { SupportTab } from "./SupportTab";
import type { InstrumentView, PositionView } from "@/lib/types";
import { useForexStore } from "@/lib/store";
import type { ServerMessage } from "@/lib/ws/client";
import { Tabs } from "@/components/ui/Tabs";
import { AccountReconciliationStatus, type ReconciliationStatus } from "./AccountReconciliationStatus";

type Tab = "overview" | "positions" | "transactions" | "payments" | "reports" | "verification" | "settings" | "support";
const ACCOUNT_TAB_STORAGE_KEY = "blckforest:account-tab";

interface Props {
  initialTab?: Tab;
  user: { id: string; name: string; email: string; accountNo: string; createdAt: string; verified: boolean };
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
  positions: {
    id: string;
    symbol: string;
    type: "CFD" | "STRIKE";
    side: "BUY" | "SELL";
    volume: number;
    openRate: number;
    strikeRate: number | null;
    currentRate: number;
    netProfit: number;
    swap: number;
    commission: number;
    tradingCommission: number;
    status: "OPEN" | "CLOSED";
    openedAt: string;
    closedAt: string | null;
  }[];
  transactions: {
    id: string;
    type: "DEPOSIT" | "WITHDRAW" | "BONUS" | "ADJUSTMENT" | "COMMISSION" | "SWAP" | "TRADE_PNL" | "FEE" | "REVERSAL" | "NEGATIVE_BALANCE_PROTECTION";
    status: "PENDING" | "COMPLETED" | "REJECTED" | "CANCELLED" | "REVERSED";
    amount: number;
    asset: string;
    description: string | null;
    reference: string | null;
    createdAt: string;
  }[];
  kyc: {
    status: "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED";
    firstName: string | null;
    lastName: string | null;
    docType: string | null;
    note: string | null;
    submittedAt: string | null;
    reviewedAt: string | null;
  } | null;
  instruments: Record<string, InstrumentView>;
  reconciliation: ReconciliationStatus;
  depositUiEnabled: boolean;
  disabledPaymentMethods?: string[];
  kycChecklist: {
    cleanDocuments: number;
    cleanIdentityDocuments: number;
    cleanAddressDocuments: number;
    pendingDocuments: number;
    blockedDocuments: number;
  };
}

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "positions", label: "Positions" },
  { key: "transactions", label: "Transactions" },
  { key: "payments", label: "Payments" },
  { key: "reports", label: "Reports" },
  { key: "verification", label: "Verification" },
  { key: "support", label: "Support" },
  { key: "settings", label: "Settings" },
];

/** Tabbed account dashboard shell. */
export function AccountShell(props: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const router = useRouter();
  const realtimeAccount = useForexStore((state) => state.account);
  const realtimePositions = useForexStore((state) => state.positions);

  useEffect(() => {
    // An explicit ?tab= from the URL takes precedence (e.g. the header dropdown's
    // "Settings" link), otherwise fall back to the last-visited tab in localStorage.
    if (props.initialTab && TABS.some((item) => item.key === props.initialTab)) {
      setTab(props.initialTab);
      window.localStorage.setItem(ACCOUNT_TAB_STORAGE_KEY, props.initialTab);
      return;
    }
    const stored = window.localStorage.getItem(ACCOUNT_TAB_STORAGE_KEY);
    if (stored && TABS.some((item) => item.key === stored)) setTab(stored as Tab);
  }, [props.initialTab]);

  function selectTab(next: Tab): void {
    setTab(next);
    window.localStorage.setItem(ACCOUNT_TAB_STORAGE_KEY, next);
  }

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const handleRealtime = (event: Event) => {
      const message = (event as CustomEvent<ServerMessage>).detail;
      if (message?.type === "position" && message.position.status === "CLOSED") {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => router.refresh(), 250);
      }
    };
    window.addEventListener("blckforest:realtime", handleRealtime);
    return () => {
      window.removeEventListener("blckforest:realtime", handleRealtime);
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [router]);

  // Periodic fallback refresh so the page stays in sync with DB changes that
  // don't arrive over the WebSocket (admin actions, payment/KYC status updates).
  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [router]);

  const metrics = realtimeAccount ?? props.metrics;
  const liveOpenPositions = useMemo(() =>
    realtimePositions.map((position: PositionView) => ({
      id: position.id,
      symbol: position.symbol,
      type: position.type,
      side: position.side,
      volume: position.volume,
      openRate: position.openRate,
      strikeRate: position.strikeRate,
      currentRate: position.currentRate,
      netProfit: position.netProfit,
      swap: position.swap,
      commission: position.commission,
      tradingCommission: position.tradingCommission,
      status: position.status,
      openedAt: new Date(position.openedAt).toISOString(),
      closedAt: null,
    })), [realtimePositions]);
  const positions = realtimeAccount
    ? [...liveOpenPositions, ...props.positions.filter((position) => position.status === "CLOSED")]
    : props.positions;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-lg font-semibold">My Account</h1>
        {props.kyc && props.kyc.status !== "APPROVED" && (
          <button
            onClick={() => selectTab("verification")}
            className="text-xs px-3 py-1.5 rounded bg-brand-soft text-brand hover:brightness-95"
          >
            ⚠ Complete verification
          </button>
        )}
      </div>

      <AccountReconciliationStatus status={props.reconciliation} />

      <Tabs
        tabs={TABS}
        active={tab}
        onChange={(key) => selectTab(key as Tab)}
        label="Account sections"
        className="mb-5 overflow-x-auto"
      />

      {tab === "overview" && (
        <AccountOverview
          user={{ ...props.user, createdAt: new Date(props.user.createdAt) }}
          metrics={metrics}
          wallets={props.wallets}
          openCount={positions.filter((position) => position.status === "OPEN").length}
          depositUiEnabled={props.depositUiEnabled}
          disabledPaymentMethods={props.disabledPaymentMethods}
        />
      )}
      {tab === "positions" && (
        <PositionHistory
          open={positions.filter((p) => p.status === "OPEN").map((p) => ({ ...p, openedAt: new Date(p.openedAt), closedAt: p.closedAt ? new Date(p.closedAt) : null }))}
          closed={positions.filter((p) => p.status === "CLOSED").map((p) => ({ ...p, openedAt: new Date(p.openedAt), closedAt: p.closedAt ? new Date(p.closedAt) : null }))}
          instruments={props.instruments}
        />
      )}
      {tab === "transactions" && <TransactionsTab transactions={props.transactions} />}
      {tab === "payments" && <PaymentTimeline />}
      {tab === "reports" && (
        <ReportsView
          rows={positions
            .filter((p) => p.status === "CLOSED")
            .map((p) => ({
              id: p.id,
              symbol: p.symbol,
              type: p.type,
              side: p.side,
              volume: p.volume,
              netProfit: p.netProfit,
              swap: p.swap,
              commission: p.commission + p.tradingCommission,
              openedAt: p.openedAt,
              closedAt: p.closedAt ?? p.openedAt,
            }))}
        />
      )}
      {tab === "verification" && <VerificationTab kyc={props.kyc} checklist={props.kycChecklist} onSubmitted={() => selectTab("overview")} />}
      {tab === "support" && <SupportTab />}
      {tab === "settings" && <SettingsTab user={props.user} />}
    </div>
  );
}
