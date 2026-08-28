"use client";

import { useCallback, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { fmtDate } from "@/lib/dates";
import { Check, Copy } from "lucide-react";
import type { ServerMessage } from "@/lib/ws/client";

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
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!options.silent) setLoading(true);
    try {
      const res = await fetch("/api/referrals", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load referrals");
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      // Silent (background) refreshes keep the last good data on screen.
      if (!options.silent) setError(e instanceof Error ? e.message : "Unable to load referrals.");
    } finally {
      if (!options.silent) setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  // Auto-sync: a referral completes when the referred user's first deposit is
  // approved — poll while visible so status/rewards update without a reload.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh({ silent: true }).catch(() => undefined);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  // Referral bonuses land as ledger pushes (deposit approval credits both
  // sides) — refresh immediately instead of waiting for the 30s poll.
  useEffect(() => {
    let pending: ReturnType<typeof setTimeout> | null = null;
    const handleRealtime = (event: Event) => {
      const message = (event as CustomEvent<ServerMessage>).detail;
      if (message?.type !== "account" || message.reason !== "ledger") return;
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => void refresh({ silent: true }).catch(() => undefined), 250);
    };
    window.addEventListener("blckforest:realtime", handleRealtime);
    return () => {
      window.removeEventListener("blckforest:realtime", handleRealtime);
      if (pending) clearTimeout(pending);
    };
  }, [refresh]);

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
        <div className="space-y-3 rounded-lg border border-border bg-canvas p-5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-72" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-border bg-canvas p-4">
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
        <Button type="button" size="sm" variant="ghost" className="mt-3" onClick={() => void refresh()}>
          Retry
        </Button>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-5">
      {/* Share card */}
      <div className="rounded-lg border border-border bg-canvas p-5">
        <h3 className="text-sm font-bold mb-1">Your Referral Link</h3>
        <p className="text-xs text-text-muted mb-3">Share this link. When your referral makes their first deposit, you both earn a bonus.</p>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={`https://${data.link}`}
            className="flex-1 h-10 rounded-lg border border-border bg-panel px-3 text-xs font-mono outline-none"
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

      {/* Referral list */}
      <div>
        <h3 className="text-sm font-bold mb-3">Referral History</h3>
        {data.referrals.length === 0 ? (
          <div className="rounded-lg border border-border bg-canvas p-8 text-center">
            <p className="text-sm text-text-muted">No referrals yet. Share your link to start earning.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-panel-2 text-text-faint">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] uppercase">User</th>
                  <th className="px-3 py-2 text-left text-[10px] uppercase hidden sm:table-cell">Date</th>
                  <th className="px-3 py-2 text-center text-[10px] uppercase">Status</th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase">Reward</th>
                </tr>
              </thead>
              <tbody>
                {data.referrals.map((r) => (
                  <tr key={r.id} className="border-t border-border-soft">
                    <td className="px-3 py-2">
                      <div className="text-xs font-medium">{r.referred.name ?? "Unknown"}</div>
                      <div className="text-[10px] text-text-faint">{r.referred.email}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-text-muted hidden sm:table-cell">
                      {fmtDate(r.createdAt)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        r.status === "COMPLETED" ? "bg-up/15 text-up" :
                        r.status === "PENDING" ? "bg-brand-soft text-brand" :
                        "bg-down/15 text-down"
                      }`}>
                        {r.status === "COMPLETED" ? "Completed" : r.status === "PENDING" ? "Pending" : "Rejected"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-xs tnum font-semibold text-up">
                      {r.status === "COMPLETED" ? `+$${r.reward.toFixed(2)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-canvas p-3">
      <div className="text-[10px] uppercase text-text-faint">{label}</div>
      <div className={`mt-1 text-lg font-bold tnum ${highlight ? "text-up" : "text-text"}`}>{value}</div>
    </div>
  );
}
