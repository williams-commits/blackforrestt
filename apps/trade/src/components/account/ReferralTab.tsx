"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { fmtDate } from "@/lib/dates";
import { Check, Copy } from "lucide-react";
import type { ServerMessage } from "@/lib/ws/client";
import { Input } from "@/components/ui/Input";

interface ReferralData {
  code: string;
  link: string;
  stats: { total: number; completed: number; pending: number; totalEarned: number };
  referrals: Array<{
    id: string;
    status: "PENDING" | "COMPLETED" | "REJECTED";
    reward: number;
    createdAt: string;
    completedAt: string | null;
    referred: { name: string | null; email: string | null; accountNo: string | null; verified: boolean };
  }>;
}

/** Referrals tab — share link, stats, and referral history. */
export function ReferralTab() {
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  // Server state via react-query: 30s auto-sync (pauses in background tabs).
  // A referral completes when the referred user's first deposit is approved —
  // ledger pushes invalidate immediately so rewards update without a reload.
  const { data, isPending, error: queryError } = useQuery({
    queryKey: ["account-referrals"],
    queryFn: async () => {
      const res = await fetch("/api/referrals", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load referrals");
      return (await res.json()) as ReferralData;
    },
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
  const loading = isPending && !data;
  const error = queryError instanceof Error ? queryError.message : null;

  useEffect(() => {
    let pending: ReturnType<typeof setTimeout> | null = null;
    const handleRealtime = (event: Event) => {
      const message = (event as CustomEvent<ServerMessage>).detail;
      if (message?.type !== "account" || message.reason !== "ledger") return;
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => void queryClient.invalidateQueries({ queryKey: ["account-referrals"] }), 250);
    };
    window.addEventListener("blckforest:realtime", handleRealtime);
    return () => {
      window.removeEventListener("blckforest:realtime", handleRealtime);
      if (pending) clearTimeout(pending);
    };
  }, [queryClient]);

  const copyLink = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(`https://${data.link}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  };

  // Skeleton mirroring the loaded layout: share card → 4 stat cards → table.
  if (loading) {
    return (
      <div className="space-y-5" role="status" aria-label="Loading referrals">
        <div className="space-y-3 p-5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-72" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="p-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-2 h-6 w-16" />
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-lg border border-down/30 bg-down/10 p-5 text-center">
        <p className="text-sm text-down">{error}</p>
        <Button type="button" size="sm" variant="ghost" className="mt-3" onClick={() => void queryClient.invalidateQueries({ queryKey: ["account-referrals"] })}>
          Retry
        </Button>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-5">
      {/* Share card */}
      <div className="p-5">
        <h3 className="text-base font-semibold mb-1">Your Referral Link</h3>
        <p className="text-xs text-text-muted mb-3">Share this link. When your referral makes their first deposit, you both earn a bonus.</p>
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={`https://${data.link}`}
            className="flex-1 h-10 font-mono"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <button
            onClick={() => void copyLink()}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-xs font-semibold text-white hover:brightness-110 transition"
          >
            {copied ? <><Check size={12} strokeWidth={2.5} aria-hidden /> Copied</> : <><Copy size={12} strokeWidth={2} aria-hidden /> Copy</>}
          </button>
        </div>
        <div className="mt-3 flex items-center gap-3 text-xs">
          <span className="text-text-faint">Code:</span>
          <span className="font-mono font-semibold text-brand">{data.code}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Referrals" value={data.stats.total} />
        <StatCard label="Completed" value={data.stats.completed} />
        <StatCard label="Pending" value={data.stats.pending} />
        <StatCard label="Total Earned" value={`$${data.stats.totalEarned.toFixed(2)}`} highlight />
      </div>

      {/* Referral list — record rows, not a table */}
      <div>
        <h3 className="mb-3 text-base font-semibold">Referral History</h3>
        {data.referrals.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-text-muted">No referrals yet. Share your link to start earning.</p>
          </div>
        ) : (
          <ul className="rounded-xl border border-border bg-canvas shadow-sm">
            {data.referrals.map((r) => (
              <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-border-soft px-4 py-3 last:border-b-0 hover:bg-panel-2 md:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr] md:gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{r.referred.name ?? "Unknown"}</div>
                  <div className="truncate text-(length:--term-text-xs) text-text-faint">{r.referred.email}</div>
                  <div className="mt-0.5 text-(length:--term-text-2xs) text-text-faint md:hidden">{fmtDate(r.createdAt)}</div>
                </div>
                <div className="text-right">
                  <span className={`text-sm tnum font-semibold ${r.status === "COMPLETED" ? "text-up" : "text-text-faint"}`}>
                    {r.status === "COMPLETED" ? `+$${r.reward.toFixed(2)}` : "—"}
                  </span>
                  <div className="text-(length:--term-text-2xs) text-text-faint md:hidden">reward</div>
                </div>
                <div className="hidden md:block text-(length:--term-text-sm) text-text-muted tnum">{fmtDate(r.createdAt)}</div>
                <div className="col-start-1 md:col-start-3">
                  <span className={`rounded px-1.5 py-0.5 text-(length:--term-text-2xs) font-semibold ${
                    r.status === "COMPLETED" ? "bg-up/15 text-up" :
                    r.status === "PENDING" ? "bg-(--term-warning-bg) text-(--term-warning-fg)" :
                    "bg-down/15 text-down"
                  }`}>
                    {r.status === "COMPLETED" ? "Completed" : r.status === "PENDING" ? "Pending" : "Rejected"}
                  </span>
                </div>
                <span className="hidden md:block text-right text-sm tnum font-semibold text-up">
                  {r.status === "COMPLETED" ? `+$${r.reward.toFixed(2)}` : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="p-3">
      <div className="text-(length:--term-text-2xs) uppercase text-text-faint">{label}</div>
      <div className={`mt-1 text-lg font-bold tnum ${highlight ? "text-up" : "text-text"}`}>{value}</div>
    </div>
  );
}
