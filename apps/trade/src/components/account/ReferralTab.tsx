"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { fmtDate } from "@/lib/dates";
import { Check, CheckCircle2, Clock, Copy, DollarSign, Users } from "lucide-react";
import type { ServerMessage } from "@/lib/ws/client";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IdentityTile, initialsOf } from "@/components/ui/Initial";
import { StatCard } from "@/components/ui/StatCard";
import { RecordList, RecordStatusChip, type RecordDetailMeta } from "@/components/ui/RecordList";

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

/** Referrals on the enterprise RecordList — share Card, stat cards, and a
 *  master–detail history list. */
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

  if (loading) {
    return (
      <div className="space-y-8" role="status" aria-label="Loading referrals">
        <div className="space-y-3 py-5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-72" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2 py-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (error) {
    return (
      <Alert tone="err" className="flex items-center justify-between gap-4">
        <span>{error}</span>
        <Button type="button" size="sm" variant="outline" onClick={() => void queryClient.invalidateQueries({ queryKey: ["account-referrals"] })}>
          Retry
        </Button>
      </Alert>
    );
  }
  if (!data) return null;

  const done = (r: ReferralData["referrals"][number]) => r.status === "COMPLETED";
  const statusTone = (status: ReferralData["referrals"][number]["status"]) =>
    status === "COMPLETED" ? "up" : status === "PENDING" ? "warn" : "down";

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Your Referral Link</CardTitle>
          <CardDescription>Share this link. When your referral makes their first deposit, you both earn a bonus.</CardDescription>
          <div className="flex items-center gap-2 pt-2">
            <Input
              readOnly
              value={`https://${data.link}`}
              className="h-10 flex-1 truncate font-mono text-sm"
              onClick={(e) => (e.target as HTMLInputElement).select()}
              aria-label="Referral link"
            />
            <Button
              type="button"
              variant="default"
              onClick={() => void copyLink()}
              className="h-10 shrink-0"
              aria-label="Copy referral link"
            >
              {copied ? <><Check size={14} strokeWidth={2.5} aria-hidden /> Copied</> : <><Copy size={14} strokeWidth={2} aria-hidden /> Copy</>}
            </Button>
          </div>
          <CardAction className="items-center gap-2 text-sm">
            <span className="text-muted-foreground">Code:</span>
            <Badge variant="secondary" className="font-mono tracking-wide">{data.code}</Badge>
          </CardAction>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Referrals" value={data.stats.total} icon={<Users size={16} strokeWidth={1.75} aria-hidden />} />
        <StatCard label="Completed" value={data.stats.completed} tone="up" icon={<CheckCircle2 size={16} strokeWidth={1.75} aria-hidden />} />
        <StatCard label="Pending" value={data.stats.pending} tone="warn" icon={<Clock size={16} strokeWidth={1.75} aria-hidden />} />
        <StatCard label="Total Earned" value={`$${data.stats.totalEarned.toFixed(2)}`} tone="up" icon={<DollarSign size={16} strokeWidth={1.75} aria-hidden />} />
      </div>

      <RecordList<ReferralData["referrals"][number]>
        ariaLabel="Referral"
        title="Referral History"
        description={`${data.referrals.length} referrals`}
        rows={data.referrals}
        rowKey={(r) => r.id}
        search={{
          placeholder: "Search name or email…",
          text: (r) => `${r.referred.name ?? ""} ${r.referred.email ?? ""} ${r.referred.accountNo ?? ""}`,
        }}
        leading={(r) => ({
          icon: <span className="text-xs font-bold">{initialsOf(r.referred.name ?? r.referred.email)}</span>,
          tone: done(r) ? "up" : "muted",
          title: r.referred.name ?? "Unknown",
          secondary: r.referred.email ?? "—",
        })}
        columns={[
          { key: "createdAt", label: "Joined", sortable: true, align: "right", render: (r) => (
            <span className="text-xs text-muted-foreground tabular-nums">{fmtDate(r.createdAt)}</span>
          ) },
          { key: "status", label: "Status", render: (r) => (
            <RecordStatusChip tone={statusTone(r.status)}>{r.status}</RecordStatusChip>
          ) },
          { key: "reward", label: "Reward", sortable: true, align: "right", render: (r) => (
            <span className={`font-semibold tabular-nums ${done(r) ? "text-up" : "text-muted-foreground"}`}>
              {done(r) ? `+$${r.reward.toFixed(2)}` : "—"}
            </span>
          ) },
        ]}
        sortValue={(r, key) => {
          switch (key) {
            case "reward": return r.reward;
            case "createdAt": return new Date(r.createdAt).getTime();
            default: return String((r as unknown as Record<string, unknown>)[key] ?? "");
          }
        }}
        initialSort={{ key: "createdAt", direction: "desc" }}
        detailTitle="Referral Detail"
        renderDetailHero={(r) => (
          <div className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 px-4 py-6 text-center">
            <IdentityTile size="lg">{initialsOf(r.referred.name ?? r.referred.email)}</IdentityTile>
            <div className="text-sm font-medium">{r.referred.name ?? "Unknown"}</div>
            <div className={`text-2xl font-semibold tabular-nums ${done(r) ? "text-up" : "text-muted-foreground"}`}>
              {done(r) ? `+$${r.reward.toFixed(2)}` : "—"}
            </div>
            <RecordStatusChip tone={statusTone(r.status)}>{r.status}</RecordStatusChip>
          </div>
        )}
        renderDetailMeta={(r): RecordDetailMeta[] => [
          { label: "Email", value: r.referred.email ?? "—" },
          { label: "Account", value: r.referred.accountNo ?? "—" },
          { label: "Verified", value: r.referred.verified ? "Yes" : "No" },
          { label: "Joined", value: fmtDate(r.createdAt) },
          ...(r.completedAt ? [{ label: "Completed", value: fmtDate(r.completedAt) }] : []),
        ]}
        emptyTitle="No referrals yet"
        emptyHint="Share your link to start earning."
        emptyIcon={<Users size={18} aria-hidden />}
      />
    </div>
  );
}
