"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountOverview } from "./AccountOverview";
import { PositionHistory } from "./PositionHistory";
import { TransactionsTab } from "./TransactionsTab";
import { VerificationTab } from "./VerificationTab";
import { NotificationsTab } from "./NotificationsTab";
import { MessagesTab } from "./MessagesTab";
import { SettingsTab } from "./SettingsTab";
import { ReportsView } from "./ReportsView";
import { PaymentTimeline } from "./PaymentTimeline";
import { SupportTab } from "./SupportTab";
import { ReferralTab } from "./ReferralTab";
import type { InstrumentView, PositionView } from "@/lib/types";
import { useForexStore } from "@/lib/store";
import type { ServerMessage } from "@/lib/ws/client";
import { Tabs } from "@/components/ui/Tabs";
import { ScrollFade } from "@/components/ui/ScrollFade";
import { AccountReconciliationStatus, type ReconciliationStatus } from "./AccountReconciliationStatus";
import type { WalletAddressEntry } from "@/server/userSettings";

type Tab = "overview" | "positions" | "transactions" | "payments" | "reports" | "verification" | "notifications" | "messages" | "support" | "settings" | "referrals";
const ACCOUNT_TAB_STORAGE_KEY = "blckforest:account-tab";

interface Props {
  initialTab?: Tab;
  /** Equity/margin ratio that marks the margin warning (user settings → env default 125). */
  marginWarningPercent?: number;
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
  walletAddresses?: WalletAddressEntry[];
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
  { key: "notifications", label: "Notifications" },
  { key: "messages", label: "Messages" },
  { key: "support", label: "Support" },
  { key: "referrals", label: "Referrals" },
  { key: "settings", label: "Settings" },
];

/** Tabbed account dashboard shell. */
export function AccountShell(props: Props) {
  const marginWarningPercent = props.marginWarningPercent ?? 125;
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

  // Browser Back/Forward move between tabs (URL is kept in sync below).
  useEffect(() => {
    const onPopState = () => {
      const param = new URLSearchParams(window.location.search).get("tab");
      if (param && TABS.some((item) => item.key === param)) setTab(param as Tab);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function selectTab(next: Tab): void {
    setTab(next);
    window.localStorage.setItem(ACCOUNT_TAB_STORAGE_KEY, next);
    // Keep ?tab= in the URL so deep links, refresh, and Back/Forward work.
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.pushState(null, "", url);
  }

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const handleRealtime = (event: Event) => {
      const message = (event as CustomEvent<ServerMessage>).detail;
      // Ledger pushes (payment approved/rejected/reversed/cancelled, admin
      // adjustments) change server-rendered data — wallets, transactions,
      // payment status — so re-fetch the page. Tick-loop account pushes only
      // affect metrics, which the realtime store already renders.
      const ledgerChanged = message?.type === "account" && message.reason === "ledger";
      const positionClosed = message?.type === "position" && message.position.status === "CLOSED";
      if (ledgerChanged || positionClosed) {
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
  // Skipped while the tab is hidden to avoid pointless background churn.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) router.refresh();
    }, 30_000);
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

  const openPositionCount = positions.filter((position) => position.status === "OPEN").length;
  const verificationNeeded = props.kyc && props.kyc.status !== "APPROVED";
  // Reconciliation is only surfaced as a full panel when something needs the
  // user's attention; a healthy account shows a slim status chip instead.
  const reconAttention =
    props.reconciliation.activeBlocks.length > 0 ||
    props.reconciliation.openCaseCount > 0 ||
    props.reconciliation.paymentMismatchCount > 0 ||
    props.reconciliation.lastRun?.status === "FAILED";

  const tabsWithBadges = TABS.map((item) => {
    if (item.key === "positions" && openPositionCount > 0) {
      return { ...item, label: <>{item.label}<span className="ml-1.5 rounded-full bg-panel-3 px-1.5 py-0.5 text-[9px] font-bold text-text-muted">{openPositionCount}</span></> };
    }
    if (item.key === "verification" && verificationNeeded) {
      return { ...item, label: <>{item.label}<span className="ml-1.5 rounded-full bg-brand px-1.5 py-0.5 text-[9px] font-bold text-white">!</span></> };
    }
    return item;
  });
  const activeTabLabel = TABS.find((item) => item.key === tab)?.label ?? "Account";

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-lg font-semibold">My Account</h1>
        {verificationNeeded && (
          <button
            onClick={() => selectTab("verification")}
            className="rounded border border-brand/30 bg-brand-soft px-3 py-1.5 text-xs font-medium text-brand transition hover:brightness-95"
          >
            Complete verification
          </button>
        )}
      </div>

      {reconAttention ? (
        <AccountReconciliationStatus status={props.reconciliation} />
      ) : (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-up/25 bg-up/5 px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-up" aria-hidden />
          <p className="text-[11px] text-text-muted">
            Account integrity verified — balances, positions, and payments reconciled.
          </p>
        </div>
      )}

      <ScrollFade className="mb-5">
        <Tabs
          tabs={tabsWithBadges}
          active={tab}
          onChange={(key) => selectTab(key as Tab)}
          label="Account sections"
        />
      </ScrollFade>

      <div role="tabpanel" aria-label={typeof activeTabLabel === "string" ? activeTabLabel : tab}>

      {tab === "overview" && (
        <AccountOverview
          user={{ ...props.user, createdAt: new Date(props.user.createdAt) }}
          metrics={metrics}
          wallets={props.wallets}
          openCount={positions.filter((position) => position.status === "OPEN").length}
          depositUiEnabled={props.depositUiEnabled}
          disabledPaymentMethods={props.disabledPaymentMethods}
          walletAddresses={props.walletAddresses}
          kyc={props.kyc ? { status: props.kyc.status, note: props.kyc.note } : null}
          onOpenVerification={() => selectTab("verification")}
          marginWarningPercent={marginWarningPercent}
        />
      )}
      {tab === "positions" && (
        <PositionHistory
          open={positions.filter((p) => p.status === "OPEN").map((p) => ({ ...p, openedAt: new Date(p.openedAt), closedAt: p.closedAt ? new Date(p.closedAt) : null }))}
          closed={positions.filter((p) => p.status === "CLOSED").map((p) => ({ ...p, openedAt: new Date(p.openedAt), closedAt: p.closedAt ? new Date(p.closedAt) : null }))}
          instruments={props.instruments}
          fetchCap={100}
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
      {tab === "notifications" && <NotificationsTab />}
      {tab === "messages" && <MessagesTab />}
      {tab === "support" && <SupportTab />}
      {tab === "referrals" && <ReferralTab />}
      {tab === "settings" && <SettingsTab user={props.user} />}
      </div>
    </div>
  );
}
