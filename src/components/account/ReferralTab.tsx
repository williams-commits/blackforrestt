"use client";

import { useCallback, useEffect, useState } from "react";

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

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/referrals", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load referrals");
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load referrals.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const copyLink = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(`https://${data.link}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  };

  if (loading) return <p className="text-sm text-text-muted">Loading referrals…</p>;
  if (error) return <p className="text-sm text-down">{error}</p>;
  if (!data) return null;

  return (
    <div className="space-y-5">
      {/* Share card */}
      <div className="rounded-xl border border-border bg-canvas p-5">
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
            className="shrink-0 rounded-lg bg-brand px-4 py-2.5 text-xs font-semibold text-white hover:brightness-110 transition"
          >
            {copied ? "✓ Copied" : "Copy"}
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
          <div className="rounded-xl border border-border bg-panel p-8 text-center">
            <p className="text-sm text-text-muted">No referrals yet. Share your link to start earning.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
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
                      {new Date(r.createdAt).toLocaleDateString()}
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
