"use client";

import { useState } from "react";
import { KycReview } from "./KycReview";
import { UsersTable } from "./UsersTable";
import { PositionsMonitor } from "./PositionsMonitor";
import { PaymentsReview, type PaymentRequestRow } from "./PaymentsReview";
import { ReconciliationReview } from "./ReconciliationReview";

type Tab = "overview" | "payments" | "reconciliation" | "kyc" | "users" | "positions";

interface UserRow {
  id: string; email: string; name: string; accountNo: string;
  isAdmin: boolean; verified: boolean;
  balance: number; equity: number; floatingPl: number; createdAt: string;
}
interface PositionRow {
  id: string; symbol: string; type: "CFD" | "STRIKE"; side: "BUY" | "SELL";
  volume: number; openRate: number; currentRate: number; netProfit: number;
  openedAt: string; user: { email: string | null; name: string | null; accountNo: string | null };
}
interface KycRow {
  id: string; userId: string; status: "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED";
  firstName: string | null; lastName: string | null; dob: string | null;
  country: string | null; address: string | null; city: string | null; postalCode: string | null;
  docType: string | null; docReference: string | null; note: string | null;
  submittedAt: string | null; reviewedAt: string | null;
  user: { email: string | null; name: string | null; accountNo: string | null };
}

interface Props {
  kycPending: KycRow[];
  kycReviewed: KycRow[];
  kycTotal: number;
  users: UserRow[];
  positions: PositionRow[];
  payments: PaymentRequestRow[];
}

/** Tabbed admin dashboard: Overview stats, KYC review, Users, Positions monitor. */
export function AdminDashboard({ kycPending, kycReviewed, kycTotal, users, positions, payments }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [pending, setPending] = useState(kycPending);

  const stats = {
    totalUsers: users.length,
    verifiedUsers: users.filter((u) => u.verified).length,
    openPositions: positions.length,
    pendingKyc: pending.length,
    totalDeposits: users.reduce((s, u) => s + u.balance, 0),
  };

  return (
    <div>
      <h1 className="text-lg font-semibold mb-4">Admin Console</h1>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border mb-5 overflow-x-auto">
        {([
          ["overview", `Overview`],
          ["payments", `Payments [${payments.length}]`],
          ["reconciliation", "Reconciliation"],
          ["kyc", `KYC Review [${pending.length}]`],
          ["users", `Users [${users.length}]`],
          ["positions", `Open Positions [${positions.length}]`],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px whitespace-nowrap ${
              tab === k ? "text-brand border-brand font-medium" : "text-text-muted border-transparent hover:text-text"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && <Overview stats={stats} users={users} positions={positions} kycTotal={kycTotal} />}
      {tab === "payments" && <PaymentsReview initialRequests={payments} />}
      {tab === "reconciliation" && <ReconciliationReview />}
      {tab === "kyc" && (
        <KycReview
          pending={pending}
          reviewed={kycReviewed}
          totalCount={kycTotal}
          onQueueChange={setPending}
        />
      )}
      {tab === "users" && <UsersTable users={users} />}
      {tab === "positions" && <PositionsMonitor positions={positions} />}
    </div>
  );
}

function Overview({ stats, users, positions, kycTotal }: {
  stats: { totalUsers: number; verifiedUsers: number; openPositions: number; pendingKyc: number; totalDeposits: number };
  users: UserRow[];
  positions: PositionRow[];
  kycTotal: number;
}) {
  const floatingAll = positions.reduce((s, p) => s + p.netProfit, 0);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card label="Total Users" value={stats.totalUsers.toString()} sub={`${stats.verifiedUsers} verified`} />
        <Card label="Open Positions" value={stats.openPositions.toString()} sub={`${users.length} active accounts`} />
        <Card label="Pending KYC" value={stats.pendingKyc.toString()} sub={`${kycTotal} total submissions`} />
        <Card label="Client Balances" value={`$${stats.totalDeposits.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
        <Card label="Floating P/L" value={`${floatingAll >= 0 ? "+" : ""}$${floatingAll.toFixed(2)}`} valueClass={floatingAll >= 0 ? "text-up" : "text-down"} />
      </div>

      {/* Recent users */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Newest accounts</h2>
        <div className="space-y-1.5">
          {users.slice(0, 5).map((u) => (
            <div key={u.id} className="flex items-center justify-between rounded-lg border border-border bg-canvas px-3 py-2">
              <div>
                <span className="text-sm font-medium">{u.name}</span>
                <span className="text-xs text-text-muted ml-2">{u.email}</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-text-muted tnum">#{u.accountNo}</span>
                <span className="tnum">${u.balance.toFixed(0)}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${u.verified ? "bg-up/15 text-up" : "bg-panel-2 text-text-muted"}`}>
                  {u.verified ? "Verified" : "Unverified"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Card({ label, value, sub, valueClass = "" }: { label: string; value: string; sub?: string; valueClass?: string }) {
  return (
    <div className="bg-canvas border border-border rounded-lg p-4">
      <div className="text-[11px] text-text-faint uppercase">{label}</div>
      <div className={`text-xl font-bold tnum mt-1 ${valueClass || "text-text"}`}>{value}</div>
      {sub && <div className="text-[11px] text-text-faint mt-0.5">{sub}</div>}
    </div>
  );
}
