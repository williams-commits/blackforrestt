"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { ACCOUNT_TAB_ICONS, TabIcon } from "@/components/ui/tabIcons";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useBrand } from "@/components/providers";
import { AccountReconciliationStatus, type ReconciliationStatus } from "./AccountReconciliationStatus";
import type { WalletAddressEntry } from "@/server/userSettings";

type Tab = "overview" | "positions" | "transactions" | "payments" | "reports" | "verification" | "notifications" | "messages" | "support" | "settings" | "referrals";
const ACCOUNT_TAB_STORAGE_KEY = "blckforest:account-tab";

interface Props {
  initialTab?: Tab;
  /** Equity/margin ratio that marks the margin warning (user settings → env default 125). */
  marginWarningPercent?: number;
  /** Unread badge counts (server-computed; refreshed with the 30s fallback poll). */
  unreadNotifications?: number;
  unreadMessages?: number;
  openSupportCases?: number;
  /** True for operator viewers — the Messages badge shows the team inbox. */
  operator?: boolean;
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

/** Grouped account navigation — the information architecture of the portal.
 *  Rendered as the desktop sidebar and (grouped) inside the mobile section
 *  sheet from one source of truth. */
const NAV_GROUPS: { label: string | null; items: Tab[] }[] = [
  { label: null, items: ["overview"] },
  { label: "Trading", items: ["positions", "reports"] },
  { label: "Money", items: ["transactions", "payments"] },
  { label: "Profile & Security", items: ["verification", "settings"] },
  { label: "Activity & Help", items: ["notifications", "messages", "support"] },
  { label: "Rewards", items: ["referrals"] },
];

/** Account portal shell: grouped navigation (sidebar on desktop, sheet on
 *  phones) over the tabbed sections. Tab selection, ?tab= deep links,
 *  localStorage restoration, Back/Forward, live badges and the realtime
 *  refresh behavior are unchanged from the previous tab-strip shell. */
export function AccountShell(props: Props) {
  const marginWarningPercent = props.marginWarningPercent ?? 125;
  // Badge counts start from the server render and stay LIVE: a lightweight
  // counts poll (+ realtime events) updates them without a full page refresh,
  // and pokes the mounted tab to reload its data when something changed.
  const operator = props.operator ?? false;
  const [unreadNotifications, setUnreadNotifications] = useState(props.unreadNotifications ?? 0);
  const [unreadMessages, setUnreadMessages] = useState(props.unreadMessages ?? 0);
  const [openSupportCases, setOpenSupportCases] = useState(props.openSupportCases ?? 0);
  const prevCounts = useRef({ unreadNotifications: props.unreadNotifications ?? 0, unreadMessages: props.unreadMessages ?? 0, openSupportCases: props.openSupportCases ?? 0 });
  const refreshCounts = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications?scope=counts", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json() as { unreadCount?: number; unreadMessages?: number; operatorMessages?: number; openSupportCases?: number };
      // One consistent meaning for the message badge per viewer type — the
      // operator inbox for staff, the customer thread otherwise. Mixing the
      // two made the change-detection below fire on phantom deltas.
      const next = {
        unreadNotifications: data.unreadCount ?? 0,
        unreadMessages: operator ? data.operatorMessages ?? data.unreadMessages ?? 0 : data.unreadMessages ?? 0,
        openSupportCases: data.openSupportCases ?? 0,
      };
      setUnreadNotifications(next.unreadNotifications);
      setUnreadMessages(next.unreadMessages);
      setOpenSupportCases(next.openSupportCases);
      const changed =
        next.unreadNotifications !== prevCounts.current.unreadNotifications ||
        next.unreadMessages !== prevCounts.current.unreadMessages ||
        next.openSupportCases !== prevCounts.current.openSupportCases;
      if (changed) {
        prevCounts.current = next;
        window.dispatchEvent(new CustomEvent("blckforest:counts-changed"));
      }
    } catch { /* transient — next poll retries */ }
  }, [operator]);
  useEffect(() => {
    const timer = window.setInterval(() => { if (!document.hidden) void refreshCounts(); }, 15_000);
    // Activity pushes CARRY the counts — apply them directly for a
    // spontaneous badge update; other realtime events trigger a re-count.
    const onRealtime = (event: Event) => {
      const message = (event as CustomEvent<ServerMessage>).detail;
      if (message?.type === "activity") {
        // Operators badge the team inbox; customers their own thread. Store
        // the DISPLAYED value so the poll's change detection compares like
        // with like.
        const displayedMessages = operator ? message.counts.operatorMessages : message.counts.messages;
        setUnreadNotifications(message.counts.notifications);
        setUnreadMessages(displayedMessages);
        setOpenSupportCases(message.counts.supportCases);
        prevCounts.current = {
          unreadNotifications: message.counts.notifications,
          unreadMessages: displayedMessages,
          openSupportCases: message.counts.supportCases,
        };
        window.dispatchEvent(new CustomEvent("blckforest:counts-changed"));
      } else {
        void refreshCounts();
      }
    };
    window.addEventListener("blckforest:realtime", onRealtime);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("blckforest:realtime", onRealtime);
    };
  }, [refreshCounts, operator]);
  const [tab, setTab] = useState<Tab>("overview");
  const [navOpen, setNavOpen] = useState(false);
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

  // Live badge per section — icons first, badges after, one map reused by the
  // desktop sidebar and the mobile sheet.
  const badgeFor = (key: Tab): React.ReactNode => {
    if (key === "positions" && openPositionCount > 0) {
      return <Badge variant="secondary" className="ml-auto bg-panel-3 px-1.5 font-bold text-text-muted">{openPositionCount}</Badge>;
    }
    if (key === "verification" && verificationNeeded) {
      return <Badge className="ml-auto px-1.5 font-bold">!</Badge>;
    }
    if (key === "notifications" && unreadNotifications > 0) {
      return <Badge className="ml-auto px-1.5 font-bold">{unreadNotifications > 99 ? "99+" : unreadNotifications}</Badge>;
    }
    if (key === "messages" && unreadMessages > 0) {
      return <Badge className="ml-auto px-1.5 font-bold">{unreadMessages > 99 ? "99+" : unreadMessages}</Badge>;
    }
    if (key === "support" && openSupportCases > 0) {
      return <Badge variant="secondary" className="ml-auto bg-panel-3 px-1.5 font-bold text-text-muted">{openSupportCases}</Badge>;
    }
    return null;
  };

  const activeTabLabel = TABS.find((item) => item.key === tab)?.label ?? "Account";

  // Keep the browser title in sync with the active tab (clicks, Back/Forward,
  // localStorage restore). Mirrors the server's generateMetadata format:
  // "<Tab> — Account — <brand>", with overview keeping the plain account title.
  const brand = useBrand();
  useEffect(() => {
    const label = tab !== "overview" ? TABS.find((item) => item.key === tab)?.label : null;
    document.title = label ? `${label} — Account — ${brand.name}` : `Account — ${brand.name}`;
  }, [tab, brand.name]);

  const navSection = (onSelect: (key: Tab) => void) => (
    <nav aria-label="Account sections">
      {NAV_GROUPS.map((group) => (
        <div key={group.label ?? "root"} className="mb-1 last:mb-0">
          {group.label && (
            <div className="px-3 pt-3 pb-1 text-(length:--term-text-2xs) font-semibold uppercase tracking-wide text-text-faint first:pt-0">
              {group.label}
            </div>
          )}
          <ul>
            {group.items.map((key) => {
              const item = TABS.find((t) => t.key === key)!;
              const icon = ACCOUNT_TAB_ICONS[key];
              const active = tab === key;
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => onSelect(key)}
                    aria-current={active ? "true" : undefined}
                    className={`group flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-all duration-150 focus-visible:outline-2 focus-visible:outline-brand ${
                      active ? "bg-brand-soft font-semibold text-text" : "text-text-muted hover:bg-panel-2 hover:text-text hover:translate-x-0.5"
                    }`}
                  >
                    {icon ? <TabIcon icon={icon} /> : null}
                    <span className="min-w-0 truncate">{item.label}</span>
                    {badgeFor(key)}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)]">
      {/* Desktop sidebar — grouped account navigation */}
      <aside className="hidden lg:block">
        <div className="sticky top-20 rounded-lg border border-border bg-canvas p-2">
          {navSection(selectTab)}
        </div>
      </aside>

      {/* Content column */}
      <div className="min-w-0">
        {/* Mobile section bar (<lg): current section + grouped sheet selector */}
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          aria-haspopup="dialog"
          className="mb-4 flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-canvas px-4 py-3 text-left transition-colors hover:bg-panel-2 focus-visible:outline-2 focus-visible:outline-brand lg:hidden"
        >
          <span className="flex min-w-0 items-center gap-2">
            <LayoutGrid size={16} strokeWidth={2} aria-hidden className="shrink-0 text-text-muted" />
            <span className="truncate text-sm font-semibold">{activeTabLabel}</span>
            {badgeFor(tab)}
          </span>
          <span className="shrink-0 text-(length:--term-text-xs) font-medium text-brand">All sections</span>
        </button>

        {/* Page heading + contextual action */}
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-semibold leading-tight sm:text-2xl">My Account</h1>
            <p className="mt-0.5 text-sm text-text-muted">Manage your trading account, funds and profile.</p>
          </div>
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
            <p className="text-(length:--term-text-xs) text-text-muted">
              Account integrity verified — balances, positions, and payments reconciled.
            </p>
          </div>
        )}

        <div role="tabpanel" aria-label={activeTabLabel}>

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
        {tab === "notifications" && <NotificationsTab onActivity={refreshCounts} onOpenMessages={() => selectTab("messages")} />}
        {tab === "messages" && <MessagesTab />}
        {tab === "support" && <SupportTab />}
        {tab === "referrals" && <ReferralTab />}
        {tab === "settings" && <SettingsTab user={props.user} />}
        </div>
      </div>

      {/* Mobile grouped-section sheet */}
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-80 gap-0 overflow-y-auto p-0 sm:max-w-none">
          <SheetHeader className="border-b border-border-soft pb-3 pt-4">
            <SheetTitle>Account sections</SheetTitle>
            <SheetDescription>Jump to any part of your account.</SheetDescription>
          </SheetHeader>
          <div className="p-2">
            {navSection((key) => {
              setNavOpen(false);
              selectTab(key);
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
