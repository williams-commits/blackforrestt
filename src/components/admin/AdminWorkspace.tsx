"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KycReview } from "./KycReview";
import { PaymentsReview, type PaymentRequestRow } from "./PaymentsReview";
import { ReconciliationReview } from "./ReconciliationReview";
import { AdminUserActions } from "./AdminUserActions";
import { AdminMessages } from "./AdminMessages";
import { GroupsPanel } from "./GroupsPanel";
import { SettingsForm, type UserSettingsConfig } from "./SettingsForm";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { Dialog } from "@/components/ui/Dialog";
import { useCommandDialog } from "@/components/ui/useCommandDialog";
import { ScrollFade } from "@/components/ui/ScrollFade";
import { Skeleton } from "@/components/ui/Skeleton";
import { Th, TableSearch, FilterChip, type SortDirection } from "@/components/ui/DataTable";
import { CsvExportButton } from "@/components/ui/CsvExport";
import { createDeviceId } from "@/lib/device";
import { fmtAgo, fmtDateTime } from "@/lib/dates";
import { toast } from "@/lib/toast";

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
  const refresh = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!options.silent && !hasDataRef.current) setLoading(true);
    setError(null);
    try {
      const result = await requestJson<T>(url);
      hasDataRef.current = true;
      setData(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load module.");
    } finally {
      setLoading(false);
    }
  }, [url]);
  useEffect(() => { void refresh(); }, [refresh]);
  // Optional silent polling so the panel stays in sync with the database.
  useEffect(() => {
    if (!pollMs) return;
    const timer = window.setInterval(() => void refresh({ silent: true }), pollMs);
    return () => window.clearInterval(timer);
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
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) void badges.refresh({ silent: true });
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [badges]);
  const badgeFor = (key: TabKey): number | null => {
    const stats = badges.data?.stats;
    if (!stats) return null;
    if (key === "kyc" && stats.pendingKyc) return stats.pendingKyc;
    if (key === "payments" && stats.pendingPayments) return stats.pendingPayments;
    if (key === "changes" && stats.pendingChanges) return stats.pendingChanges;
    return null;
  };

  const can = useCallback((permission: Permission) => permissions.includes(permission), [permissions]);

  const tabButton = (item: { key: TabKey; label: string }, sidebar: boolean) => {
    const active = tab === item.key;
    const badge = badgeFor(item.key);
    return (
      <button
        key={item.key}
        type="button"
        onClick={() => setTab(item.key)}
        aria-current={active ? "page" : undefined}
        className={`flex items-center gap-2 whitespace-nowrap text-xs font-medium transition ${
          sidebar
            ? `w-full rounded-md px-3 py-2 text-left ${active ? "bg-brand-soft text-brand" : "text-text-muted hover:bg-panel-2 hover:text-text"}`
            : `border-b-2 px-3 py-2.5 ${active ? "border-brand text-brand" : "border-transparent text-text-muted hover:text-text"}`
        }`}
      >
        <span>{item.label}</span>
        {badge != null && badge > 0 && (
          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${active ? "bg-brand text-white" : "bg-brand-soft text-brand"}`}>
            {badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border bg-canvas p-4 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Enterprise operations console</h1>
            <p className="mt-1 text-xs text-text-muted">Signed in as {userName}. Every command is role-gated and audit chained.</p>
          </div>
          <div className="flex flex-wrap justify-end gap-1.5" aria-label="Active administrative roles">
            {roles.map((role) => <span key={role} className="rounded bg-brand-soft px-2 py-1 text-[10px] font-semibold text-brand">{role.replaceAll("_", " ")}</span>)}
          </div>
        </div>
      </section>

      <div className="lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-5">
        {/* Desktop: grouped vertical sidebar. Mobile/tablet: horizontal pills. */}
        <nav aria-label="Administrative modules" className="hidden lg:block">
          <div className="sticky top-20 space-y-4 rounded-lg border border-border bg-canvas p-3">
            {NAV_SECTIONS.map((section) => {
              const items = allowedTabs.filter((t) => section.tabs.includes(t.key));
              if (items.length === 0) return null;
              return (
                <div key={section.label}>
                  <p className="mb-1 px-3 text-[9px] font-bold uppercase tracking-wider text-text-faint">{section.label}</p>
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
      {tab === "users" && <UsersPanel canAdjustBalance={can("USER_BALANCE_ADJUST")} canManage={can("USER_ACCESS_MANAGE")} onOpenChat={(user) => { setChatWith({ userId: user.id, label: user.name ?? user.email ?? user.id }); setTab("messages"); }} />}
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
      <div role="status" aria-label="Loading module" className="space-y-3 rounded-lg border border-border bg-canvas p-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-3 w-72" />
        <div className="space-y-2 pt-2">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
        </div>
      </div>
    );
  }
  if (error) return <div role="alert" className="rounded-lg border border-down/30 bg-down/10 p-4 text-sm text-down">{error}<Button type="button" size="sm" variant="ghost" onClick={onRetry} className="ml-3">Retry</Button></div>;
  return <>{children}</>;
}

function SectionHeader({ title, description, onRefresh }: { title: string; description: string; onRefresh?: () => void }) {
  return <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-semibold">{title}</h2><p className="mt-1 text-xs text-text-muted">{description}</p></div>{onRefresh && <button type="button" onClick={onRefresh} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-panel-2">Refresh</button>}</div>;
}

interface OverviewResponse {
  environment: { simulationOnly: boolean; executionProvider: string; marketDataMode: string };
  stats: Record<string, number>;
}
function OverviewPanel() {
  const resource = useResource<OverviewResponse>("/api/admin/overview", 15_000);
  return <ModuleState loading={resource.loading} error={resource.error} onRetry={() => void resource.refresh()}>{resource.data && <div className="space-y-4"><div className="rounded-lg border border-brand/30 bg-brand-soft p-3 text-xs text-brand"><strong>Environment.</strong> Execution provider: {resource.data.environment.executionProvider}; market data: {resource.data.environment.marketDataMode}.</div><div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{Object.entries(resource.data.stats).map(([key, value]) => <div key={key} className="rounded-lg border border-border bg-canvas p-4"><div className="text-[10px] uppercase text-text-faint">{key.replaceAll(/([A-Z])/g, " $1")}</div><div className="mt-1 text-2xl font-semibold tnum">{value.toLocaleString("en-US")}</div></div>)}</div></div>}</ModuleState>;
}

interface UserRow {
  id: string; email: string | null; name: string | null; accountNo: string | null; verified: boolean;
  lockedUntil: string | null; mfaEnabledAt: string | null; createdAt: string;
  isAdmin: boolean; suspendedAt: string | null; blockedAt: string | null; deletedAt: string | null;
  /** Live presence — user has an open WebSocket right now. */
  online: boolean;
  adminRoles: Array<{ role: string }>;
  kyc: { status: string } | null;
  metrics: { balance: string; equity: string; floatingPl: string; marginLevel: string | null } | null;
  _count: { positions: number; securitySessions: number; reconciliationBlocks: number };
}
function UsersPanel({ canAdjustBalance, canManage, onOpenChat }: { canAdjustBalance: boolean; canManage: boolean; onOpenChat: (user: UserRow) => void }) {
  // Search behaves like the messages inbox: filtering is INSTANT over the
  // loaded rows (same fields as the API matches — email, name, account), so
  // the table responds on every keystroke. The debounced server query then
  // refreshes the authoritative result set across the whole user base without
  // flashing a loading state (stale-while-revalidate in useResource).
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const url = `/api/admin/users?limit=1000${debouncedSearch ? `&q=${encodeURIComponent(debouncedSearch)}` : ""}`;

  const resource = useResource<{ users: UserRow[]; total: number }>(url, 15_000);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [settingsUser, setSettingsUser] = useState<UserRow | null>(null);

  const needle = search.trim().toLowerCase();
  const users = useMemo(() => {
    const rows = resource.data?.users ?? [];
    if (!needle) return rows;
    return rows.filter((user) =>
      (user.email ?? "").toLowerCase().includes(needle) ||
      (user.name ?? "").toLowerCase().includes(needle) ||
      (user.accountNo ?? "").includes(needle),
    );
  }, [resource.data, needle]);
  const searchPending = search.trim() !== debouncedSearch;
  const truncated = resource.data ? resource.data.total > resource.data.users.length : false;
  return (
    <ModuleState loading={resource.loading} error={resource.error} onRetry={() => void resource.refresh()}>
      {resource.data ? (
        <div>
          <SectionHeader title="Users and access" description="Identity, verification, account exposure, active roles, sessions, reconciliation restrictions, and audited balance operations." onRefresh={() => void resource.refresh()} />
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <TableSearch value={search} onChange={setSearch} placeholder="Search email, name, or account number…" label="Search users" />
            {needle && (
              <span className="text-[10px] text-text-faint tnum" aria-live="polite">
                {users.length} match{users.length === 1 ? "" : "es"}{searchPending ? " · searching…" : ""}
              </span>
            )}
            {truncated && !debouncedSearch && (
              <span className="text-[10px] text-brand">showing first {resource.data.users.length} of {resource.data.total} — refine your search</span>
            )}
          </div>
          <PaginatedUsers
            users={users}
            emptyLabel={needle ? `No users match “${search.trim()}”.` : undefined}
            canAdjustBalance={canAdjustBalance}
            canManage={canManage}
            onManageBalance={setSelectedUser}
            onEditSettings={setSettingsUser}
            onOpenChat={onOpenChat}
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
  users,
  emptyLabel,
  canAdjustBalance,
  canManage,
  onManageBalance,
  onEditSettings,
  onOpenChat,
  onChanged,
}: {
  users: UserRow[];
  /** Shown when the list is empty — lets an active search say "no match". */
  emptyLabel?: string;
  canAdjustBalance: boolean;
  canManage: boolean;
  onManageBalance: (user: UserRow) => void;
  onEditSettings: (user: UserRow) => void;
  onOpenChat: (user: UserRow) => void;
  onChanged: () => void;
}) {
  const pageSize = 25;
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: string; direction: SortDirection }>({ key: "createdAt", direction: "desc" });

  const sortedUsers = useMemo(() => {
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...users].sort((a, b) => {
      switch (sort.key) {
        case "name": return ((a.name ?? "")).localeCompare(b.name ?? "") * dir;
        case "balance": return (Number(a.metrics?.balance ?? 0) - Number(b.metrics?.balance ?? 0)) * dir;
        case "equity": return (Number(a.metrics?.equity ?? 0) - Number(b.metrics?.equity ?? 0)) * dir;
        case "positions": return (a._count.positions - b._count.positions) * dir;
        default: return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
      }
    });
  }, [users, sort]);

  const onSort = (key: string) => {
    setSort((prev) =>
      prev.key === key
        ? { key: prev.key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "desc" },
    );
  };

  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleUsers = sortedUsers.slice((safePage - 1) * pageSize, safePage * pageSize);
  // Only reset page if the data changed in a way that invalidates the current page
  // (not on every silent poll refresh which would yank the admin back to page 1).
  useEffect(() => {
    if (safePage > totalPages) setPage(1);
  }, [safePage, totalPages]);

  const csvRows = sortedUsers.map((u) => [
    u.name ?? "Unnamed", u.email ?? "", u.accountNo ?? "", u.verified ? "Verified" : "Unverified",
    u.kyc?.status ?? "", u.mfaEnabledAt ? "MFA on" : "MFA off",
    u.adminRoles.map((r) => r.role).join("; "), Number(u.metrics?.balance ?? 0).toFixed(2),
    Number(u.metrics?.equity ?? 0).toFixed(2), u._count.positions, fmtDateTime(u.createdAt),
  ]);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-canvas">
      <div className="flex min-h-9 items-center gap-2 border-b border-border bg-panel-2 px-3 py-1.5">
        <span className="text-[10px] text-text-faint tnum">{sortedUsers.length} users</span>
        <CsvExportButton
          filename="users"
          columns={["Name", "Email", "Account", "Status", "KYC", "Security", "Roles", "Balance", "Equity", "Positions", "Created"]}
          rows={csvRows}
          disabled={sortedUsers.length === 0}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-275 text-left text-xs">
          <thead className="bg-panel-2 text-text-muted"><tr>
            <Th sortKey="name" sort={sort} onSort={onSort}>Account</Th>
            <Th>Verification</Th><Th>Security</Th><Th>Roles</Th>
            <Th sortKey="balance" sort={sort} onSort={onSort} align="right">Balance</Th>
            <Th sortKey="equity" sort={sort} onSort={onSort} align="right">Equity</Th>
            <Th sortKey="positions" sort={sort} onSort={onSort}>Activity</Th>
            <Th align="right">Actions</Th>
          </tr></thead>
          <tbody>
            {visibleUsers.map((user) => (
              <tr key={user.id} className="border-t border-border">
                <td className="p-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${user.online ? "bg-up" : "bg-panel-3"}`}
                      title={user.online ? "Online — live session" : "Offline"}
                      aria-label={user.online ? "Online" : "Offline"}
                    />
                    <span className="font-medium">{user.name ?? "Unnamed"}</span>
                  </div>
                  <div className="text-text-faint">{user.email ?? "—"} · #{user.accountNo ?? "—"}</div>
                </td>
                <td className="p-2">{user.kyc?.status ?? "NOT SUBMITTED"}<div className={user.verified ? "text-up" : "text-text-faint"}>{user.verified ? "Verified" : "Unverified"}</div></td>
                <td className="p-2">MFA {user.mfaEnabledAt ? "enabled" : "off"}<div className={user.lockedUntil ? "text-down" : "text-text-faint"}>{user.lockedUntil ? "Locked" : `${user._count.securitySessions} session(s)`}</div></td>
                <td className="p-2">{user.adminRoles.length ? user.adminRoles.map((role) => role.role).join(", ") : "Customer"}</td>
                <td className="p-2 text-right tnum">{formatUsd(user.metrics?.balance ?? "0")}</td>
                <td className="p-2 text-right tnum">{formatUsd(user.metrics?.equity ?? "0")}</td>
                <td className="p-2">
                  <div className={user._count.positions > 0 ? "font-medium text-up" : ""}>
                    {user._count.positions} open{user.online ? "" : ""}
                  </div>
                  <div className={user._count.reconciliationBlocks ? "text-down" : "text-text-faint"}>{user._count.reconciliationBlocks} blocks</div>
                </td>
                <td className="p-2 text-right">
                  {(canManage || canAdjustBalance) && (
                    <AdminUserActions
                      user={user}
                      onChanged={onChanged}
                      onOpenChat={(u) => onOpenChat(users.find((candidate) => candidate.id === u.id) ?? user)}
                      onManageBalance={canAdjustBalance ? (u) => onManageBalance(users.find((candidate) => candidate.id === u.id) ?? user) : undefined}
                      onEditSettings={canAdjustBalance ? (u) => onEditSettings(users.find((candidate) => candidate.id === u.id) ?? user) : undefined}
                      canManage={canManage}
                    />
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 ? <tr><td colSpan={8} className="p-8 text-center text-text-muted">{emptyLabel ?? "No users found."}</td></tr> : null}
          </tbody>
        </table>
      </div>
      <Pagination page={safePage} pageSize={pageSize} totalItems={sortedUsers.length} onPageChange={setPage} label="users" compact />
    </div>
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

/** Per-user settings dialog — loads existing profile, shows the SettingsForm,
 *  saves via PATCH /api/admin/users/[id]/profile. */
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
        {error && <div className="mb-3 rounded border border-down/30 bg-down/10 px-3 py-2 text-xs text-down">{error}</div>}
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
  const [page, setPage] = useState(1);
  const pageSize = 10;

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
    setPage(1);
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
          "idempotency-key": `admin-balance-${createDeviceId()}`,
        },
        body: JSON.stringify({ action, amount, reason }),
      });
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
  const totalPages = Math.max(1, Math.ceil(transactions.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visible = transactions.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <Dialog
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={`Manage balance · ${user?.name ?? user?.email ?? "User"}`}
          description="Administrative adjustments are posted through the double-entry ledger and immutable audit chain."
      className="sm:max-w-4xl"
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        {loading && !data ? <div className="rounded border border-dashed border-border p-8 text-center text-text-muted">Loading account finance…</div> : null}
        {data ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Ledger balance" value={formatUsd(data.metrics?.balance ?? "0")} />
              <MetricCard label="Available" value={formatUsd(data.wallet?.free ?? data.metrics?.free ?? "0")} />
              <MetricCard label="Locked" value={formatUsd(data.wallet?.locked ?? "0")} />
              <MetricCard label="Equity" value={formatUsd(data.metrics?.equity ?? "0")} />
            </div>
            <form onSubmit={submit} className="rounded-lg border border-border bg-panel-2 p-4">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Balance adjustment type">
                <button type="button" onClick={() => setAction("CREDIT")} className={`rounded px-3 py-2 text-xs font-semibold ${action === "CREDIT" ? "bg-up text-white" : "border border-border bg-canvas"}`}>Top up balance</button>
                <button type="button" onClick={() => setAction("DEBIT")} className={`rounded px-3 py-2 text-xs font-semibold ${action === "DEBIT" ? "bg-down text-white" : "border border-border bg-canvas"}`}>Deduct balance</button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,12rem)_1fr_auto] md:items-end">
                <label className="text-xs font-medium">Amount (USD)
                  <input type="number" inputMode="decimal" min="0.00000001" max="1000000" step="0.00000001" required value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 h-10 w-full rounded border border-border bg-canvas px-3 text-sm outline-none focus:border-brand" placeholder="0.00" />
                </label>
                <label className="text-xs font-medium">Audited reason
                  <input type="text" minLength={5} maxLength={500} required value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 h-10 w-full rounded border border-border bg-canvas px-3 text-sm outline-none focus:border-brand" placeholder="Ticket, customer request, or correction reason" />
                </label>
                <Button type="submit" variant={action === "CREDIT" ? "buy" : "sell"} loading={busy} loadingLabel="Posting adjustment">{action === "CREDIT" ? "Post top-up" : "Post deduction"}</Button>
              </div>
              <p className="mt-2 text-[11px] text-text-muted">Deductions cannot exceed the user’s available balance. Margin and pending withdrawals are never silently consumed.</p>
            </form>
            {error ? <p role="alert" className="rounded border border-down/30 bg-down/10 px-3 py-2 text-xs text-down">{error}</p> : null}
            {notice ? <p role="status" className="rounded border border-up/30 bg-up/10 px-3 py-2 text-xs text-up">{notice}</p> : null}
            <section aria-labelledby="user-transaction-history">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div><h3 id="user-transaction-history" className="text-sm font-semibold">Customer transaction history</h3><p className="text-xs text-text-muted">Deposits, withdrawals, trading settlements, bonuses, fees, and administrative adjustments.</p></div>
                <Button size="sm" variant="ghost" onClick={() => void load()} disabled={loading}>Refresh</Button>
              </div>
              <div className="overflow-hidden rounded-lg border border-border">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-175 text-left text-xs">
                    <thead className="bg-panel-2 text-text-muted"><tr><th className="p-2">Date</th><th className="p-2">Type</th><th className="p-2">Description</th><th className="p-2">Reference</th><th className="p-2 text-right">Amount</th><th className="p-2">Status</th></tr></thead>
                    <tbody>
                      {visible.map((item) => {
                        const numeric = Number(item.amount);
                        return <tr key={item.id} className="border-t border-border"><td className="p-2 whitespace-nowrap">{new Date(item.createdAt).toLocaleString()}</td><td className="p-2">{item.type}</td><td className="p-2 max-w-70 truncate" title={item.description ?? undefined}>{item.description ?? "—"}</td><td className="p-2 tnum">{item.reference ?? "—"}</td><td className={`p-2 text-right font-medium tnum ${numeric >= 0 ? "text-up" : "text-down"}`}>{numeric >= 0 ? "+" : ""}{formatUsd(item.amount)}</td><td className="p-2">{item.status}</td></tr>;
                      })}
                      {transactions.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-text-muted">No transactions.</td></tr> : null}
                    </tbody>
                  </table>
                </div>
                <Pagination page={safePage} pageSize={pageSize} totalItems={transactions.length} onPageChange={setPage} label="transactions" compact />
              </div>
            </section>
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 justify-end border-t border-border px-4 py-3 sm:px-5"><Button variant="ghost" onClick={onClose} disabled={busy}>Close</Button></div>
    </Dialog>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border bg-canvas p-3"><div className="text-[10px] uppercase tracking-wide text-text-faint">{label}</div><div className="mt-1 text-lg font-semibold tnum">{value}</div></div>;
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
  const resource = useResource<{ pending: KycSubmission[]; reviewed: KycSubmission[]; total: number }>("/api/admin/kyc/workspace", 15_000);
  return <ModuleState loading={resource.loading} error={resource.error} onRetry={() => void resource.refresh()}>{resource.data && <KycReview pending={resource.data.pending} reviewed={resource.data.reviewed} totalCount={resource.data.total} canDecide={canDecide} canAccessDocuments={canAccess} onQueueChange={() => void resource.refresh()} />}</ModuleState>;
}

function PaymentsPanel({ canPrepare, canApprove, simpleApproval = false }: { canPrepare: boolean; canApprove: boolean; simpleApproval?: boolean }) {
  const resource = useResource<{ requests: PaymentRequestRow[] }>("/api/admin/payments?limit=100", 15_000);
  return <ModuleState loading={resource.loading} error={resource.error} onRetry={() => void resource.refresh()}>{resource.data && <PaymentsReview initialRequests={resource.data.requests} canPrepare={canPrepare} canApprove={canApprove} simpleApproval={simpleApproval} />}</ModuleState>;
}

interface LedgerResponse { trialBalance: Array<{ asset: string; direction: string; amount: string }>; transactions: Array<{ id: string; reference: string; kind: string; status: string; description: string; user: { email: string | null; accountNo: string | null } | null; effectiveAt: string; entries: Array<{ direction: string; amount: string; asset: string; account: { code: string; name: string } }> }> }
function LedgerPanel() {
  const resource = useResource<LedgerResponse>("/api/admin/ledger?limit=100", 15_000);
  return <ModuleState loading={resource.loading} error={resource.error} onRetry={() => void resource.refresh()}>{resource.data && <div className="space-y-4"><SectionHeader title="Double-entry ledger" description="Posted transaction headers and immutable debit/credit entries." onRefresh={() => void resource.refresh()} /><div className="flex flex-wrap gap-2">{resource.data.trialBalance.map((row) => <span key={`${row.asset}:${row.direction}`} className="rounded border border-border bg-canvas px-3 py-2 text-xs">{row.asset} {row.direction}: <strong className="tnum">{row.amount}</strong></span>)}</div><div className="space-y-2">{resource.data.transactions.map((item) => <details key={item.id} className="rounded-lg border border-border bg-canvas p-3"><summary className="cursor-pointer text-sm font-medium">{item.kind} · {item.reference} <span className="ml-2 text-xs text-text-muted">{new Date(item.effectiveAt).toLocaleString()}</span></summary><p className="mt-2 text-xs text-text-muted">{item.description} · {item.user?.email ?? "system"}</p><div className="mt-2 grid gap-1">{item.entries.map((entry) => <div key={`${entry.account.code}:${entry.direction}`} className="flex justify-between rounded bg-panel-2 px-2 py-1 text-xs"><span>{entry.direction} · {entry.account.name}</span><span className="tnum">{entry.asset} {entry.amount}</span></div>)}</div></details>)}{resource.data.transactions.length === 0 && <div className="rounded border border-dashed border-border p-8 text-center text-text-muted">No ledger transactions.</div>}</div></div>}</ModuleState>;
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
interface ExecutionResponse { executionMode: string; marketDataMode: string; engineReady: boolean; providerWarning: string; positions: ExecutionPosition[] }

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
  return "text-text-muted";
}

function ExecutionsPanel({ canManage }: { canManage: boolean }) {
  const resource = useResource<ExecutionResponse>("/api/admin/executions?limit=150");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ExecutionStatusFilter>("ALL");
  const [groupByUser, setGroupByUser] = useState(true);
  const { openCommand, commandDialog } = useCommandDialog();

  const { refresh } = resource;
  useEffect(() => {
    const timer = window.setInterval(() => void refresh({ silent: true }), 5_000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  async function setProfit(position: ExecutionPosition) {
    const values = await openCommand({
      title: `Set ${position.symbol} P/L`,
      description: "The adjustment will be recorded in the immutable audit chain.",
      confirmLabel: "Apply P/L",
      fields: [
        { name: "targetProfit", label: "Target gross P/L (USD)", type: "number", initialValue: position.profit, required: true, min: -1_000_000, max: 1_000_000, step: "0.01", inputMode: "decimal" },
        { name: "reason", label: "Audited reason", type: "textarea", required: true, minLength: 5, maxLength: 500, placeholder: "Explain the correction and include any ticket reference." },
      ],
      validate: (input) => Number.isFinite(Number(input.targetProfit)) && input.reason.length >= 5 ? null : "Enter a valid P/L and a reason of at least five characters.",
    });
    if (!values) return;
    const targetProfit = Number(values.targetProfit);
    const reason = values.reason;
    setBusy(position.id); setError(null);
    try {
      await requestJson(`/api/admin/executions/${position.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "SET_PROFIT", targetProfit, reason }),
      });
      await resource.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update position P/L.");
    } finally { setBusy(null); }
  }

  async function closePosition(position: ExecutionPosition) {
    const values = await openCommand({
      title: `Close ${position.symbol} position`,
      description: `Position ${position.id} will be settled immediately. This simulation settlement cannot be undone.`,
      confirmLabel: "Close position",
      danger: true,
      fields: [
        { name: "reason", label: "Audited closing reason", type: "textarea", required: true, minLength: 5, maxLength: 500, placeholder: "Explain why this position must be closed." },
      ],
      validate: (input) => input.reason.length >= 5 ? null : "A reason of at least five characters is required.",
    });
    if (!values) return;
    const reason = values.reason;
    setBusy(position.id); setError(null);
    try {
      await requestJson(`/api/admin/executions/${position.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "CLOSE", reason }),
      });
      await resource.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to close the position.");
    } finally { setBusy(null); }
  }

  // Instant client-side narrowing over the polled rows (same fields an admin
  // would look up by): symbol, user email, or account number.
  const allPositions = useMemo(() => resource.data?.positions ?? [], [resource.data]);
  const openCount = allPositions.filter((p) => p.status === "OPEN").length;
  const closedCount = allPositions.length - openCount;
  const needle = search.trim().toLowerCase();
  const filtered = useMemo(() => allPositions.filter((position) => {
    if (statusFilter !== "ALL" && position.status !== statusFilter) return false;
    if (!needle) return true;
    return (
      position.symbol.toLowerCase().includes(needle) ||
      (position.user.email ?? "").toLowerCase().includes(needle) ||
      (position.user.accountNo ?? "").includes(needle)
    );
  }), [allPositions, statusFilter, needle]);

  // Collapsible per-user sections with exposure aggregates. Users holding open
  // positions sort first and their section starts expanded.
  const groups = useMemo(() => {
    interface Group { key: string; label: string; accountNo: string | null; positions: ExecutionPosition[]; open: number; netPl: number }
    const byUser = new Map<string, Group>();
    for (const position of filtered) {
      const key = position.user.email ?? position.user.accountNo ?? position.id;
      const group = byUser.get(key) ?? { key, label: position.user.email ?? position.user.accountNo ?? "Unknown user", accountNo: position.user.accountNo, positions: [], open: 0, netPl: 0 };
      group.positions.push(position);
      group.open += position.status === "OPEN" ? 1 : 0;
      group.netPl += Number(position.netProfit);
      byUser.set(key, group);
    }
    return [...byUser.values()].sort((a, b) =>
      b.open - a.open ||
      b.netPl - a.netPl ||
      a.label.localeCompare(b.label),
    );
  }, [filtered]);

  const totalNetPl = filtered.reduce((sum, p) => sum + Number(p.netProfit), 0);
  const filtering = needle !== "" || statusFilter !== "ALL";

  const csvRows = filtered.map((p) => [
    p.user.email ?? "", p.user.accountNo ?? "", p.symbol, p.type ?? "", p.side, p.status,
    Number(p.volume), fmtDateTime(p.openedAt), p.closedAt ? fmtDateTime(p.closedAt) : "",
    Number(p.profit).toFixed(2), Number(p.adminPnlAdjustment).toFixed(2), Number(p.netProfit).toFixed(2),
  ]);

  return <ModuleState loading={resource.loading} error={resource.error} onRetry={() => void resource.refresh()}>{resource.data && <div>
    <SectionHeader title="Execution and position surveillance" description={resource.data.providerWarning} onRefresh={() => void resource.refresh()} />
    <div className="mb-3 flex flex-wrap gap-2 text-xs"><span className="rounded bg-brand-soft px-2 py-1 text-brand">{resource.data.executionMode}</span><span className="rounded bg-panel-2 px-2 py-1">Feed: {resource.data.marketDataMode}</span><span className={`rounded px-2 py-1 ${resource.data.engineReady ? "bg-up/10 text-up" : "bg-down/10 text-down"}`}>Engine {resource.data.engineReady ? "ready" : "starting"}</span></div>
    {error && <p role="alert" className="mb-3 rounded bg-down/10 p-2 text-xs text-down">{error}</p>}
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <TableSearch value={search} onChange={setSearch} placeholder="Search symbol, email, or account number…" label="Search executions" />
      <div className="flex gap-1.5" role="group" aria-label="Filter positions by status">
        <FilterChip active={statusFilter === "ALL"} onClick={() => setStatusFilter("ALL")}>All · {allPositions.length}</FilterChip>
        <FilterChip active={statusFilter === "OPEN"} onClick={() => setStatusFilter("OPEN")}>Open · {openCount}</FilterChip>
        <FilterChip active={statusFilter === "CLOSED"} onClick={() => setStatusFilter("CLOSED")}>Closed · {closedCount}</FilterChip>
      </div>
      <FilterChip active={groupByUser} onClick={() => setGroupByUser((v) => !v)}>Group by user</FilterChip>
      <CsvExportButton
        filename="executions"
        columns={["User", "Account", "Symbol", "Type", "Side", "Status", "Volume", "Opened", "Closed", "Gross P/L", "Adjustment", "Net P/L"]}
        rows={csvRows}
        disabled={filtered.length === 0}
      />
      <span className="text-[10px] text-text-faint tnum" aria-live="polite">
        {filtering
          ? `${filtered.length} of ${allPositions.length} positions`
          : `${allPositions.length} positions · ${groups.length} user${groups.length === 1 ? "" : "s"}`}
        {" · net P/L "}<span className={pnlClass(totalNetPl)}>{fmtExecNumber(totalNetPl.toFixed(2))}</span>
      </span>
    </div>
    {allPositions.length === 0 ? (
      <div className="rounded border border-dashed border-border p-8 text-center text-text-muted">No positions.</div>
    ) : filtered.length === 0 ? (
      <div className="rounded border border-dashed border-border p-8 text-center text-text-muted">
        No positions match {needle ? `“${search.trim()}”` : `the ${statusFilter.toLowerCase()} filter`}.
      </div>
    ) : groupByUser ? (
      <div className="space-y-2">
        {groups.map((group) => (
          <details key={group.key} open={group.open > 0 ? true : undefined} className="rounded-lg border border-border bg-canvas">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-panel-2">
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="truncate text-sm font-semibold">{group.label}</span>
                {group.accountNo && group.accountNo !== group.label ? <span className="text-text-faint">#{group.accountNo}</span> : null}
              </span>
              <span className="flex flex-wrap items-center gap-2 text-text-muted tnum">
                {group.open > 0 && <span className="rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-bold text-brand">{group.open} open</span>}
                <span>{group.positions.length} position{group.positions.length === 1 ? "" : "s"}</span>
                <span>Net P/L <strong className={pnlClass(group.netPl)}>{fmtExecNumber(group.netPl.toFixed(2))}</strong></span>
              </span>
            </summary>
            <div className="space-y-2 border-t border-border p-2">
              {group.positions.map((position) => (
                <ExecutionPositionCard key={position.id} position={position} canManage={canManage} busy={busy !== null} onSetProfit={() => void setProfit(position)} onClose={() => void closePosition(position)} />
              ))}
            </div>
          </details>
        ))}
      </div>
    ) : (
      <div className="space-y-2">
        {filtered.map((position) => (
          <ExecutionPositionCard key={position.id} position={position} canManage={canManage} busy={busy !== null} onSetProfit={() => void setProfit(position)} onClose={() => void closePosition(position)} />
        ))}
      </div>
    )}
    {commandDialog}
  </div>}</ModuleState>;
}

function ExecutionPositionCard({
  position,
  canManage,
  busy,
  onSetProfit,
  onClose,
}: {
  position: ExecutionPosition;
  canManage: boolean;
  busy: boolean;
  onSetProfit: () => void;
  onClose: () => void;
}) {
  const net = Number(position.netProfit);
  return (
    <article className="rounded-lg border border-border bg-canvas p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold">{position.symbol}</span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${position.side === "BUY" ? "bg-up/15 text-up" : "bg-down/15 text-down"}`}>{position.side}</span>
            <span className="rounded bg-panel-2 px-1.5 py-0.5 text-[10px] font-medium text-text-muted">{position.type ?? "CFD"}</span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${position.status === "OPEN" ? "bg-brand-soft text-brand" : "bg-panel-3 text-text-muted"}`}>{position.status}</span>
          </div>
          <div className="mt-1 text-xs text-text-muted">
            {fmtExecNumber(position.volume)} lots @ {fmtExecNumber(position.openRate ?? "0")}
            {position.status === "OPEN" ? ` · mark ${fmtExecNumber(position.currentRate ?? "0")}` : ""}
            {" · opened "}{fmtDateTime(position.openedAt)}
            {position.closedAt ? ` · closed ${fmtDateTime(position.closedAt)}` : ""}
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-xs tnum">
            <span>Gross P/L <strong>{fmtExecNumber(position.profit)}</strong></span>
            <span>Dealer adjustment <strong>{fmtExecNumber(position.adminPnlAdjustment)}</strong></span>
            <span>Net P/L <strong className={pnlClass(net)}>{fmtExecNumber(position.netProfit)}</strong></span>
            {Number(position.commission ?? 0) !== 0 && <span>Commission <strong>{fmtExecNumber(position.commission ?? "0")}</strong></span>}
            {Number(position.swap ?? 0) !== 0 && <span>Swap <strong>{fmtExecNumber(position.swap ?? "0")}</strong></span>}
          </div>
        </div>
        {canManage && position.status === "OPEN" && <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={onSetProfit} className="rounded border border-border px-2.5 py-1.5 text-xs hover:bg-panel-2 disabled:opacity-50">Set P/L</button>
          <button type="button" disabled={busy} onClick={onClose} className="rounded bg-down px-2.5 py-1.5 text-xs text-white disabled:opacity-50">Close</button>
        </div>}
      </div>
    </article>
  );
}

interface SupportCase { id: string; reference: string; userId: string | null; subject: string; category: string; priority: string; status: string; assignedToId: string | null; description: string; createdAt: string }
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
  return <ModuleState loading={resource.loading} error={resource.error} onRetry={() => void resource.refresh()}>{resource.data && <div><div className="flex justify-between"><SectionHeader title="Support operations" description="Audited customer issue ownership and resolution lifecycle." onRefresh={() => void resource.refresh()} />{canManage && <Button loading={busy === "create"} onClick={() => void createCase()}>New case</Button>}</div>{error && <p role="alert" className="mb-3 rounded bg-down/10 p-2 text-xs text-down">{error}</p>}<div className="space-y-2">{resource.data.cases.map((item) => <article key={item.id} className="rounded-lg border border-border bg-canvas p-3"><div className="flex flex-wrap justify-between gap-3"><div><div className="text-xs text-text-faint">{item.reference} · {item.priority} · {item.category}</div><h3 className="mt-1 text-sm font-medium">{item.subject}</h3><p className="mt-1 max-w-3xl text-xs text-text-muted">{item.description}</p></div><div className="text-right"><span className="text-xs font-medium">{item.status}</span>{canManage && item.status !== "RESOLVED" && item.status !== "CLOSED" && <div className="mt-2 flex gap-2"><button type="button" disabled={busy !== null} onClick={() => void updateCase(item.id, "IN_PROGRESS")} className="rounded border border-border px-2 py-1 text-xs">Assign to me</button><button type="button" disabled={busy !== null} onClick={() => void updateCase(item.id, "RESOLVED")} className="rounded bg-brand px-2 py-1 text-xs text-white">Resolve</button></div>}</div></div></article>)}{resource.data.cases.length === 0 && <div className="rounded border border-dashed border-border p-8 text-center text-text-muted">No support cases.</div>}</div>{commandDialog}</div>}</ModuleState>;
}

interface InstrumentRow extends Record<string, unknown> { symbol: string; name: string; category: string; active: boolean; marginPerLot: string; commissionPerLot: string; swapLongPips: string; swapShortPips: string; feedSymbol: string | null }
function InstrumentsPanel({ canManage }: { canManage: boolean }) {
  const resource = useResource<{ instruments: InstrumentRow[]; mutationPolicy: string }>("/api/admin/instruments");
  return <ModuleState loading={resource.loading} error={resource.error} onRetry={() => void resource.refresh()}>{resource.data && <div><SectionHeader title="Instrument configuration" description={resource.data.mutationPolicy} onRefresh={() => void resource.refresh()} />{canManage && <ChangeHint text="Propose instrument changes from the Approvals module; a separate reviewer must execute them." />}<SimpleTable columns={["symbol", "name", "category", "active", "marginPerLot", "commissionPerLot", "swapLongPips", "swapShortPips", "feedSymbol"]} rows={resource.data.instruments} empty="No instruments." /></div>}</ModuleState>;
}

interface RiskRuleRow extends Record<string, unknown> { id: string; code: string; name: string; severity: string; enabled: boolean; version: number; configuration: unknown; updatedAt: string }
function RiskPanel({ canManage }: { canManage: boolean }) {
  const resource = useResource<{ rules: RiskRuleRow[]; exposure: Record<string, number>; mutationPolicy: string }>("/api/admin/risk");
  return <ModuleState loading={resource.loading} error={resource.error} onRetry={() => void resource.refresh()}>{resource.data && <div className="space-y-4"><SectionHeader title="Risk controls" description={resource.data.mutationPolicy} onRefresh={() => void resource.refresh()} /><div className="flex flex-wrap gap-2">{Object.entries(resource.data.exposure).map(([key, value]) => <span key={key} className="rounded border border-border bg-canvas px-3 py-2 text-xs">{key.replaceAll(/([A-Z])/g, " $1")}: <strong>{value}</strong></span>)}</div>{canManage && <ChangeHint text="Risk changes are proposed in Approvals and become effective only after a separate checker executes them." />}<SimpleTable columns={["code", "name", "severity", "enabled", "version", "configuration", "updatedAt"]} rows={resource.data.rules} empty="No risk rules." /></div>}</ModuleState>;
}

interface AuditEventRow extends Record<string, unknown> { sequence: string; domain: string; action: string; entityType: string; entityId: string | null; actorId: string | null; createdAt: string; metadata: unknown; eventHash: string }
function AuditPanel({ canVerify, canExport }: { canVerify: boolean; canExport: boolean }) {
  const resource = useResource<{ events: AuditEventRow[]; redacted: boolean }>("/api/admin/audit?limit=150");
  async function verify() { try { const result = await requestJson<{ valid: boolean; checkedEvents: number }>("/api/admin/audit/verify", { method: "POST" }); toast.success(`Chain ${result.valid ? "valid" : "invalid"}`, `Checked ${result.checkedEvents} events.`); await resource.refresh(); } catch (cause) { toast.error("Verification failed", cause instanceof Error ? cause.message : "Verification failed."); } }
  return <ModuleState loading={resource.loading} error={resource.error} onRetry={() => void resource.refresh()}>{resource.data && <div><div className="flex flex-wrap items-start justify-between gap-3"><SectionHeader title="Immutable audit trail" description="Full-domain event stream with export redaction and cryptographic chain verification." onRefresh={() => void resource.refresh()} /><div className="flex gap-2">{canVerify && <button type="button" onClick={() => void verify()} className="rounded bg-brand px-3 py-2 text-xs text-white">Verify chain</button>}{canExport && <a href="/api/admin/audit/export?format=csv&limit=500" className="rounded border border-border px-3 py-2 text-xs">Export CSV</a>}</div></div><SimpleTable columns={["sequence", "domain", "action", "entityType", "entityId", "actorId", "createdAt", "metadata"]} rows={resource.data.events} empty="No audit events." /></div>}</ModuleState>;
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
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-canvas p-4">
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
  const tone = status === "UP" ? "text-up" : status === "STARTING" ? "text-brand" : "text-down";
  const dot = status === "UP" ? "bg-up" : status === "STARTING" ? "bg-brand" : "bg-down";
  return (
    <div className="rounded-lg border border-border bg-canvas p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold">{name}</p>
        <span className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
          <span className={`text-[10px] font-bold ${tone}`}>{status}</span>
        </span>
      </div>
      {latencyMs != null && <p className="mt-2 text-lg font-semibold tnum">{latencyMs}<span className="ml-0.5 text-[10px] font-normal text-text-faint">ms</span></p>}
      {detail && <p className="mt-1 text-[11px] text-text-muted">{detail}</p>}
      {error && <p className="mt-1 text-[11px] text-down">{error}</p>}
    </div>
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
  canProposeAccess,
  canProposeRisk,
  canProposeInstrument,
}: {
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
              canProposeAccess={canProposeAccess}
              canProposeRisk={canProposeRisk}
              canProposeInstrument={canProposeInstrument}
              onCreated={async () => {
                toast.success("Change request created", "Awaiting a separate checker.");
                await resource.refresh();
              }}
            />
          )}
          <div className="space-y-2">
            {resource.data.requests.map((item) => (
              <article key={item.id} className="rounded-lg border border-border bg-canvas p-3">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <div className="text-[10px] text-text-faint">{item.domain} · {item.status} · {new Date(item.createdAt).toLocaleString()}</div>
                    <h3 className="mt-1 text-sm font-medium">{item.action} · {item.entityType} {item.entityId ?? ""}</h3>
                    <pre className="mt-2 max-w-3xl overflow-auto rounded bg-panel-2 p-2 text-[10px]">{JSON.stringify(item.payload, null, 2)}</pre>
                    <div className="mt-1 text-[10px] text-text-faint">Maker: {item.requestedById}{item.reviewedById ? ` · Checker: ${item.reviewedById}` : ""}</div>
                  </div>
                  {item.canReview && item.status === "PENDING" && (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => void review(item.id, "REJECT")} className="rounded border border-border px-2 py-1 text-xs">Reject</button>
                      <button type="button" onClick={() => void review(item.id, "APPROVE")} className="rounded bg-brand px-2 py-1 text-xs text-white">Approve</button>
                    </div>
                  )}
                </div>
              </article>
            ))}
            {resource.data.requests.length === 0 && <div className="rounded border border-dashed border-border p-8 text-center text-text-muted">No change requests.</div>}
          </div>
          {commandDialog}
        </div>
      )}
    </ModuleState>
  );
}

function ChangeRequestComposer({
  canProposeAccess,
  canProposeRisk,
  canProposeInstrument,
  onCreated,
}: {
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
  const [action, setAction] = useState<ChangeAction>(allowedActions[0] ?? "ASSIGN_ROLE");
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
      await onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create change request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-brand/30 bg-brand-soft/40 p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs">Change type
          <select name="action" value={action} onChange={(event) => setAction(event.target.value as ChangeAction)} className="mt-1 h-9 w-full rounded border border-border bg-canvas px-2">
            {allowedActions.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
          </select>
        </label>
        <label className="text-xs">Request note
          <input name="requestNote" maxLength={1000} className="mt-1 h-9 w-full rounded border border-border bg-canvas px-2" placeholder="Operational reason and ticket reference" />
        </label>
      </div>
      {(action === "ASSIGN_ROLE" || action === "REVOKE_ROLE") && <RoleChangeFields />}
      {action === "UPDATE_RISK_RULE" && <RiskChangeFields />}
      {action === "UPDATE_INSTRUMENT" && <InstrumentChangeFields />}
      {error && <p role="alert" className="mt-3 text-xs text-down">{error}</p>}
      <Button type="submit" loading={busy} loadingLabel="Creating change request" className="mt-3 bg-brand text-white">Submit for approval</Button>
    </form>
  );
}

function RoleChangeFields() {
  return (
    <div className="mt-3 grid gap-3 md:grid-cols-3">
      <FieldInput name="userId" label="Target user ID" required />
      <label className="text-xs">Role
        <select name="role" className="mt-1 h-9 w-full rounded border border-border bg-canvas px-2" defaultValue="SUPPORT">
          {["SUPER_ADMIN", "COMPLIANCE", "FINANCE", "DEALER", "RISK", "SUPPORT", "AUDITOR"].map((role) => <option key={role}>{role}</option>)}
        </select>
      </label>
      <FieldInput name="reason" label="Reason" required />
    </div>
  );
}

function RiskChangeFields() {
  return (
    <div className="mt-3 grid gap-3 md:grid-cols-3">
      <FieldInput name="code" label="Rule code" placeholder="MAX_ORDER_VOLUME" required />
      <FieldInput name="name" label="Rule name" required />
      <label className="text-xs">Severity
        <select name="severity" className="mt-1 h-9 w-full rounded border border-border bg-canvas px-2" defaultValue="WARNING">
          <option>INFO</option><option>WARNING</option><option>BLOCKING</option>
        </select>
      </label>
      <FieldInput name="description" label="Description" required />
      <FieldInput name="configuration" label="Configuration JSON" placeholder='{"maxLots":"50"}' required />
      <label className="flex items-center gap-2 self-end pb-2 text-xs"><input name="enabled" type="checkbox" defaultChecked /> Enabled</label>
    </div>
  );
}

function InstrumentChangeFields() {
  return (
    <div className="mt-3 grid gap-3 md:grid-cols-3">
      <FieldInput name="symbol" label="Symbol" placeholder="EURUSD" required />
      <FieldInput name="marginPerLot" label="Margin per lot" type="number" step="0.00000001" required />
      <FieldInput name="commissionPerLot" label="Commission per lot" type="number" step="0.00000001" required />
      <FieldInput name="swapLongPips" label="Long swap pips" type="number" step="0.00000001" required />
      <FieldInput name="swapShortPips" label="Short swap pips" type="number" step="0.00000001" required />
      <label className="flex items-center gap-2 self-end pb-2 text-xs"><input name="active" type="checkbox" defaultChecked /> Active</label>
    </div>
  );
}

function FieldInput({ name, label, ...props }: { name: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <label className="text-xs">{label}<input name={name} className="mt-1 h-9 w-full rounded border border-border bg-canvas px-2" {...props} /></label>;
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

function ChangeHint({ text }: { text: string }) { return <div className="mb-3 rounded border border-brand/30 bg-brand-soft p-3 text-xs text-brand">{text}</div>; }

function displayValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleString();
  return String(value);
}
function SimpleTable({ columns, rows, empty }: { columns: string[]; rows: Array<Record<string, unknown>>; empty: string }) {
  const pageSize = 25;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => setPage(1), [rows]);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-canvas">
      <div className="overflow-x-auto">
        <table className="w-full min-w-225 text-left text-xs">
          <thead className="bg-panel-2 text-text-muted"><tr>{columns.map((column) => <th key={column} className="p-2 font-medium">{column.replaceAll(/([A-Z])/g, " $1")}</th>)}</tr></thead>
          <tbody>
            {visibleRows.map((row, index) => <tr key={String(row.id ?? row.code ?? row.symbol ?? index)} className="border-t border-border">{columns.map((column) => <td key={column} className="max-w-80 truncate p-2" title={displayValue(row[column])}>{displayValue(row[column])}</td>)}</tr>)}
            {rows.length === 0 && <tr><td colSpan={columns.length} className="p-8 text-center text-text-muted">{empty}</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination page={safePage} pageSize={pageSize} totalItems={rows.length} onPageChange={setPage} label="rows" compact />
    </div>
  );
}
