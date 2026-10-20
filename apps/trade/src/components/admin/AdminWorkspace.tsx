"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useId } from "react";
import { KycReview } from "./KycReview";
import { PaymentsReview, type PaymentRequestRow } from "./PaymentsReview";
import { ReconciliationReview } from "./ReconciliationReview";
import { AdminUserActions } from "./AdminUserActions";
import { AdminMessages } from "./AdminMessages";
import { GroupsPanel } from "./GroupsPanel";
import { SettingsForm, type UserSettingsConfig } from "./SettingsForm";
import { Button } from "@/components/ui/Button";
import { SimpleDialog, SimpleDialog as Dialog } from "@/components/ui/Dialog";
import { useCommandDialog } from "@/components/ui/useCommandDialog";
import { ScrollFade } from "@/components/ui/ScrollFade";
import { Skeleton } from "@/components/ui/Skeleton";

import { ADMIN_TAB_ICONS, TabIcon, type LucideIcon } from "@/components/ui/tabIcons";
import { CandlestickChart, ClipboardCheck, CreditCard, IdCard, RefreshCw, RotateCcw, Scale, ShieldCheck, TriangleAlert, Users, Wallet, X } from "lucide-react";
import { CsvExportButton } from "@/components/ui/CsvExport";
import { createDeviceId } from "@/lib/device";
import { fmtAgo, fmtDateTime } from "@/lib/dates";
import { toast } from "@/lib/toast";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/checkbox";
import { IdentityTile, initialsOf } from "@/components/ui/Initial";

import type { ManagedUserRow } from "@/components/admin/AdminUserActions";
import { StatCard } from "@/components/ui/StatCard";
import { RecordList, RecordStatusChip } from "@/components/ui/RecordList";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/badge";
import { ArrowDownToLine, ArrowLeftRight, Ban, Braces, CheckCircle2, Coins, DollarSign, Download, FileText, LifeBuoy, Percent, ScrollText, ShieldAlert, SlidersHorizontal, Tag, TrendingDown, TrendingUp, UserRound } from "lucide-react";
import { InstrumentIcon } from "@/components/icons/InstrumentIcon";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/Textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Permission = string;
type TabKey =
  | "overview"
  | "users"
  | "kyc"
  | "payments"
  | "ledger"
  | "executions"
  | "reconciliation"
  | "support"
  | "messages"
  | "instruments"
  | "risk"
  | "audit"
  | "health"
  | "changes"
  | "groups";

interface Props {
  userName: string;
  roles: string[];
  permissions: Permission[];
  simpleApproval?: boolean;
}

interface Resource<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: (options?: { silent?: boolean }) => Promise<void>;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const body = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) throw new Error(body.error ?? `Request failed with status ${response.status}.`);
  return body;
}

function useResource<T>(url: string, pollMs?: number): Resource<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Stale-while-revalidate: when the URL changes (search queries), keep the
  // previous data on screen while fetching — only the very first load of a
  // module shows the skeleton. Without this, every keystroke flashes the
  // whole table into a loading state.
  const hasDataRef = useRef(false);
  // Debounced searches fire overlapping requests; without a sequence guard a
  // slow response for the OLD query lands last and overwrites the fresh one.
  const requestSeqRef = useRef(0);
  const refresh = useCallback(async (options: { silent?: boolean } = {}) => {
    const requestSeq = ++requestSeqRef.current;
    if (!options.silent && !hasDataRef.current) setLoading(true);
    setError(null);
    try {
      const result = await requestJson<T>(url);
      if (requestSeqRef.current !== requestSeq) return; // superseded by a newer request
      hasDataRef.current = true;
      setData(result);
    } catch (cause) {
      if (requestSeqRef.current !== requestSeq) return;
      setError(cause instanceof Error ? cause.message : "Unable to load module.");
    } finally {
      if (requestSeqRef.current === requestSeq) setLoading(false);
    }
  }, [url]);
  useEffect(() => { void refresh(); }, [refresh]);
  // Optional silent polling so the panel stays in sync with the database.
  // Paused while the tab is hidden so background admin tabs stop loading the
  // API (the visibility listener catches up on return).
  useEffect(() => {
    if (!pollMs) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh({ silent: true });
    }, pollMs);
    const onVisible = () => {
      if (!document.hidden) void refresh({ silent: true });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, pollMs]);
  return { data, loading, error, refresh };
}

const TAB_DEFINITIONS: Array<{ key: TabKey; label: string; permission: Permission }> = [
  { key: "overview", label: "Overview", permission: "ADMIN_DASHBOARD" },
  { key: "users", label: "Users", permission: "USER_READ" },
  { key: "groups", label: "Groups", permission: "USER_READ" },
  { key: "kyc", label: "KYC", permission: "KYC_READ" },
  { key: "payments", label: "Payments", permission: "PAYMENT_READ" },
  { key: "ledger", label: "Ledger", permission: "LEDGER_READ" },
  { key: "executions", label: "Executions", permission: "EXECUTION_READ" },
  { key: "reconciliation", label: "Reconciliation", permission: "RECONCILIATION_READ" },
  { key: "support", label: "Support", permission: "SUPPORT_READ" },
  { key: "messages", label: "Messages", permission: "SUPPORT_READ" },
  { key: "instruments", label: "Instruments", permission: "INSTRUMENT_READ" },
  { key: "risk", label: "Risk", permission: "RISK_READ" },
  { key: "audit", label: "Audit", permission: "AUDIT_READ" },
  { key: "health", label: "Service health", permission: "SERVICE_HEALTH_READ" },
  { key: "changes", label: "Approvals", permission: "CHANGE_REQUEST_READ" },
];

/** Sidebar grouping — mirrors how an operations team thinks about the console. */
const NAV_SECTIONS: Array<{ label: string; tabs: TabKey[] }> = [
  { label: "Operations", tabs: ["overview", "users", "groups"] },
  { label: "Finance", tabs: ["kyc", "payments", "ledger", "executions", "reconciliation"] },
  { label: "Risk & Compliance", tabs: ["risk", "audit", "changes"] },
  { label: "Platform", tabs: ["support", "messages", "instruments", "health"] },
];

const ADMIN_TAB_STORAGE_KEY = "blckforest:admin-tab";

interface BadgeStats {
  stats?: { pendingKyc?: number; pendingPayments?: number; pendingChanges?: number };
}

export function AdminWorkspace({ userName, roles, permissions, simpleApproval = false }: Props) {
  const allowedTabs = useMemo(
    () => TAB_DEFINITIONS.filter((tab) => permissions.includes(tab.permission)),
    [permissions],
  );
  const allowedKeys = useMemo(() => new Set(allowedTabs.map((t) => t.key)), [allowedTabs]);
  const [tab, setTabState] = useState<TabKey>(allowedTabs[0]?.key ?? "overview");
  const [chatWith, setChatWith] = useState<{ userId: string; label: string } | null>(null);
  // Role change prefill from the Users tab — opens the Approvals composer
  // with the target already selected (admin creation via UI, maker-checker).
  const [roleChangeFor, setRoleChangeFor] = useState<{ userId: string; label: string; action: "ASSIGN_ROLE" | "REVOKE_ROLE" } | null>(null);

  // Restore tab: ?tab= in the URL wins, then the last-visited tab, then default.
  // Runs once — the permission-gated key set is read from the ref, not deps.
  const allowedKeysRef = useRef(allowedKeys);
  allowedKeysRef.current = allowedKeys;
  useEffect(() => {
    const urlTab = new URLSearchParams(window.location.search).get("tab") as TabKey | null;
    if (urlTab && allowedKeysRef.current.has(urlTab)) {
      setTabState(urlTab);
      return;
    }
    const stored = window.localStorage.getItem(ADMIN_TAB_STORAGE_KEY);
    if (stored && allowedKeysRef.current.has(stored as TabKey)) {
      setTabState(stored as TabKey);
    }
  }, []);

  // Browser Back/Forward move between tabs (URL kept in sync below).
  useEffect(() => {
    const onPopState = () => {
      const param = new URLSearchParams(window.location.search).get("tab") as TabKey | null;
      if (param && allowedKeysRef.current.has(param)) setTabState(param);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const setTab = useCallback((next: TabKey) => {
    setTabState(next);
    window.localStorage.setItem(ADMIN_TAB_STORAGE_KEY, next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.pushState(null, "", url);
  }, []);

  // Lightweight queue counts for the sidebar badges. Skips polling while hidden.
  const badges = useResource<BadgeStats>("/api/admin/overview", 20_000);
  // Support-inbox unread count — updated INSTANTLY by activity pushes (a
  // customer message just landed) with a 20s poll as the fallback.
  const [messagesUnread, setMessagesUnread] = useState(0);
  const [supportOpen, setSupportOpen] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [messages, support] = await Promise.all([
          fetch("/api/admin/messages?summary=1", { cache: "no-store" }),
          fetch("/api/admin/support?limit=1", { cache: "no-store" }),
        ]);
        if (!messages.ok || !support.ok) return;
        const messagesData = await messages.json() as { totalUnread?: number };
        const supportData = await support.json() as { openCount?: number };
        if (!cancelled) {
          setMessagesUnread(messagesData.totalUnread ?? 0);
          setSupportOpen(supportData.openCount ?? 0);
        }
      } catch { /* transient — next poll retries */ }
    };
    void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 20_000);
    const onRealtime = (event: Event) => {
      const message = (event as CustomEvent<{ type?: string; counts?: { operatorMessages?: number } }>).detail;
      if (message?.type === "activity" && typeof message.counts?.operatorMessages === "number") {
        setMessagesUnread(message.counts.operatorMessages);
      } else {
        void load();
      }
    };
    window.addEventListener("blckforest:realtime", onRealtime);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("blckforest:realtime", onRealtime);
    };
  }, []);
  const badgeFor = (key: TabKey): number | null => {
    const stats = badges.data?.stats;
    if (!stats) return null;
    if (key === "kyc" && stats.pendingKyc) return stats.pendingKyc;
    if (key === "payments" && stats.pendingPayments) return stats.pendingPayments;
    if (key === "changes" && stats.pendingChanges) return stats.pendingChanges;
    if (key === "messages" && messagesUnread > 0) return messagesUnread;
    if (key === "support" && supportOpen > 0) return supportOpen;
    return null;
  };

  const can = useCallback((permission: Permission) => permissions.includes(permission), [permissions]);

  const tabButton = (item: { key: TabKey; label: string }, sidebar: boolean) => {
    const active = tab === item.key;
    const badge = badgeFor(item.key);
    const tabIcon = ADMIN_TAB_ICONS[item.key];
    return (
      <button
        key={item.key}
        type="button"
        onClick={() => setTab(item.key)}
        aria-current={active ? "page" : undefined}
        className={`flex items-center gap-2 whitespace-nowrap text-xs font-medium transition ${
          sidebar
            ? `w-full rounded-md px-3 py-2 text-left ${active ? "bg-(--term-warning-bg) text-(--term-warning-fg)" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"}`
            : `border-b-2 px-3 py-2.5 ${active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`
        }`}
      >
        {tabIcon && <TabIcon icon={tabIcon} />}
        <span>{item.label}</span>
        {badge != null && badge > 0 && (
          <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${active ? "bg-primary text-primary-foreground" : "bg-(--term-warning-bg) text-(--term-warning-fg)"}`}>
            {badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-5">
      <section className="p-4 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Enterprise operations console</h1>
            <p className="mt-1 text-xs text-muted-foreground">Signed in as {userName}. Every command is role-gated and audit chained.</p>
          </div>
          <div className="flex flex-wrap justify-end gap-1.5" aria-label="Active administrative roles">
            {roles.map((role) => <span key={role} className="rounded bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">{role.replaceAll("_", " ")}</span>)}
          </div>
        </div>
      </section>

      <div className="lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-5">
        {/* Desktop: grouped vertical sidebar. Mobile/tablet: horizontal pills. */}
        <nav aria-label="Administrative modules" className="hidden lg:block">
          <div className="sticky top-20 space-y-4 p-3">
            {NAV_SECTIONS.map((section) => {
              const items = allowedTabs.filter((t) => section.tabs.includes(t.key));
              if (items.length === 0) return null;
              return (
                <div key={section.label}>
                  <p className="mb-1 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">{section.label}</p>
                  <div className="space-y-0.5">
                    {items.map((item) => tabButton(item, true))}
                  </div>
                </div>
              );
            })}
          </div>
        </nav>
        <ScrollFade className="mb-4 lg:hidden">
          <nav aria-label="Administrative modules" className="flex gap-1 pb-1">
            {allowedTabs.map((item) => tabButton(item, false))}
          </nav>
        </ScrollFade>

        <div className="min-w-0 space-y-5">

      {tab === "overview" && <OverviewPanel />}
      {tab === "users" && <UsersPanel canAdjustBalance={can("USER_BALANCE_ADJUST")} canManage={can("USER_ACCESS_MANAGE")} onOpenChat={(user) => { setChatWith({ userId: user.id, label: user.name ?? user.email ?? user.id }); setTab("messages"); }} onProposeRole={can("USER_ACCESS_MANAGE") ? (user, action) => { setRoleChangeFor({ userId: user.id, label: user.name ?? user.email ?? user.id, action }); setTab("changes"); } : undefined} />}
      {tab === "groups" && <GroupsPanel canManage={can("USER_ACCESS_MANAGE")} />}
      {tab === "kyc" && <KycPanel canDecide={can("KYC_DECIDE")} canAccess={can("KYC_DOCUMENT_ACCESS")} />}
      {tab === "payments" && <PaymentsPanel canPrepare={can("PAYMENT_PREPARE")} canApprove={can("PAYMENT_APPROVE")} simpleApproval={simpleApproval} />}
      {tab === "ledger" && <LedgerPanel />}
      {tab === "executions" && <ExecutionsPanel canManage={can("EXECUTION_MANAGE")} />}
      {tab === "reconciliation" && <ReconciliationReview canManage={can("RECONCILIATION_MANAGE")} />}
      {tab === "messages" && <AdminMessages chatWith={chatWith} onChatHandled={() => setChatWith(null)} />}
      {tab === "support" && <SupportPanel canManage={can("SUPPORT_MANAGE")} />}
      {tab === "instruments" && <InstrumentsPanel canManage={can("INSTRUMENT_MANAGE")} />}
      {tab === "risk" && <RiskPanel canManage={can("RISK_MANAGE")} />}
      {tab === "audit" && <AuditPanel canVerify={can("AUDIT_VERIFY")} canExport={can("AUDIT_EXPORT")} />}
      {tab === "health" && <HealthPanel />}
      {tab === "changes" && (
        <ChangesPanel
          prefill={roleChangeFor}
          onPrefillHandled={() => setRoleChangeFor(null)}
          canProposeAccess={can("USER_ACCESS_MANAGE")}
          canProposeRisk={can("RISK_MANAGE")}
          canProposeInstrument={can("INSTRUMENT_MANAGE")}
        />
      )}
        </div>
      </div>
    </div>
  );
}

function ModuleState({ loading, error, onRetry, children }: { loading: boolean; error: string | null; onRetry: () => void; children: React.ReactNode }) {
  if (loading) {
    // Table-shaped shimmer instead of a text line — no layout jank on refresh.
    return (
      <div role="status" aria-label="Loading module" className="space-y-3 p-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-3 w-72" />
        <div className="space-y-2 pt-2">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
        </div>
      </div>
    );
  }
  if (error) return <Alert tone="err" className="flex flex-wrap items-center gap-2 p-4 text-sm"><TriangleAlert size={16} strokeWidth={1.75} aria-hidden />{error}<Button type="button" size="sm" variant="outline" onClick={onRetry} className="ml-auto flex items-center gap-1.5"><RotateCcw size={12} strokeWidth={1.75} aria-hidden />Retry</Button></Alert>;
  return <>{children}</>;
}

export function SectionHeader({ title, description, onRefresh, action }: { title: string; description: string; onRefresh?: () => void; action?: React.ReactNode }) {
  return <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold tracking-tight">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div><div className="flex shrink-0 items-center gap-2">{action}{onRefresh && <Button type="button" size="sm" variant="outline" onClick={onRefresh}><RefreshCw size={13} strokeWidth={2} aria-hidden />Refresh</Button>}</div></div>;
}

/** Icons for the overview stat grid — inferred from the stat key. */
const OVERVIEW_STAT_ICONS: Record<string, LucideIcon> = {
  users: Users,
  onlineUsers: Users,
  openPositions: CandlestickChart,
  pendingKyc: IdCard,
  pendingPayments: CreditCard,
  pendingChanges: ClipboardCheck,
  totalBalance: Wallet,
  totalEquity: Scale,
};

interface OverviewResponse {
  environment: { simulationOnly: boolean; executionProvider: string; marketDataMode: string };
  stats: Record<string, number>;
}
function OverviewPanel() {
  const resource = useResource<OverviewResponse>("/api/admin/overview", 15_000);
  return <ModuleState loading={resource.loading} error={resource.error} onRetry={() => void resource.refresh()}>{resource.data && <div className="space-y-4"><Alert tone="info"><strong>Environment.</strong> Execution provider: {resource.data.environment.executionProvider}; market data: {resource.data.environment.marketDataMode}.</Alert><div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{Object.entries(resource.data.stats).map(([key, value]) => {
              const StatGlyph = OVERVIEW_STAT_ICONS[key];
              return <StatCard key={key} label={key.replaceAll(/([A-Z])/g, " $1")} value={value.toLocaleString("en-US")} icon={StatGlyph ? <StatGlyph size={16} strokeWidth={1.75} aria-hidden /> : undefined} />;
            })}</div></div>}</ModuleState>;
}

interface UserRow {
  id: string; email: string | null; name: string | null; accountNo: string | null; verified: boolean;
  /** Brand family the user signed up under (null = primary/legacy). */
  brandDomain: string | null;
  lockedUntil: string | null; mfaEnabledAt: string | null; createdAt: string;
  isAdmin: boolean; suspendedAt: string | null; blockedAt: string | null; deletedAt: string | null;
  /** Live presence — user has an open WebSocket right now. */
  online: boolean;
  lastActiveAt: string | null;
  kyc: { status: string; country: string | null; city: string | null } | null;
  adminRoles: Array<{ role: string }>;
  metrics: { balance: string; equity: string; floatingPl: string; marginLevel: string | null } | null;
  _count: { positions: number; securitySessions: number; reconciliationBlocks: number };
}
function UsersPanel({ canAdjustBalance, canManage, onOpenChat, onProposeRole }: { canAdjustBalance: boolean; canManage: boolean; onOpenChat: (user: UserRow) => void; onProposeRole?: (user: UserRow, action: "ASSIGN_ROLE" | "REVOKE_ROLE") => void }) {
  // Search behaves like the messages inbox: filtering is INSTANT over the
  // loaded rows (same fields as the API matches — email, name, account), so
  // the table responds on every keystroke. The debounced server query then
  // refreshes the authoritative result set across the whole user base without
  // flashing a loading state (stale-while-revalidate in useResource).
  const url = `/api/admin/users?limit=1000`;

  const resource = useResource<{ users: UserRow[]; total: number }>(url, 15_000);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [settingsUser, setSettingsUser] = useState<UserRow | null>(null);

  const users = useMemo(() => resource.data?.users ?? [], [resource.data]);
  const truncated = resource.data ? resource.data.total > resource.data.users.length : false;
  return (
    <ModuleState loading={resource.loading} error={resource.error} onRetry={() => void resource.refresh()}>
      {resource.data ? (
        <div>
          <SectionHeader title="Users and access" description="Identity, verification, account exposure, active roles, sessions, reconciliation restrictions, and audited balance operations." onRefresh={() => void resource.refresh()} />
          {truncated && (
            <Alert tone="info" className="mb-3">
              Showing the first {resource.data.users.length} of {resource.data.total} accounts — use the search to narrow.
            </Alert>
          )}
          <PaginatedUsers
            users={users}
            emptyLabel="No accounts match."
            canAdjustBalance={canAdjustBalance}
            canManage={canManage}
            onManageBalance={setSelectedUser}
            onEditSettings={setSettingsUser}
            onOpenChat={onOpenChat}
            onProposeRole={onProposeRole}
            onChanged={() => void resource.refresh({ silent: true })}
          />
          <UserBalanceDialog
            user={selectedUser}
            open={Boolean(selectedUser)}
            onClose={() => setSelectedUser(null)}
            onAdjusted={async () => { await resource.refresh({ silent: true }); }}
          />
          <UserSettingsDialog
            user={settingsUser}
            open={Boolean(settingsUser)}
            onClose={() => setSettingsUser(null)}
          />
        </div>
      ) : null}
    </ModuleState>
  );
}

function PaginatedUsers({
  users, onChanged, onOpenChat, onProposeRole, canManage, canAdjustBalance, emptyLabel, onManageBalance, onEditSettings,
}: {
  users: UserRow[];
  onChanged: () => void;
  onOpenChat: (user: UserRow) => void;
  onProposeRole?: (user: UserRow, action: "ASSIGN_ROLE" | "REVOKE_ROLE") => void;
  canManage: boolean;
  canAdjustBalance: boolean;
  emptyLabel?: string;
  onManageBalance?: (user: UserRow) => void;
  onEditSettings?: (user: UserRow) => void;
}) {
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" }>({ key: "createdAt", direction: "desc" });
  const onSort = (key: string) =>
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "desc" },
    );

  const sortedUsers = useMemo(() => {
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...users].sort((a, b) => {
      switch (sort.key) {
        case "name": return (a.name ?? "").localeCompare(b.name ?? "") * dir;
        case "balance": return (Number(a.metrics?.balance ?? 0) - Number(b.metrics?.balance ?? 0)) * dir;
        case "equity": return (Number(a.metrics?.equity ?? 0) - Number(b.metrics?.equity ?? 0)) * dir;
        case "positions": return (a._count.positions - b._count.positions) * dir;
        default: return (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) * dir;
      }
    });
  }, [users, sort]);

  const csvRows = sortedUsers.map((u) => [
    u.name ?? "Unnamed", u.email ?? "", u.accountNo ?? "", u.verified ? "Verified" : "Unverified",
    u.kyc?.status ?? "", u.mfaEnabledAt ? "MFA on" : "MFA off",
    u.adminRoles.map((r) => r.role).join("; "), Number(u.metrics?.balance ?? 0).toFixed(2),
    Number(u.metrics?.equity ?? 0).toFixed(2), u._count.positions, fmtDateTime(u.createdAt),
    u.lastActiveAt ? fmtDateTime(u.lastActiveAt) : "", [u.kyc?.city, u.kyc?.country].filter(Boolean).join(", "),
  ]);

  return (
    <RecordList<UserRow>
      ariaLabel="Account"
      title="Accounts"
      description={`${sortedUsers.length} users`}
      rows={sortedUsers}
      rowKey={(u) => u.id}
      search={{ placeholder: "Search name, email, or account…", text: (u) => `${u.name ?? ""} ${u.email ?? ""} ${u.accountNo ?? ""}` }}
      filters={
        <ChipGroup
          className="flex-wrap"
          ariaLabel="Sort users"
          value={sort.key}
          onChange={onSort}
          options={[
            { value: "createdAt", label: "Newest" },
            { value: "name", label: "Name" },
            { value: "balance", label: "Balance" },
            { value: "equity", label: "Equity" },
            { value: "positions", label: "Positions" },
          ]}
        />
      }
      toolbarEnd={
        <CsvExportButton
          filename="users"
          columns={["Name", "Email", "Account", "Status", "KYC", "Security", "Roles", "Balance", "Equity", "Positions", "Created", "Last active", "Location"]}
          rows={csvRows}
          disabled={sortedUsers.length === 0}
        />
      }
      leading={(u) => ({
        icon: null,
        tone: u.online ? "up" : "muted",
        title: (
          <span className="flex items-center gap-2">
            <IdentityTile tone={u.online ? "up" : "muted"} className={u.online ? "ring-2 ring-up/30 ring-offset-2 ring-offset-card" : undefined}>
              {initialsOf(u.name ?? u.email)}
            </IdentityTile>
            {u.name ?? "Unnamed"}
            {u.online && <span className="relative flex size-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-up opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-up" /></span>}
          </span>
        ),
        secondary: (
          <span className="flex flex-wrap items-center gap-1">
            {u.email ?? "—"} · #{u.accountNo ?? "—"}
            {!u.verified && <Badge variant="secondary" className="px-1.5 py-0 text-xs">unverified</Badge>}
            {u.lockedUntil && <Badge variant="secondary" className="bg-down/10 px-1.5 py-0 text-xs text-down">locked</Badge>}
            {u.adminRoles.length > 0 && (
              <Badge variant="secondary" className="bg-primary/10 px-1.5 py-0 text-xs text-primary">
                {u.adminRoles[0].role.toLowerCase()}
                {u.adminRoles.length > 1 ? ` +${u.adminRoles.length - 1}` : ""}
              </Badge>
            )}
          </span>
        ),
      })}
      columns={[
        { key: "kycStatus", label: "KYC", render: (u) => (
          <RecordStatusChip tone={u.kyc?.status === "APPROVED" ? "up" : u.kyc?.status === "PENDING" ? "warn" : "muted"}>
            {u.kyc?.status ?? "NOT_SUBMITTED"}
          </RecordStatusChip>
        ) },
        { key: "balance", label: "Balance", sortable: true, align: "right", render: (u) => (
          <span className="tabular-nums">{formatUsd(u.metrics?.balance ?? "0")}</span>
        ) },
        { key: "equity", label: "Equity", sortable: true, align: "right", render: (u) => (
          <span className="tabular-nums">{formatUsd(u.metrics?.equity ?? "0")}</span>
        ) },
        { key: "positions", label: "Positions", sortable: true, align: "right", render: (u) => (
          <span className={`tabular-nums ${u._count.positions > 0 ? "text-up" : ""}`}>{u._count.positions}</span>
        ) },
      ]}
      sortValue={(u, key) => {
        switch (key) {
          case "balance": return Number(u.metrics?.balance ?? 0);
          case "equity": return Number(u.metrics?.equity ?? 0);
          case "positions": return u._count.positions;
          default: return String((u as unknown as Record<string, unknown>)[key] ?? "");
        }
      }}
      initialSort={{ key: "createdAt", direction: "desc" }}
      mobilePrimary={(u) => <span className="tabular-nums">{formatUsd(u.metrics?.balance ?? "0")}</span>}
      detailTitle="Account Detail"
      renderDetailHero={(u) => (
        <div className="rounded-xl bg-muted/50 px-4 py-5">
          <div className="flex items-center gap-4">
            <IdentityTile size="lg" tone={u.online ? "up" : "muted"} className={u.online ? "ring-2 ring-up/30" : undefined}>
              {initialsOf(u.name ?? u.email)}
            </IdentityTile>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-base font-semibold">{u.name ?? "Unnamed"}</span>
                <RecordStatusChip tone={u.online ? "up" : "muted"}>{u.online ? "Online" : "Offline"}</RecordStatusChip>
              </div>
              <div className="mt-0.5 truncate text-sm text-muted-foreground">{u.email ?? "—"}</div>
              <div className="mt-0.5 font-mono text-xs text-muted-foreground">#{u.accountNo ?? "—"}</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {!u.verified && <Badge variant="secondary" className="px-1.5 py-0 text-xs">unverified</Badge>}
                {u.lockedUntil && <Badge variant="secondary" className="bg-down/10 px-1.5 py-0 text-xs text-down">locked</Badge>}
                {u.adminRoles.map((r) => (
                  <Badge key={r.role} variant="secondary" className="bg-primary/10 px-1.5 py-0 text-xs text-primary">{r.role.toLowerCase()}</Badge>
                ))}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-lg font-semibold tabular-nums">{formatUsd(u.metrics?.balance ?? "0")}</div>
              <div className="text-xs text-muted-foreground">balance</div>
            </div>
          </div>
        </div>
      )}
      renderDetailMeta={(u) => [
        { label: "Balance", value: formatUsd(u.metrics?.balance ?? "0") },
        { label: "Equity", value: formatUsd(u.metrics?.equity ?? "0") },
        { label: "Floating P/L", value: formatUsd(u.metrics?.floatingPl ?? "0") },
        { label: "KYC", value: u.kyc?.status ?? "NOT_SUBMITTED" },
        { label: "MFA", value: u.mfaEnabledAt ? "Enabled" : "Off" },
        { label: "Sessions", value: String(u._count.securitySessions) },
        { label: "Positions", value: String(u._count.positions) },
        { label: "Recon blocks", value: String(u._count.reconciliationBlocks) },
        { label: "Created", value: fmtDateTime(u.createdAt) },
        { label: "Last active", value: u.lastActiveAt ? fmtDateTime(u.lastActiveAt) : "Never" },
        { label: "Location", value: [u.kyc?.city, u.kyc?.country].filter(Boolean).join(", ") || "—" },
      ]}
      renderDetailExtra={(u) => (
        (canManage || canAdjustBalance) ? (
          <AdminUserActions
            user={u as unknown as ManagedUserRow}
            onChanged={onChanged}
            onOpenChat={(usr) => onOpenChat(users.find((c) => c.id === usr.id) ?? u)}
            onManageBalance={canAdjustBalance && onManageBalance ? (usr) => onManageBalance(users.find((c) => c.id === usr.id) ?? u) : undefined}
            onEditSettings={canAdjustBalance && onEditSettings ? (usr) => onEditSettings(users.find((c) => c.id === usr.id) ?? u) : undefined}
            onProposeRole={onProposeRole ? (usr, action) => onProposeRole(users.find((c) => c.id === usr.id) ?? u, action) : undefined}
            canManage={canManage}
          />
        ) : undefined
      )}
      emptyTitle={emptyLabel ?? "No users found."}
    />
  );
}


interface UserFinanceTransaction {
  id: string;
  type: string;
  status: string;
  amount: string;
  asset: string;
  description: string | null;
  reference: string | null;
  createdAt: string;
}
interface UserFinanceResponse {
  user: { id: string; email: string | null; name: string | null; accountNo: string | null };
  metrics: { balance: string; equity: string; free: string; margin: string; floatingPl: string } | null;
  wallet: { asset: string; free: string; locked: string } | null;
  transactions: UserFinanceTransaction[];
}
function UserSettingsDialog({ user, open, onClose }: { user: UserRow | null; open: boolean; onClose: () => void }) {
  const [settings, setSettings] = useState<UserSettingsConfig>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !open) return;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/users/${user.id}/profile`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load settings");
        const data = await res.json();
        setSettings((data.profile?.settings as UserSettingsConfig) ?? {});
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load settings."))
      .finally(() => setLoading(false));
  }, [user, open]);

  const handleSave = async (newSettings: UserSettingsConfig) => {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: newSettings }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save settings");
      }
      toast.success("User settings saved", `${user.name ?? user.email ?? "User"}'s overrides were updated.`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (!open || !user) return null;

  return (
    <Dialog open={open} onClose={saving ? () => undefined : onClose} title="User Settings" description={`${user.name ?? "Unnamed"} · ${user.email ?? "—"}`} className="sm:max-w-lg">
      <div className="max-h-[74dvh] overflow-y-auto px-5 py-4">
        {error && <Alert tone="err" className="mb-3">{error}</Alert>}
        {loading ? (
          <div className="space-y-3" role="status" aria-label="Loading settings">
            <Skeleton className="h-5 w-40" />
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
          </div>
        ) : (
          <SettingsForm initial={settings} onSave={handleSave} saving={saving} saveLabel="Save User Settings" />
        )}
      </div>
    </Dialog>
  );
}

function UserBalanceDialog({
  user,
  open,
  onClose,
  onAdjusted,
}: {
  user: UserRow | null;
  open: boolean;
  onClose: () => void;
  onAdjusted: () => Promise<void>;
}) {
  const [data, setData] = useState<UserFinanceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [action, setAction] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  // One idempotency key per logical adjustment: minted when the dialog opens,
  // reused across failed submit attempts (so a retry after a network error
  // replays instead of double-posting), and rotated after each success so the
  // next intentional adjustment is a distinct command.
  const commandKeyRef = useRef<string>("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      setData(await requestJson<UserFinanceResponse>(`/api/admin/users/${user.id}/finance?limit=100`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load finance history.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!open) return;
    setAction("CREDIT");
    setAmount("");
    setReason("");
    setNotice(null);
    commandKeyRef.current = `admin-balance-${createDeviceId()}`;
    void load();
  }, [open, load]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || busy) return;
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (reason.trim().length < 5) {
      setError("An audited reason of at least five characters is required.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await requestJson(`/api/admin/users/${user.id}/finance`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": commandKeyRef.current || `admin-balance-${createDeviceId()}`,
        },
        body: JSON.stringify({ action, amount, reason }),
      });
      commandKeyRef.current = `admin-balance-${createDeviceId()}`;
      setAmount("");
      setReason("");
      toast.success(action === "CREDIT" ? "Balance top-up posted" : "Balance deduction posted");
      await Promise.all([load(), onAdjusted()]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to adjust the balance.");
    } finally {
      setBusy(false);
    }
  }

  const transactions = data?.transactions ?? [];

  return (
    <Dialog
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={`Manage balance · ${user?.name ?? user?.email ?? "User"}`}
          description="Administrative adjustments are posted through the double-entry ledger and immutable audit chain."
      className="sm:max-w-4xl"
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        {loading && !data ? <div className="rounded-xl bg-muted/40 p-8 text-center text-sm text-muted-foreground">Loading account finance…</div> : null}
        {data ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Ledger balance" value={formatUsd(data.metrics?.balance ?? "0")} />
              <MetricCard label="Available" value={formatUsd(data.wallet?.free ?? data.metrics?.free ?? "0")} />
              <MetricCard label="Locked" value={formatUsd(data.wallet?.locked ?? "0")} />
              <MetricCard label="Equity" value={formatUsd(data.metrics?.equity ?? "0")} />
            </div>
            <form onSubmit={submit} className="p-4">
              <ChipGroup
                ariaLabel="Balance adjustment type"
                value={action}
                onChange={setAction}
                options={[
                  { value: "CREDIT" as const, label: "Top up balance" },
                  { value: "DEBIT" as const, label: "Deduct balance" },
                ]}
              />
              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,12rem)_1fr_auto] md:items-end">
                <Label className="text-xs font-medium">Amount (USD)
                  <Input type="number" inputMode="decimal" min="0.00000001" max="1000000" step="0.00000001" required value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 h-10" placeholder="0.00" startIcon={<DollarSign size={13} strokeWidth={2} aria-hidden />} />
                </Label>
                <Label className="text-xs font-medium">Audited reason
                  <Input type="text" minLength={5} maxLength={500} required value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 h-10" placeholder="Ticket, customer request, or correction reason" startIcon={<FileText size={13} strokeWidth={2} aria-hidden />} />
                </Label>
                <Button type="submit" variant={action === "CREDIT" ? "default" : "destructive"} loading={busy} loadingLabel="Posting adjustment">{action === "CREDIT" ? "Post top-up" : "Post deduction"}</Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Deductions cannot exceed the user’s available balance. Margin and pending withdrawals are never silently consumed.</p>
            </form>
            {error ? <Alert tone="err">{error}</Alert> : null}
            {notice ? <Alert tone="ok">{notice}</Alert> : null}
            <section aria-labelledby="user-transaction-history">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div><h3 id="user-transaction-history" className="text-sm font-semibold">Customer transaction history</h3><p className="text-xs text-muted-foreground">Deposits, withdrawals, trading settlements, bonuses, fees, and administrative adjustments.</p></div>
                <Button size="sm" variant="ghost" onClick={() => void load()} disabled={loading}>Refresh</Button>
              </div>
              <RecordList<UserFinanceTransaction>
                    ariaLabel="Transaction"
                    title="History"
                    description={`${transactions.length} records`}
                    rows={transactions}
                    rowKey={(t) => t.id}
                    search={{ placeholder: "Search type, description, or reference…", text: (t) => `${t.type} ${t.description ?? ""} ${t.reference ?? ""}` }}
                    leading={(t) => ({
                      icon: null,
                      tone: Number(t.amount) >= 0 ? "up" : "down",
                      title: t.type.replaceAll("_", " ").toLowerCase(),
                      secondary: t.description ?? "—",
                    })}
                    columns={[
                      { key: "createdAt", label: "Date", sortable: true, align: "right", render: (t) => (
                        <span className="text-xs text-muted-foreground tabular-nums">{new Date(t.createdAt).toLocaleString()}</span>
                      ) },
                      { key: "reference", label: "Reference", render: (t) => <span className="font-mono text-xs text-muted-foreground">{t.reference ?? "—"}</span> },
                      { key: "amount", label: "Amount", sortable: true, align: "right", render: (t) => {
                        const numeric = Number(t.amount);
                        return <span className={`font-semibold tabular-nums ${numeric >= 0 ? "text-up" : "text-down"}`}>{numeric >= 0 ? "+" : ""}{formatUsd(t.amount)}</span>;
                      } },
                      { key: "status", label: "Status", render: (t) => (
                        <RecordStatusChip tone={t.status === "COMPLETED" ? "up" : t.status === "PENDING" ? "warn" : "down"}>{t.status}</RecordStatusChip>
                      ) },
                    ]}
                    sortValue={(t, key) => {
                      switch (key) {
                        case "amount": return Number(t.amount);
                        case "createdAt": return new Date(t.createdAt).getTime();
                        default: return String((t as unknown as Record<string, unknown>)[key] ?? "");
                      }
                    }}
                    initialSort={{ key: "createdAt", direction: "desc" }}
                    detailTitle="Transaction Detail"
                    renderDetailHero={(t) => {
                      const numeric = Number(t.amount);
                      return (
                        <div className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 px-4 py-6 text-center">
                          <IdentityTile size="lg" tone={numeric >= 0 ? "up" : "down"}>
                            <ArrowDownToLine size={20} strokeWidth={2} aria-hidden />
                          </IdentityTile>
                          <div className="text-sm font-medium">{t.type.replaceAll("_", " ").toLowerCase()}</div>
                          <div className={`text-2xl font-semibold tabular-nums ${numeric >= 0 ? "text-up" : "text-down"}`}>
                            {numeric >= 0 ? "+" : ""}{formatUsd(t.amount)} <span className="text-sm font-normal text-muted-foreground">{t.asset}</span>
                          </div>
                          <RecordStatusChip tone={t.status === "COMPLETED" ? "up" : t.status === "PENDING" ? "warn" : "down"}>{t.status}</RecordStatusChip>
                        </div>
                      );
                    }}
                    renderDetailMeta={(t) => [
                      { label: "Description", value: t.description ?? "—" },
                      { label: "Reference", value: <span className="font-mono text-xs">{t.reference ?? "—"}</span> },
                      { label: "Date", value: new Date(t.createdAt).toLocaleString() },
                    ]}
                    emptyTitle="No transactions."
                  />
            </section>
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 justify-end border-t px-4 py-3 sm:px-5"><Button variant="ghost" onClick={onClose} disabled={busy}>Close</Button></div>
    </Dialog>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return <div className="p-3"><div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-1 text-lg font-semibold tnum">{value}</div></div>;
}

function formatUsd(value: string | number): string {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numeric)
    : "$0.00";
}

interface KycSubmission {
  id: string; userId: string; status: "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED";
  firstName: string | null; lastName: string | null; dob: string | null; country: string | null; address: string | null;
  city: string | null; postalCode: string | null; docType: string | null; docReference: string | null; note: string | null;
  submittedAt: string | null; reviewedAt: string | null; user: { email: string | null; name: string | null; accountNo: string | null };
}
function KycPanel({ canDecide, canAccess }: { canDecide: boolean; canAccess: boolean }) {
  const resource = useResource<{ pending: KycSubmission[]; reviewed: KycSubmission[]; total: number; reviewedTotal?: number }>("/api/admin/kyc/workspace", 15_000);
  return <ModuleState loading={resource.loading} error={resource.error} onRetry={() => void resource.refresh()}>{resource.data && <KycReview pending={resource.data.pending} reviewed={resource.data.reviewed} totalCount={resource.data.total} reviewedTotal={resource.data.reviewedTotal} canDecide={canDecide} canAccessDocuments={canAccess} onQueueChange={() => void resource.refresh()} />}</ModuleState>;
}

function PaymentsPanel({ canPrepare, canApprove, simpleApproval = false }: { canPrepare: boolean; canApprove: boolean; simpleApproval?: boolean }) {
  const resource = useResource<{ requests: PaymentRequestRow[] }>("/api/admin/payments?limit=100", 15_000);
  return <ModuleState loading={resource.loading} error={resource.error} onRetry={() => void resource.refresh()}>{resource.data && <PaymentsReview initialRequests={resource.data.requests} canPrepare={canPrepare} canApprove={canApprove} simpleApproval={simpleApproval} />}</ModuleState>;
}

interface LedgerEntryView { id: string; direction: string; amount: string; asset: string; account: { code: string; name: string } }
interface LedgerTransactionView { id: string; reference: string; kind: string; status: string; description: string; userId: string | null; user: { email: string | null; accountNo: string | null } | null; sourceType: string | null; sourceId: string | null; effectiveAt: string; entries: LedgerEntryView[] }
interface LedgerResponse { trialBalance: Array<{ asset: string; direction: string; amount: string }>; total: number; transactions: LedgerTransactionView[] }

/** Text-only tone (amounts) matching the kind badge. */
function ledgerKindTextTone(kind: string): string {
  if (kind === "DEPOSIT" || kind === "BONUS") return "text-up";
  if (kind === "WITHDRAWAL" || kind === "FEE") return "text-down";
  return "text-muted-foreground";
}

/** Total credited per asset — for double-entry postings this is the gross amount moved. */
function ledgerCreditTotals(entries: LedgerEntryView[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    if (entry.direction !== "CREDIT") continue;
    totals.set(entry.asset, (totals.get(entry.asset) ?? 0) + Number(entry.amount));
  }
  return totals;
}

function LedgerPanel() {
  const resource = useResource<LedgerResponse>("/api/admin/ledger?limit=200", 15_000);
  const [kindFilter, setKindFilter] = useState<string>("ALL");

  const all = useMemo(() => resource.data?.transactions ?? [], [resource.data]);
  // Kind chips cover the posting kinds present in the loaded window.
  const kinds = useMemo(() => [...new Set(all.map((t) => t.kind))].sort(), [all]);
  const filtered = useMemo(() => all.filter((t) => kindFilter === "ALL" || t.kind === kindFilter), [all, kindFilter]);
  const filtering = kindFilter !== "ALL";

  const csvRows = filtered.flatMap((t) => t.entries.map((entry) => [
    t.reference, t.kind, t.status, t.user?.email ?? "system", t.user?.accountNo ?? "",
    fmtDateTime(t.effectiveAt), entry.direction, entry.account.name, entry.account.code,
    entry.asset, Number(entry.amount).toFixed(8),
  ]));

  return <ModuleState loading={resource.loading} error={resource.error} onRetry={() => void resource.refresh()}>{resource.data && <div className="space-y-5">
    <SectionHeader title="Double-entry ledger" description="Posted transaction headers and immutable debit/credit entries." onRefresh={() => void resource.refresh()} />
    <div className="flex flex-wrap gap-2">{resource.data.trialBalance.map((row) => <span key={`${row.asset}:${row.direction}`}>{row.asset} {row.direction}: <strong className="tabular-nums">{fmtExecNumber(row.amount)}</strong></span>)}</div>
    {resource.data.total > all.length && (
      <Alert tone="info">Showing the {all.length} most recent postings of {resource.data.total.toLocaleString("en-US")} — narrow the window with the search or kind filters.</Alert>
    )}
    <RecordList<LedgerTransactionView>
      ariaLabel="Posting"
      title="Postings"
      description={`${filtering ? `${filtered.length} of ${all.length}` : `${all.length}`} postings`}
      rows={filtered}
      rowKey={(t) => t.id}
      search={{
        placeholder: "Search reference, kind, description, or user…",
        text: (t) => `${t.reference} ${t.kind} ${t.description} ${t.user?.email ?? ""} ${t.user?.accountNo ?? ""}`,
      }}
      leading={(t) => ({
        icon: <ArrowLeftRight size={15} strokeWidth={2} aria-hidden />,
        tone: t.kind === "DEPOSIT" || t.kind === "BONUS" ? "up" : t.kind === "WITHDRAWAL" || t.kind === "FEE" ? "down" : "muted",
        title: <span className="font-mono">{t.reference}</span>,
        secondary: <span>{t.kind.replaceAll("_", " ").toLowerCase()} · {t.user?.email ?? t.user?.accountNo ?? "system"}</span>,
      })}
      columns={[
        { key: "status", label: "Status", render: (t) => (
          <RecordStatusChip tone="muted">{t.status}</RecordStatusChip>
        ) },
        { key: "effectiveAt", label: "Effective", sortable: true, align: "right", render: (t) => (
          <span className="text-xs text-muted-foreground tabular-nums">{fmtDateTime(t.effectiveAt)}</span>
        ) },
        { key: "credits", label: "Credits", sortable: true, align: "right", render: (t) => {
          const totals = ledgerCreditTotals(t.entries);
          const cls = ledgerKindTextTone(t.kind);
          return <span className={`font-semibold tabular-nums ${cls}`}>
            {[...totals.entries()].map(([asset, total]) => `${asset} ${fmtExecNumber(total.toFixed(8))}`).join(" · ")}
          </span>;
        } },
      ]}
      sortValue={(t, key) => {
        switch (key) {
          case "effectiveAt": return new Date(t.effectiveAt).getTime();
          case "credits": return [...ledgerCreditTotals(t.entries).values()].reduce((a, b) => a + b, 0);
          default: return String((t as unknown as Record<string, unknown>)[key] ?? "");
        }
      }}
      initialSort={{ key: "effectiveAt", direction: "desc" }}
      filters={
        <ChipGroup
          ariaLabel="Filter postings by kind"
          value={kindFilter}
          onChange={(value) => setKindFilter(value)}
          options={[{ value: "ALL", label: "All" }, ...kinds.map((kind) => ({ value: kind, label: kind.replaceAll("_", " ").toLowerCase() }))]}
        />
      }
      toolbarEnd={
        <CsvExportButton filename="ledger" columns={["Reference", "Kind", "Status", "User", "Account", "Effective", "Direction", "Account name", "Account code", "Asset", "Amount"]} rows={csvRows} disabled={filtered.length === 0} />
      }
      detailTitle="Posting Detail"
      renderDetailHero={(t) => {
        const totals = ledgerCreditTotals(t.entries);
        const cls = ledgerKindTextTone(t.kind);
        return (
          <div className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 px-4 py-6 text-center">
            <IdentityTile size="lg" tone={t.kind === "DEPOSIT" || t.kind === "BONUS" ? "up" : t.kind === "WITHDRAWAL" || t.kind === "FEE" ? "down" : "muted"}>
              <ArrowLeftRight size={20} strokeWidth={2} aria-hidden />
            </IdentityTile>
            <div className="text-sm font-medium">{t.kind.replaceAll("_", " ").toLowerCase()}</div>
            <div className={`text-2xl font-semibold tabular-nums ${cls}`}>
              {[...totals.entries()].map(([asset, total]) => `${asset} ${fmtExecNumber(total.toFixed(8))}`).join(" · ")}
            </div>
            <RecordStatusChip tone="muted">{t.status}</RecordStatusChip>
          </div>
        );
      }}
      renderDetailMeta={(t) => [
        { label: "Reference", value: <span className="font-mono text-xs">{t.reference}</span> },
        { label: "User", value: t.user?.email ?? t.user?.accountNo ?? "system" },
        { label: "Effective", value: fmtDateTime(t.effectiveAt) },
        { label: "Description", value: t.description || "—" },
        ...(t.sourceType ? [{ label: "Source", value: `${t.sourceType}${t.sourceId ? ` ${t.sourceId}` : ""}` }] : []),
      ]}
      renderDetailExtra={(t) => (
        <div className="rounded-xl bg-muted/40 p-4">
          <div className="text-xs font-medium text-muted-foreground">Entries</div>
          <div className="mt-3 space-y-1.5">
            {t.entries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-2 rounded-lg bg-card px-3 py-2 text-xs">
                <span className="flex min-w-0 items-center gap-2">
                  <RecordStatusChip tone={entry.direction === "DEBIT" ? "down" : "up"}>{entry.direction}</RecordStatusChip>
                  <span className="truncate" title={`${entry.account.name} (${entry.account.code})`}>{entry.account.name}</span>
                </span>
                <span className="shrink-0 font-medium tabular-nums">{entry.asset} {fmtExecNumber(entry.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      emptyTitle="No ledger transactions."
    />
  </div>}</ModuleState>;
}

interface ExecutionPosition {
  id: string;
  symbol: string;
  instrument?: { name: string; category: string } | null;
  user: { email: string | null; accountNo: string | null };
  type?: string;
  side: string;
  status: string;
  volume: string;
  openRate?: string;
  currentRate?: string;
  commission?: string;
  swap?: string;
  profit: string;
  adminPnlAdjustment: string;
  netProfit: string;
  openedAt: string;
  closedAt?: string | null;
  closeReason?: string | null;
}
interface ExecutionResponse { executionMode: string; marketDataMode: string; engineReady: boolean; providerWarning: string; total: number; positions: ExecutionPosition[] }

type ExecutionStatusFilter = "ALL" | "OPEN" | "CLOSED";


/** Compact decimal for fixed-point strings like "0.10000000" → "0.1". */
function fmtExecNumber(value: string | number): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(numeric);
}

function pnlClass(value: number): string {
  if (value > 0) return "text-up";
  if (value < 0) return "text-down";
  return "text-muted-foreground";
}

/** Stable identity for grouping execution rows by user. */

function ExecutionsPanel({ canManage }: { canManage: boolean }) {
  const resource = useResource<ExecutionResponse>("/api/admin/executions?limit=200");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ExecutionStatusFilter>("ALL");
  const [positionFilter, setPositionFilter] = useState<"ALL" | "OPEN" | "CLOSED">("ALL");
  const [profitTarget, setProfitTarget] = useState<ExecutionPosition | null>(null);
  const [profitValue, setProfitValue] = useState("");
  const [profitReason, setProfitReason] = useState("");
  const [closeTarget, setCloseTarget] = useState<ExecutionPosition | null>(null);
  const [closeReason, setCloseReason] = useState("");

  async function submitProfit() {
    if (!profitTarget || !/^-?\d+(\.\d+)?$/.test(profitValue) || profitReason.trim().length < 5) return;
    setBusy(profitTarget.id);
    setError(null);
    try {
      await requestJson(`/api/admin/executions/${profitTarget.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "SET_PROFIT", targetProfit: Number(profitValue), reason: profitReason.trim() }),
      });
      setProfitTarget(null);
      setProfitValue("");
      setProfitReason("");
      await resource.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to adjust the position P/L.");
    } finally { setBusy(null); }
  }

  async function submitClose() {
    if (!closeTarget || closeReason.trim().length < 3) return;
    setBusy(closeTarget.id);
    setError(null);
    try {
      await requestJson(`/api/admin/executions/${closeTarget.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "CLOSE", reason: closeReason.trim() }),
      });
      setCloseTarget(null);
      setCloseReason("");
      await resource.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to close the position.");
    } finally { setBusy(null); }
  }

  const allPositions = useMemo(() => resource.data?.positions ?? [], [resource.data]);
  const openCount = allPositions.filter((p) => p.status === "OPEN").length;
  const closedCount = allPositions.length - openCount;
  const filtered = useMemo(() => allPositions.filter((p) => statusFilter === "ALL" || p.status === statusFilter), [allPositions, statusFilter]);
  const totalNetPl = filtered.reduce((sum, p) => sum + Number(p.netProfit), 0);
  const filtering = statusFilter !== "ALL";

  const csvRows = filtered.map((p) => [
    p.user.email ?? "", p.user.accountNo ?? "", p.symbol, p.type ?? "", p.side, p.status,
    Number(p.volume), fmtDateTime(p.openedAt), p.closedAt ? fmtDateTime(p.closedAt) : "",
    Number(p.profit).toFixed(2), Number(p.adminPnlAdjustment).toFixed(2), Number(p.netProfit).toFixed(2),
  ]);

  interface UserGroup {
    key: string;
    label: string;
    accountNo: string | null;
    positions: ExecutionPosition[];
    open: number;
    netPl: number;
  }
  const groups = useMemo(() => {
    const byUser = new Map<string, UserGroup>();
    for (const p of filtered) {
      const key = p.user.email ?? p.user.accountNo ?? p.id;
      const g = byUser.get(key) ?? { key, label: p.user.email ?? p.user.accountNo ?? "Unknown", accountNo: p.user.accountNo, positions: [], open: 0, netPl: 0 };
      g.positions.push(p);
      g.open += p.status === "OPEN" ? 1 : 0;
      g.netPl += Number(p.netProfit);
      byUser.set(key, g);
    }
    return [...byUser.values()].sort((a, b) => b.open - a.open || b.netPl - a.netPl || a.label.localeCompare(b.label));
  }, [filtered]);

  const positionFilterLabel = (g: UserGroup) => {
    const counts = {
      ALL: g.positions.length,
      OPEN: g.positions.filter((p) => p.status === "OPEN").length,
      CLOSED: g.positions.filter((p) => p.status === "CLOSED").length,
    };
    return counts;
  };

  return <ModuleState loading={resource.loading} error={resource.error} onRetry={() => void resource.refresh()}>{resource.data && <div className="space-y-4">
    <SectionHeader title="Execution and position surveillance" description={resource.data.providerWarning} onRefresh={() => void resource.refresh()} />
    <div className="flex flex-wrap gap-2">
      <Badge variant="secondary" className="bg-primary/10 text-primary">{resource.data.executionMode}</Badge>
      <Badge variant="secondary">Feed: {resource.data.marketDataMode}</Badge>
      <Badge variant="secondary" className={resource.data.engineReady ? "bg-(--term-success-bg) text-(--term-success-fg)" : "bg-(--term-danger-bg) text-(--term-danger-fg)"}>Engine {resource.data.engineReady ? "ready" : "starting"}</Badge>
    </div>
    {error && <Alert tone="err">{error}</Alert>}
    {resource.data.total > allPositions.length && (
      <Alert tone="info">Showing the {allPositions.length} most recent positions of {resource.data.total.toLocaleString("en-US")} — narrow with the status filter.</Alert>
    )}
    <RecordList<UserGroup>
      ariaLabel="Account"
      title="Positions by user"
      sheetWidth="sm:max-w-2xl"
      description={
        <>
          {groups.length} account{groups.length === 1 ? "" : "s"} · {filtering ? `${filtered.length} of ${allPositions.length}` : `${allPositions.length}`} positions
          {" · net P/L "}
          <span className={pnlClass(totalNetPl)}>{fmtExecNumber(totalNetPl.toFixed(2))}</span>
        </>
      }
      rows={groups}
      rowKey={(g) => g.key}
      search={{ placeholder: "Search symbol, email, or account…", text: (g) => `${g.label} ${g.accountNo ?? ""} ${g.positions.map((p) => p.symbol).join(" ")}` }}
      filters={
        <ChipGroup
          ariaLabel="Filter positions by status"
          value={statusFilter}
          onChange={(value) => setStatusFilter(value)}
          options={[
            { value: "ALL", label: `All · ${allPositions.length}` },
            { value: "OPEN", label: `Open · ${openCount}` },
            { value: "CLOSED", label: `Closed · ${closedCount}` },
          ]}
        />
      }
      toolbarEnd={
        <CsvExportButton
          filename="executions"
          columns={["User", "Account", "Symbol", "Type", "Side", "Status", "Volume", "Opened", "Closed", "Gross P/L", "Adjustment", "Net P/L"]}
          rows={csvRows}
          disabled={filtered.length === 0}
        />
      }
      leading={(g) => ({
        icon: <IdentityTile tone={g.open > 0 ? "up" : "muted"}>{initialsOf(g.label)}</IdentityTile>,
        title: g.label,
        secondary: <span>{g.accountNo && g.accountNo !== g.label ? `#${g.accountNo} · ` : ""}{g.positions.length} position{g.positions.length === 1 ? "" : "s"}</span>,
      })}
      columns={[
        { key: "open", label: "Open", sortable: true, align: "right", render: (g) => (
          g.open > 0
            ? <Badge variant="secondary" className="bg-primary/10 px-1.5 py-0 text-xs text-primary">{g.open}</Badge>
            : <span className="text-xs text-muted-foreground">0</span>
        ) },
        { key: "netPl", label: "Net P/L", sortable: true, align: "right", render: (g) => (
          <span className={`font-semibold tabular-nums ${pnlClass(g.netPl)}`}>
            {g.netPl >= 0 ? "+" : ""}{fmtExecNumber(g.netPl.toFixed(2))}
          </span>
        ) },
      ]}
      sortValue={(g, key) => {
        switch (key) {
          case "open": return g.open;
          case "netPl": return g.netPl;
          default: return String((g as unknown as Record<string, unknown>)[key] ?? "");
        }
      }}
      initialSort={{ key: "open", direction: "desc" }}
      mobilePrimary={(g) => (
        <span className={pnlClass(g.netPl)}>{g.netPl >= 0 ? "+" : ""}{fmtExecNumber(g.netPl.toFixed(2))}</span>
      )}
      detailTitle="Account Positions"
      renderDetailHero={(g) => (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 px-4 py-6 text-center">
          <IdentityTile size="lg" tone={g.open > 0 ? "up" : "muted"}>{initialsOf(g.label)}</IdentityTile>
          <div className="text-sm font-medium">{g.label}</div>
          {g.accountNo && <div className="font-mono text-xs text-muted-foreground">#{g.accountNo}</div>}
          <div className={`text-2xl font-semibold tabular-nums ${pnlClass(g.netPl)}`}>
            {g.netPl >= 0 ? "+" : ""}{fmtExecNumber(g.netPl.toFixed(2))} <span className="text-sm font-normal text-muted-foreground">USD</span>
          </div>
          <Badge variant="secondary" className="bg-primary/10 px-1.5 text-primary">{g.open} open · {g.positions.length - g.open} closed</Badge>
        </div>
      )}
      renderDetailMeta={(g) => [
        { label: "Positions", value: String(g.positions.length) },
        { label: "Open", value: String(g.open) },
        { label: "Closed", value: String(g.positions.length - g.open) },
        { label: "Net P/L", value: `${g.netPl >= 0 ? "+" : ""}${fmtExecNumber(g.netPl.toFixed(2))}` },
      ]}
      renderDetailExtra={(g) => {
        const counts = positionFilterLabel(g);
        const visible = g.positions.filter((p) => positionFilter === "ALL" || p.status === positionFilter);
        return (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">Positions</span>
              <ChipGroup
                ariaLabel="Filter positions in this account"
                value={positionFilter}
                onChange={(v) => setPositionFilter(v)}
                options={[
                  { value: "ALL", label: `All · ${counts.ALL}` },
                  { value: "OPEN", label: `Open · ${counts.OPEN}` },
                  { value: "CLOSED", label: `Closed · ${counts.CLOSED}` },
                ]}
              />
            </div>
            {visible.map((p) => (
              <details key={p.id} className="rounded-xl bg-muted/40">
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3 transition-colors hover:bg-muted/60">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <IdentityTile tone={p.side === "BUY" ? "up" : "down"}>
                      <InstrumentIcon symbol={p.symbol} size={18} />
                    </IdentityTile>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-semibold">{p.symbol}</span>
                        <Badge variant="secondary" className={`px-1.5 py-0 text-xs ${p.side === "BUY" ? "bg-up/10 text-up" : "bg-down/10 text-down"}`}>{p.side}</Badge>
                        <Badge variant="secondary" className={`px-1.5 py-0 text-xs ${p.status === "OPEN" ? "bg-(--term-warning-bg) text-(--term-warning-fg)" : "px-1.5 py-0 text-xs"}`}>{p.status}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {fmtExecNumber(p.volume)} lots @ {fmtExecNumber(p.openRate ?? "0")}{p.status === "OPEN" ? ` → ${fmtExecNumber(p.currentRate ?? "0")}` : ""}
                      </div>
                    </div>
                  </span>
                  <span className={`shrink-0 font-semibold tabular-nums ${pnlClass(Number(p.netProfit))}`}>
                    {Number(p.netProfit) >= 0 ? "+" : ""}{fmtExecNumber(p.netProfit)}
                  </span>
                </summary>
                <div className="space-y-3 border-t px-4 py-3">
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-3">
                    <div><dt className="text-muted-foreground">Type</dt><dd className="font-medium">{p.type ?? "CFD"}</dd></div>
                    <div><dt className="text-muted-foreground">Gross P/L</dt><dd className="font-medium tabular-nums">{fmtExecNumber(p.profit)}</dd></div>
                    <div><dt className="text-muted-foreground">Adjustment</dt><dd className="font-medium tabular-nums">{fmtExecNumber(p.adminPnlAdjustment)}</dd></div>
                    {Number(p.commission ?? 0) !== 0 && <div><dt className="text-muted-foreground">Commission</dt><dd className="font-medium tabular-nums">{fmtExecNumber(p.commission ?? "0")}</dd></div>}
                    {Number(p.swap ?? 0) !== 0 && <div><dt className="text-muted-foreground">Swap</dt><dd className="font-medium tabular-nums">{fmtExecNumber(p.swap ?? "0")}</dd></div>}
                    <div><dt className="text-muted-foreground">Opened</dt><dd className="font-medium tabular-nums">{fmtDateTime(p.openedAt)}</dd></div>
                    {p.closedAt && <div><dt className="text-muted-foreground">Closed</dt><dd className="font-medium tabular-nums">{fmtDateTime(p.closedAt)}</dd></div>}
                    {p.closeReason && <div className="col-span-2 sm:col-span-3"><dt className="text-muted-foreground">Close reason</dt><dd className="font-medium">{p.closeReason}</dd></div>}
                  </dl>
                  {canManage && p.status === "OPEN" && (
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => { setProfitTarget(p); setProfitValue(""); setProfitReason(""); }}>
                        <SlidersHorizontal size={13} strokeWidth={2} aria-hidden /> Set P/L
                      </Button>
                      <Button type="button" size="sm" variant="destructive" disabled={busy !== null} onClick={() => { setCloseTarget(p); setCloseReason(""); }}>
                        <X size={13} strokeWidth={2} aria-hidden /> Close position
                      </Button>
                    </div>
                  )}
                </div>
              </details>
            ))}
            {visible.length === 0 && (
              <div className="rounded-xl bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
                No {positionFilter.toLowerCase()} positions for this account.
              </div>
            )}
          </div>
        );
      }}
      emptyTitle="No positions."
    />

    {/* Set P/L dialog */}
    <SimpleDialog
      open={profitTarget !== null}
      onClose={() => { setProfitTarget(null); setProfitValue(""); }}
      title={profitTarget ? `Set P/L · ${profitTarget.symbol}` : "Set P/L"}
      description="Dealer adjustment for the net profit of this open position."
      className="sm:max-w-md"
    >
      <form onSubmit={(e) => { e.preventDefault(); void submitProfit(); }} className="space-y-4 px-5 py-4">
        <div>
          <Label htmlFor="profit-value" className="mb-1 block text-xs font-medium text-muted-foreground">New net P/L (USD, can be negative)</Label>
          <Input
            id="profit-value"
            type="text"
            required
            minLength={2}
            value={profitValue}
            onChange={(e) => setProfitValue(e.target.value)}
            placeholder="-12.50"
            startIcon={<DollarSign size={13} strokeWidth={2} />}
          />
        </div>
        <div>
          <Label htmlFor="profit-reason" className="mb-1 block text-xs font-medium text-muted-foreground">Audited reason (min 5 chars)</Label>
          <Textarea
            id="profit-reason"
            required
            minLength={5}
            maxLength={500}
            rows={2}
            value={profitReason}
            onChange={(e) => setProfitReason(e.target.value)}
            placeholder="e.g. Dealer correction — customer reported incorrect mark…"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => { setProfitTarget(null); setProfitValue(""); setProfitReason(""); }}>
            <X size={13} strokeWidth={2} aria-hidden /> Cancel
          </Button>
          <Button type="submit" loading={busy !== null} disabled={!/^-?\d+(\.\d+)?$/.test(profitValue) || profitReason.trim().length < 5}>
            <SlidersHorizontal size={13} strokeWidth={2} aria-hidden /> Post adjustment
          </Button>
        </div>
      </form>
    </SimpleDialog>

    {/* Close position dialog */}
    <SimpleDialog
      open={closeTarget !== null}
      onClose={() => { setCloseTarget(null); setCloseReason(""); }}
      title={closeTarget ? `Close position · ${closeTarget.symbol}` : "Close position"}
      description="Closes the open position at the current mark. The reason is audit-logged."
      className="sm:max-w-md"
    >
      <form onSubmit={(e) => { e.preventDefault(); void submitClose(); }} className="space-y-4 px-5 py-4">
        <div>
          <Label htmlFor="close-reason" className="mb-1 block text-xs font-medium text-muted-foreground">Reason (audited, min 3 chars)</Label>
          <Textarea
            id="close-reason"
            required
            minLength={3}
            maxLength={200}
            rows={3}
            value={closeReason}
            onChange={(e) => setCloseReason(e.target.value)}
            placeholder="e.g. Dealer close at customer request…"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => { setCloseTarget(null); setCloseReason(""); }}>
            <X size={13} strokeWidth={2} aria-hidden /> Cancel
          </Button>
          <Button type="submit" variant="destructive" loading={busy !== null} disabled={closeReason.trim().length < 3}>
            <X size={13} strokeWidth={2} aria-hidden /> Close position
          </Button>
        </div>
      </form>
    </SimpleDialog>
  </div>}</ModuleState>;
}


interface SupportCase { id: string; reference: string; userId: string | null; subject: string; category: string; priority: string; status: string; assignedToId: string | null; description: string; createdAt: string; brandDomain?: string | null }
function SupportPanel({ canManage }: { canManage: boolean }) {
  const resource = useResource<{ cases: SupportCase[] }>("/api/admin/support?limit=150");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { openCommand, commandDialog } = useCommandDialog();
  async function createCase() {
    const values = await openCommand({
      title: "Create support case",
      description: "Create an audited case for an operational or customer issue.",
      confirmLabel: "Create case",
      fields: [
        { name: "subject", label: "Subject", required: true, minLength: 3, maxLength: 160, placeholder: "Short issue summary" },
        { name: "description", label: "Description", type: "textarea", required: true, minLength: 5, maxLength: 2000, placeholder: "Describe the issue, impact, and known context." },
      ],
      validate: (input) => input.subject.length >= 3 && input.description.length >= 5 ? null : "Enter a subject and a complete issue description.",
    });
    if (!values) return;
    const { subject, description } = values;
    setBusy("create"); setError(null);
    try { await requestJson("/api/admin/support", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subject, description, category: "GENERAL", priority: "NORMAL" }) }); await resource.refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to create case."); } finally { setBusy(null); }
  }
  async function updateCase(id: string, status: "IN_PROGRESS" | "RESOLVED") {
    let resolutionNote: string | undefined;
    if (status === "RESOLVED") {
      const values = await openCommand({
        title: "Resolve support case",
        description: "The resolution note becomes part of the audited support record.",
        confirmLabel: "Resolve case",
        fields: [{ name: "resolutionNote", label: "Resolution note", type: "textarea", required: true, minLength: 3, maxLength: 2000 }],
        validate: (input) => input.resolutionNote.length >= 3 ? null : "A resolution note is required.",
      });
      if (!values) return;
      resolutionNote = values.resolutionNote;
    }
    setBusy(id); setError(null);
    try { await requestJson(`/api/admin/support/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status, resolutionNote }) }); await resource.refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update case."); } finally { setBusy(null); }
  }
  return <ModuleState loading={resource.loading} error={resource.error} onRetry={() => void resource.refresh()}>{resource.data && <div><div className="flex justify-between"><SectionHeader title="Support operations" description="Audited customer issue ownership and resolution lifecycle." onRefresh={() => void resource.refresh()} />{canManage && <Button loading={busy === "create"} onClick={() => void createCase()}>New case</Button>}</div>{error && <Alert tone="err" className="mb-3">{error}</Alert>}<RecordList<SupportCase>
      ariaLabel="Case"
      title="Cases"
      description={`${resource.data.cases.length} cases`}
      rows={resource.data.cases}
      rowKey={(c) => c.id}
      search={{ placeholder: "Search reference, subject, or category…", text: (c) => `${c.reference} ${c.subject} ${c.category} ${c.description}` }}
      leading={(c) => ({
        icon: <LifeBuoy size={15} strokeWidth={2} aria-hidden />,
        tone: c.status === "RESOLVED" || c.status === "CLOSED" ? "muted" : c.status === "WAITING_CUSTOMER" ? "up" : "brand",
        title: c.subject,
        secondary: <span>{c.reference} · {c.category}{c.brandDomain && <span className="ml-1.5 rounded bg-primary/10 px-1 py-px text-xs font-semibold text-primary">{c.brandDomain}</span>}</span>,
      })}
      columns={[
        { key: "priority", label: "Priority", render: (c) => (
          <RecordStatusChip tone={c.priority === "URGENT" || c.priority === "HIGH" ? "down" : "muted"}>{c.priority}</RecordStatusChip>
        ) },
        { key: "status", label: "Status", render: (c) => (
          <RecordStatusChip tone={c.status === "RESOLVED" ? "up" : c.status === "OPEN" ? "warn" : "brand"}>{c.status}</RecordStatusChip>
        ) },
        { key: "createdAt", label: "Opened", sortable: true, align: "right", render: (c) => (
          <span className="text-xs text-muted-foreground tabular-nums">{fmtAgo(c.createdAt)}</span>
        ) },
      ]}
      sortValue={(c, key) => key === "createdAt" ? new Date(c.createdAt).getTime() : String((c as unknown as Record<string, unknown>)[key] ?? "")}
      initialSort={{ key: "createdAt", direction: "desc" }}
      detailTitle="Case Detail"
      renderDetailHero={(c) => (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 px-4 py-6 text-center">
          <IdentityTile size="lg" tone={c.status === "RESOLVED" ? "muted" : "brand"}><LifeBuoy size={20} strokeWidth={2} aria-hidden /></IdentityTile>
          <div className="text-sm font-medium">{c.subject}</div>
          <div className="font-mono text-xs text-muted-foreground">{c.reference}</div>
          <RecordStatusChip tone={c.status === "RESOLVED" ? "up" : c.status === "OPEN" ? "warn" : "brand"}>{c.status}</RecordStatusChip>
        </div>
      )}
      renderDetailMeta={(c) => [
        { label: "Category", value: c.category },
        { label: "Priority", value: c.priority },
        { label: "Opened", value: fmtDateTime(c.createdAt) },
      ]}
      renderDetailExtra={(c) => (
        <div className="space-y-3">
          <div className="rounded-xl bg-muted/40 p-4">
            <div className="text-xs font-medium text-muted-foreground">Description</div>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">{c.description}</p>
          </div>
          {canManage && c.status !== "RESOLVED" && c.status !== "CLOSED" && (
            <div className="flex gap-2">
              {c.status === "OPEN" && <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => void updateCase(c.id, "IN_PROGRESS")}><UserRound size={13} strokeWidth={2} aria-hidden /> Assign to me</Button>}
              <Button type="button" size="sm" disabled={busy !== null} onClick={() => void updateCase(c.id, "RESOLVED")}><CheckCircle2 size={13} strokeWidth={2} aria-hidden /> Resolve</Button>
            </div>
          )}
        </div>
      )}
      emptyTitle="No support cases."
    />
    {commandDialog}</div>}</ModuleState>;
}

interface InstrumentRow extends Record<string, unknown> { symbol: string; name: string; category: string; active: boolean; marginPerLot: string; commissionPerLot: string; swapLongPips: string; swapShortPips: string; feedSymbol: string | null }
function InstrumentsPanel({ canManage }: { canManage: boolean }) {
  const resource = useResource<{ instruments: InstrumentRow[]; mutationPolicy: string }>("/api/admin/instruments");
  return <ModuleState loading={resource.loading} error={resource.error} onRetry={() => void resource.refresh()}>{resource.data && <div className="space-y-4"><SectionHeader title="Instrument configuration" description={resource.data.mutationPolicy} onRefresh={() => void resource.refresh()} />{canManage && <ChangeHint text="Propose instrument changes from the Approvals module; a separate reviewer must execute them." />}
    <RecordList<InstrumentRow>
      ariaLabel="Instrument"
      title="Symbols"
      description={`${resource.data.instruments.length} configured`}
      rows={resource.data.instruments}
      rowKey={(i) => i.symbol}
      search={{ placeholder: "Search symbol, name, or feed…", text: (i) => `${i.symbol} ${i.name} ${i.feedSymbol} ${i.category}` }}
      leading={(i) => ({
        icon: <InstrumentIcon symbol={i.symbol} size={18} />,
        tone: i.active ? "up" : "muted",
        title: i.symbol,
        secondary: `${i.name} · ${i.category}`,
      })}
      columns={[
        { key: "active", label: "Active", render: (i) => (
          <RecordStatusChip tone={i.active ? "up" : "muted"}>{i.active ? "Active" : "Disabled"}</RecordStatusChip>
        ) },
        { key: "marginPerLot", label: "Margin/lot", sortable: true, align: "right", render: (i) => <span className="tabular-nums">{i.marginPerLot}</span> },
        { key: "commissionPerLot", label: "Comm/lot", align: "right", render: (i) => <span className="tabular-nums">{i.commissionPerLot}</span> },
        { key: "feedSymbol", label: "Feed", render: (i) => <span className="font-mono text-xs text-muted-foreground">{i.feedSymbol}</span> },
      ]}
      sortValue={(i, key) => key === "marginPerLot" ? Number(i.marginPerLot) : String((i as unknown as Record<string, unknown>)[key] ?? "")}
      detailTitle="Instrument Detail"
      renderDetailHero={(i) => (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 px-4 py-6 text-center">
          <IdentityTile size="lg" tone={i.active ? "up" : "muted"}><InstrumentIcon symbol={i.symbol} size={30} /></IdentityTile>
          <div className="text-sm font-medium">{i.symbol}</div>
          <div className="text-xs text-muted-foreground">{i.name}</div>
          <RecordStatusChip tone={i.active ? "up" : "muted"}>{i.active ? "Active" : "Disabled"}</RecordStatusChip>
        </div>
      )}
      renderDetailMeta={(i) => [
        { label: "Category", value: i.category },
        { label: "Margin per lot", value: String(i.marginPerLot) },
        { label: "Commission per lot", value: String(i.commissionPerLot) },
        { label: "Swap long (pips)", value: String(i.swapLongPips) },
        { label: "Swap short (pips)", value: String(i.swapShortPips) },
        { label: "Feed symbol", value: <span className="font-mono text-xs">{i.feedSymbol}</span> },
      ]}
      emptyTitle="No instruments."
    />
  </div>}</ModuleState>;
}

interface RiskRuleRow extends Record<string, unknown> { id: string; code: string; name: string; severity: string; enabled: boolean; version: number; configuration: unknown; updatedAt: string }
function RiskPanel({ canManage }: { canManage: boolean }) {
  const resource = useResource<{ rules: RiskRuleRow[]; exposure: Record<string, number>; mutationPolicy: string }>("/api/admin/risk");
  return <ModuleState loading={resource.loading} error={resource.error} onRetry={() => void resource.refresh()}>{resource.data && <div className="space-y-4"><SectionHeader title="Risk controls" description={resource.data.mutationPolicy} onRefresh={() => void resource.refresh()} /><div className="flex flex-wrap gap-2">{Object.entries(resource.data.exposure).map(([key, value]) => <Badge key={key} variant="secondary">{key.replaceAll(/([A-Z])/g, " $1")}: <strong className="ml-1 tabular-nums">{value}</strong></Badge>)}</div>{canManage && <ChangeHint text="Risk changes are proposed in Approvals and become effective only after a separate checker executes them." />}
    <RecordList<RiskRuleRow>
      ariaLabel="Rule"
      title="Rules"
      description={`${resource.data.rules.length} rules`}
      rows={resource.data.rules}
      rowKey={(r) => r.id}
      search={{ placeholder: "Search code, name, or severity…", text: (r) => `${r.code} ${r.name} ${r.severity}` }}
      leading={(r) => ({
        icon: <ShieldAlert size={15} strokeWidth={2} aria-hidden />,
        tone: r.severity === "CRITICAL" ? "down" : r.severity === "HIGH" ? "warn" : "muted",
        title: r.name,
        secondary: r.code,
      })}
      columns={[
        { key: "severity", label: "Severity", render: (r) => (
          <RecordStatusChip tone={r.severity === "CRITICAL" ? "down" : r.severity === "HIGH" ? "warn" : "muted"}>{r.severity}</RecordStatusChip>
        ) },
        { key: "enabled", label: "State", render: (r) => (
          <RecordStatusChip tone={r.enabled ? "up" : "muted"}>{r.enabled ? "Enabled" : "Disabled"}</RecordStatusChip>
        ) },
        { key: "version", label: "Version", sortable: true, align: "right", render: (r) => <span className="tabular-nums">v{r.version}</span> },
        { key: "updatedAt", label: "Updated", sortable: true, align: "right", render: (r) => (
          <span className="text-xs text-muted-foreground tabular-nums">{fmtAgo(r.updatedAt)}</span>
        ) },
      ]}
      sortValue={(r, key) => key === "version" ? r.version : key === "updatedAt" ? new Date(r.updatedAt).getTime() : String((r as unknown as Record<string, unknown>)[key] ?? "")}
      detailTitle="Rule Detail"
      renderDetailHero={(r) => (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 px-4 py-6 text-center">
          <IdentityTile size="lg" tone={r.severity === "CRITICAL" ? "down" : r.severity === "HIGH" ? "warn" : "muted"}><ShieldAlert size={20} strokeWidth={2} aria-hidden /></IdentityTile>
          <div className="text-sm font-medium">{r.name}</div>
          <div className="font-mono text-xs text-muted-foreground">{r.code}</div>
          <RecordStatusChip tone={r.enabled ? "up" : "muted"}>{r.enabled ? "Enabled" : "Disabled"}</RecordStatusChip>
        </div>
      )}
      renderDetailMeta={(r) => [
        { label: "Severity", value: r.severity },
        { label: "Version", value: `v${r.version}` },
        { label: "Updated", value: fmtDateTime(r.updatedAt) },
      ]}
      renderDetailExtra={(r) => (
        <div className="rounded-xl bg-muted/40 p-4">
          <div className="text-xs font-medium text-muted-foreground">Configuration</div>
          <pre className="mt-2 overflow-auto rounded-lg bg-card p-3 text-xs">{JSON.stringify(r.configuration, null, 2)}</pre>
        </div>
      )}
      emptyTitle="No risk rules."
    />
  </div>}</ModuleState>;
}

interface AuditEventRow extends Record<string, unknown> { sequence: string; domain: string; action: string; entityType: string; entityId: string | null; actorId: string | null; createdAt: string; metadata: unknown; eventHash: string }
function AuditPanel({ canVerify, canExport }: { canVerify: boolean; canExport: boolean }) {
  const resource = useResource<{ events: AuditEventRow[]; redacted: boolean }>("/api/admin/audit?limit=150");
  async function verify() { try { const result = await requestJson<{ valid: boolean; checkedEvents: number }>("/api/admin/audit/verify", { method: "POST" }); toast.success(`Chain ${result.valid ? "valid" : "invalid"}`, `Checked ${result.checkedEvents} events.`); await resource.refresh(); } catch (cause) { toast.error("Verification failed", cause instanceof Error ? cause.message : "Verification failed."); } }
  return <ModuleState loading={resource.loading} error={resource.error} onRetry={() => void resource.refresh()}>{resource.data && <div><div className="flex flex-wrap items-start justify-between gap-3"><SectionHeader title="Immutable audit trail" description="Full-domain event stream with export redaction and cryptographic chain verification." onRefresh={() => void resource.refresh()} /><div className="flex gap-2">{canVerify && <Button type="button" size="sm" onClick={() => void verify()}><ShieldCheck size={13} strokeWidth={2} aria-hidden /> Verify chain</Button>}{canExport && <Button type="button" size="sm" variant="outline" asChild><a href="/api/admin/audit/export?format=csv&limit=500"><Download size={13} strokeWidth={2} aria-hidden /> Export CSV</a></Button>}</div></div><RecordList<AuditEventRow>
      ariaLabel="Event"
      title="Events"
      description={`${resource.data.events.length} events${resource.data.redacted ? " · export-redacted view" : ""}`}
      rows={resource.data.events}
      rowKey={(e) => String(e.sequence)}
      search={{ placeholder: "Search domain, action, entity, or actor…", text: (e) => `${e.domain} ${e.action} ${e.entityType} ${e.entityId ?? ""} ${e.actorId ?? ""}` }}
      leading={(e) => ({
        icon: <ScrollText size={15} strokeWidth={2} aria-hidden />,
        tone: e.domain === "ADMIN" ? "brand" : "muted",
        title: e.action.replaceAll(/([A-Z])/g, " $1").toLowerCase(),
        secondary: `${e.domain} · ${e.entityType}${e.entityId ? ` ${e.entityId.slice(0, 10)}…` : ""}`,
      })}
      columns={[
        { key: "actorId", label: "Actor", render: (e) => <span className="font-mono text-xs text-muted-foreground">{e.actorId ?? "system"}</span> },
        { key: "createdAt", label: "Recorded", sortable: true, align: "right", render: (e) => (
          <span className="text-xs text-muted-foreground tabular-nums">{fmtDateTime(e.createdAt)}</span>
        ) },
      ]}
      sortValue={(e, key) => key === "createdAt" ? new Date(e.createdAt).getTime() : String((e as unknown as Record<string, unknown>)[key] ?? "")}
      initialSort={{ key: "createdAt", direction: "desc" }}
      detailTitle="Event Detail"
      renderDetailHero={(e) => (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 px-4 py-6 text-center">
          <IdentityTile size="lg" tone={e.domain === "ADMIN" ? "brand" : "muted"}><ScrollText size={20} strokeWidth={2} aria-hidden /></IdentityTile>
          <div className="text-sm font-medium">{e.action.replaceAll(/([A-Z])/g, " $1").toLowerCase()}</div>
          <div className="text-xs text-muted-foreground">{e.domain} · sequence {e.sequence}</div>
        </div>
      )}
      renderDetailMeta={(e) => [
        { label: "Entity", value: `${e.entityType}${e.entityId ? ` · ${e.entityId}` : ""}` },
        { label: "Actor", value: <span className="font-mono text-xs">{e.actorId ?? "system"}</span> },
        { label: "Recorded", value: fmtDateTime(e.createdAt) },
        { label: "Event hash", value: <span className="font-mono text-xs">{e.eventHash.slice(0, 16)}…</span> },
      ]}
      renderDetailExtra={(e) => (
        <div className="rounded-xl bg-muted/40 p-4">
          <div className="text-xs font-medium text-muted-foreground">Metadata</div>
          <pre className="mt-2 overflow-auto rounded-lg bg-card p-3 text-xs">{JSON.stringify(e.metadata, null, 2)}</pre>
        </div>
      )}
      emptyTitle="No audit events."
    /></div>}</ModuleState>;
}

interface HealthResponse {
  status: "HEALTHY" | "DEGRADED";
  checkedAt: string;
  simulationOnly: boolean;
  executionProvider: string;
  marketDataMode: string;
  services: {
    database: { status: string; latencyMs: number; error: string | null };
    redis: { status: string; latencyMs: number; error: string | null };
    engine: { status: string; instrumentsLoaded: number };
  };
  reconciliation: { status: string; startedAt?: string; completedAt?: string | null; activeBlocks?: Array<{ reason: string }>; errorMessage?: string | null };
}
function HealthPanel() {
  const resource = useResource<HealthResponse>("/api/admin/service-health");
  return <ModuleState loading={resource.loading} error={resource.error} onRetry={() => void resource.refresh()}>{resource.data && (
    <div>
      <SectionHeader title="Service health" description={`Checked ${fmtAgo(resource.data.checkedAt)} · provider ${resource.data.executionProvider} · market data ${resource.data.marketDataMode}.`} onRefresh={() => void resource.refresh()} />
      <div className="mb-4 flex items-center gap-2.5 rounded-xl bg-card p-4 shadow-sm">
        <span className={`h-3 w-3 rounded-full ${resource.data.status === "HEALTHY" ? "bg-up" : "bg-down"}`} aria-hidden />
        <span className="text-sm font-semibold">{resource.data.status === "HEALTHY" ? "All systems operational" : "Degraded — one or more services are down"}</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <HealthCard name="Database" status={resource.data.services.database.status} latencyMs={resource.data.services.database.latencyMs} error={resource.data.services.database.error} detail="PostgreSQL · Prisma" />
        <HealthCard name="Redis" status={resource.data.services.redis.status} latencyMs={resource.data.services.redis.latencyMs} error={resource.data.services.redis.error} detail="Throttles, queues, pub/sub" />
        <HealthCard name="Trading engine" status={resource.data.services.engine.status} detail={`${resource.data.services.engine.instrumentsLoaded} instruments loaded`} />
        <HealthCard
          name="Reconciliation"
          status={resource.data.reconciliation.status === "COMPLETED" ? "UP" : resource.data.reconciliation.status === "RUNNING" ? "STARTING" : "DOWN"}
          detail={
            resource.data.reconciliation.status === "NEVER_RUN"
              ? "Never run"
              : `${resource.data.reconciliation.status}${resource.data.reconciliation.completedAt ? ` · ${fmtAgo(resource.data.reconciliation.completedAt)}` : ""}`
          }
          error={resource.data.reconciliation.errorMessage ?? null}
        />
      </div>
    </div>
  )}</ModuleState>;
}

function HealthCard({ name, status, latencyMs, detail, error }: { name: string; status: string; latencyMs?: number; detail?: string; error?: string | null }) {
  const tone = status === "UP" ? "text-up" : status === "STARTING" ? "text-primary" : "text-down";
  const dot = status === "UP" ? "bg-up" : status === "STARTING" ? "bg-brand" : "bg-down";
  return (
    <Card className="py-5">
      <CardContent className="grid gap-1.5 px-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{name}</p>
          <span className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
            <span className={`text-xs font-bold ${tone}`}>{status}</span>
          </span>
        </div>
        {latencyMs != null && <p className="mt-1 text-lg font-semibold tabular-nums">{latencyMs}<span className="ml-0.5 text-xs font-normal text-muted-foreground">ms</span></p>}
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
        {error && <p className="text-xs text-down">{error}</p>}
      </CardContent>
    </Card>
  );
}

interface ChangeRow extends Record<string, unknown> {
  id: string;
  domain: string;
  action: string;
  entityType: string;
  entityId: string | null;
  status: string;
  requestedById: string;
  reviewedById: string | null;
  payload: unknown;
  createdAt: string;
  canReview: boolean;
}

type ChangeAction = "ASSIGN_ROLE" | "REVOKE_ROLE" | "UPDATE_RISK_RULE" | "UPDATE_INSTRUMENT";

function ChangesPanel({
  prefill,
  onPrefillHandled,
  canProposeAccess,
  canProposeRisk,
  canProposeInstrument,
}: {
  /** Role change preselected from the Users tab (cleared after first submit). */
  prefill?: { userId: string; label: string; action: "ASSIGN_ROLE" | "REVOKE_ROLE" } | null;
  onPrefillHandled?: () => void;
  canProposeAccess: boolean;
  canProposeRisk: boolean;
  canProposeInstrument: boolean;
}) {
  const resource = useResource<{ requests: ChangeRow[] }>("/api/admin/change-requests?limit=150");
  const { openCommand, commandDialog } = useCommandDialog();

  async function review(id: string, decision: "APPROVE" | "REJECT") {
    const values = await openCommand({
      title: `${decision === "APPROVE" ? "Approve" : "Reject"} change request`,
      description: "Your checker decision and note are permanently audit chained.",
      confirmLabel: decision === "APPROVE" ? "Approve request" : "Reject request",
      danger: decision === "REJECT",
      fields: [{ name: "note", label: `${decision === "APPROVE" ? "Approval" : "Rejection"} note`, type: "textarea", required: true, minLength: 3, maxLength: 1000 }],
      validate: (input) => input.note.length >= 3 ? null : "A review note of at least three characters is required.",
    });
    if (!values) return;
    const note = values.note;
    try {
      await requestJson(`/api/admin/change-requests/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, note }),
      });
      toast.success(`Request ${decision.toLowerCase()}d`);
      await resource.refresh();
    } catch (cause) {
      toast.error("Review failed", cause instanceof Error ? cause.message : "Review failed.");
    }
  }

  return (
    <ModuleState loading={resource.loading} error={resource.error} onRetry={() => void resource.refresh()}>
      {resource.data && (
        <div className="space-y-4">
          <SectionHeader
            title="Maker-checker approvals"
            description="Access, risk, and instrument changes require a different authorized reviewer. Command keys make submissions replay-safe."
            onRefresh={() => void resource.refresh()}
          />
          {(canProposeAccess || canProposeRisk || canProposeInstrument) && (
            <ChangeRequestComposer
              prefill={prefill}
              onPrefillHandled={onPrefillHandled}
              canProposeAccess={canProposeAccess}
              canProposeRisk={canProposeRisk}
              canProposeInstrument={canProposeInstrument}
              onCreated={async () => {
                toast.success("Change request created", "Awaiting a separate checker.");
                await resource.refresh();
              }}
            />
          )}
          <RecordList<ChangeRow>
            ariaLabel="Request"
            title="Change requests"
            description={`${resource.data.requests.length} requests`}
            rows={resource.data.requests}
            rowKey={(r) => r.id}
            search={{ placeholder: "Search domain, action, or entity…", text: (r) => `${r.domain} ${r.action} ${r.entityType} ${r.entityId ?? ""} ${r.requestedById}` }}
            leading={(r) => ({
              icon: <ClipboardCheck size={15} strokeWidth={2} aria-hidden />,
              tone: r.status === "PENDING" ? "warn" : r.status === "APPROVED" ? "up" : "down",
              title: r.action.replaceAll(/([A-Z])/g, " $1").toLowerCase(),
              secondary: `${r.domain} · ${r.entityType}${r.entityId ? ` ${r.entityId.slice(0, 8)}…` : ""}`,
            })}
            columns={[
              { key: "status", label: "Status", render: (r) => (
                <RecordStatusChip tone={r.status === "PENDING" ? "warn" : r.status === "APPROVED" ? "up" : "down"}>{r.status}</RecordStatusChip>
              ) },
              { key: "createdAt", label: "Proposed", sortable: true, align: "right", render: (r) => (
                <span className="text-xs text-muted-foreground tabular-nums">{fmtAgo(r.createdAt)}</span>
              ) },
            ]}
            sortValue={(r, key) => key === "createdAt" ? new Date(r.createdAt).getTime() : String((r as unknown as Record<string, unknown>)[key] ?? "")}
            initialSort={{ key: "createdAt", direction: "desc" }}
            detailTitle="Change Request"
            renderDetailHero={(r) => (
              <div className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 px-4 py-6 text-center">
                <IdentityTile size="lg" tone={r.status === "PENDING" ? "warn" : r.status === "APPROVED" ? "up" : "down"}><ClipboardCheck size={20} strokeWidth={2} aria-hidden /></IdentityTile>
                <div className="text-sm font-medium">{r.action.replaceAll(/([A-Z])/g, " $1").toLowerCase()}</div>
                <div className="text-xs text-muted-foreground">{r.domain} · {r.entityType}</div>
                <RecordStatusChip tone={r.status === "PENDING" ? "warn" : r.status === "APPROVED" ? "up" : "down"}>{r.status}</RecordStatusChip>
              </div>
            )}
            renderDetailMeta={(r) => [
              { label: "Entity", value: `${r.entityType}${r.entityId ? ` · ${r.entityId}` : ""}` },
              { label: "Maker", value: r.requestedById },
              ...(r.reviewedById ? [{ label: "Checker", value: r.reviewedById }] : []),
              { label: "Proposed", value: fmtDateTime(r.createdAt) },
            ]}
            renderDetailExtra={(r) => (
              <div className="space-y-3">
                <div className="rounded-xl bg-muted/40 p-4">
                  <div className="text-xs font-medium text-muted-foreground">Payload</div>
                  <pre className="mt-2 overflow-auto rounded-lg bg-card p-3 text-xs">{JSON.stringify(r.payload, null, 2)}</pre>
                </div>
                {r.canReview && r.status === "PENDING" && (
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" className="text-down" onClick={() => void review(r.id, "REJECT")}><Ban size={13} strokeWidth={2} aria-hidden /> Reject</Button>
                    <Button type="button" size="sm" onClick={() => void review(r.id, "APPROVE")}><CheckCircle2 size={13} strokeWidth={2} aria-hidden /> Approve</Button>
                  </div>
                )}
              </div>
            )}
            emptyTitle="No change requests."
          />
          {commandDialog}
        </div>
      )}
    </ModuleState>
  );
}

function ChangeRequestComposer({
  prefill,
  onPrefillHandled,
  canProposeAccess,
  canProposeRisk,
  canProposeInstrument,
  onCreated,
}: {
  prefill?: { userId: string; label: string; action: "ASSIGN_ROLE" | "REVOKE_ROLE" } | null;
  onPrefillHandled?: () => void;
  canProposeAccess: boolean;
  canProposeRisk: boolean;
  canProposeInstrument: boolean;
  onCreated: () => Promise<void>;
}) {
  const allowedActions: ChangeAction[] = [
    ...(canProposeAccess ? (["ASSIGN_ROLE", "REVOKE_ROLE"] as ChangeAction[]) : []),
    ...(canProposeRisk ? (["UPDATE_RISK_RULE"] as ChangeAction[]) : []),
    ...(canProposeInstrument ? (["UPDATE_INSTRUMENT"] as ChangeAction[]) : []),
  ];
  // Prefill from the Users tab: preselect the action and seed the target's
  // user ID so the maker only picks the role and submits.
  const [action, setAction] = useState<ChangeAction>(
    prefill && allowedActions.includes(prefill.action) ? prefill.action : allowedActions[0] ?? "ASSIGN_ROLE",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const change = buildChangeRequest(action, form);
      await requestJson("/api/admin/change-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          commandKey: `admin-change-${crypto.randomUUID()}`,
          requestNote: String(form.get("requestNote") ?? "").trim() || undefined,
          change,
        }),
      });
      event.currentTarget.reset();
      onPrefillHandled?.();
      await onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create change request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl bg-card p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="change-action" className="text-xs font-medium text-muted-foreground">Change type</Label>
          <Select value={action} onValueChange={(value) => setAction(value as ChangeAction)}>
            <SelectTrigger id="change-action" className="mt-1 h-9 w-full" startIcon={<ClipboardCheck size={13} strokeWidth={2} aria-hidden />}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allowedActions.map((item) => <SelectItem key={item} value={item}>{item.replaceAll("_", " ").toLowerCase()}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="request-note" className="text-xs font-medium text-muted-foreground">Request note</Label>
          <Input id="request-note" name="requestNote" maxLength={1000} className="mt-1" placeholder="Operational reason and ticket reference" startIcon={<FileText size={13} strokeWidth={2} aria-hidden />} />
        </div>
      </div>
      {(action === "ASSIGN_ROLE" || action === "REVOKE_ROLE") && <RoleChangeFields userId={prefill?.userId} label={prefill?.label} />}
      {action === "UPDATE_RISK_RULE" && <RiskChangeFields />}
      {action === "UPDATE_INSTRUMENT" && <InstrumentChangeFields />}
      {error && <Alert tone="err" className="mt-3">{error}</Alert>}
      <Button type="submit" loading={busy} loadingLabel="Creating change request" className="mt-3 bg-primary text-primary-foreground">Submit for approval</Button>
    </form>
  );
}

function RoleChangeFields({ userId, label }: { userId?: string; label?: string }) {
  return (
    <div className="mt-3 grid gap-3 md:grid-cols-3">
      <FieldInput name="userId" label={label ? `Target user (${label})` : "Target user ID"} defaultValue={userId} required startIcon={<UserRound size={13} strokeWidth={2} aria-hidden />} />
      <div>
        <Label htmlFor="change-role" className="text-xs font-medium text-muted-foreground">Role</Label>
        <Select name="role" defaultValue="SUPPORT">
          <SelectTrigger id="change-role" className="mt-1 h-9 w-full" startIcon={<ShieldAlert size={13} strokeWidth={2} aria-hidden />}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["SUPER_ADMIN", "COMPLIANCE", "FINANCE", "DEALER", "RISK", "SUPPORT", "AUDITOR"].map((role) => <SelectItem key={role} value={role}>{role.toLowerCase()}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <FieldInput name="reason" label="Reason" required startIcon={<FileText size={13} strokeWidth={2} aria-hidden />} />
    </div>
  );
}

function RiskChangeFields() {
  return (
    <div className="mt-3 grid gap-3 md:grid-cols-3">
      <FieldInput name="code" label="Rule code" placeholder="MAX_ORDER_VOLUME" required startIcon={<ShieldAlert size={13} strokeWidth={2} aria-hidden />} />
      <FieldInput name="name" label="Rule name" required startIcon={<Tag size={13} strokeWidth={2} aria-hidden />} />
      <Label className="text-xs">Severity
        <NativeSelect name="severity" className="mt-1" defaultValue="WARNING">
          <option>INFO</option><option>WARNING</option><option>BLOCKING</option>
        </NativeSelect>
      </Label>
      <FieldInput name="description" label="Description" required startIcon={<FileText size={13} strokeWidth={2} aria-hidden />} />
      <FieldInput name="configuration" label="Configuration JSON" placeholder='{"maxLots":"50"}' required startIcon={<Braces size={13} strokeWidth={2} aria-hidden />} />
      <Label className="flex items-center gap-2 self-end pb-2 text-xs"><Checkbox name="enabled" defaultChecked /> Enabled</Label>
    </div>
  );
}

function InstrumentChangeFields() {
  return (
    <div className="mt-3 grid gap-3 md:grid-cols-3">
      <FieldInput name="symbol" label="Symbol" placeholder="EURUSD" required startIcon={<CandlestickChart size={13} strokeWidth={2} aria-hidden />} />
      <FieldInput name="marginPerLot" label="Margin per lot" type="number" step="0.00000001" required startIcon={<Coins size={13} strokeWidth={2} aria-hidden />} />
      <FieldInput name="commissionPerLot" label="Commission per lot" type="number" step="0.00000001" required startIcon={<Percent size={13} strokeWidth={2} aria-hidden />} />
      <FieldInput name="swapLongPips" label="Long swap pips" type="number" step="0.00000001" required startIcon={<TrendingUp size={13} strokeWidth={2} aria-hidden />} />
      <FieldInput name="swapShortPips" label="Short swap pips" type="number" step="0.00000001" required startIcon={<TrendingDown size={13} strokeWidth={2} aria-hidden />} />
      <Label className="flex items-center gap-2 self-end pb-2 text-xs"><Checkbox name="active" defaultChecked /> Active</Label>
    </div>
  );
}

function FieldInput({ name, label, startIcon, ...props }: { name: string; label: string; startIcon?: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Input id={id} name={name} className="mt-1" startIcon={startIcon} {...props} />
    </div>
  );
}

function buildChangeRequest(action: ChangeAction, form: FormData): Record<string, unknown> {
  const text = (name: string) => String(form.get(name) ?? "").trim();
  if (action === "ASSIGN_ROLE" || action === "REVOKE_ROLE") {
    const userId = text("userId");
    return { action, domain: "ACCESS", entityType: "User", entityId: userId, payload: { userId, role: text("role"), reason: text("reason") } };
  }
  if (action === "UPDATE_RISK_RULE") {
    const code = text("code").toUpperCase();
    let configuration: unknown;
    try { configuration = JSON.parse(text("configuration")); } catch { throw new Error("Risk configuration must be valid JSON."); }
    return {
      action,
      domain: "RISK",
      entityType: "RiskRule",
      entityId: code,
      payload: { code, name: text("name"), description: text("description"), severity: text("severity"), enabled: form.get("enabled") === "on", configuration },
    };
  }
  const symbol = text("symbol").toUpperCase();
  return {
    action,
    domain: "INSTRUMENT",
    entityType: "Instrument",
    entityId: symbol,
    payload: {
      symbol,
      active: form.get("active") === "on",
      marginPerLot: text("marginPerLot"),
      commissionPerLot: text("commissionPerLot"),
      swapLongPips: text("swapLongPips"),
      swapShortPips: text("swapShortPips"),
    },
  };
}

function ChangeHint({ text }: { text: string }) { return <Alert tone="info" className="mb-3">{text}</Alert>; }

