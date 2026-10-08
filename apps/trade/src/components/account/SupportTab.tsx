"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/Skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CircleCheck } from "lucide-react";

const CATEGORIES = ["General enquiry", "Account & verification", "Deposits & withdrawals", "Technical issue", "Partnership"] as const;

interface SupportCase {
  id: string;
  reference: string;
  subject: string;
  category: string;
  status: "OPEN" | "IN_PROGRESS" | "WAITING_CUSTOMER" | "RESOLVED" | "CLOSED";
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  description: string;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-(--term-warning-bg) text-(--term-warning-fg)",
  IN_PROGRESS: "bg-brand/15 text-brand",
  WAITING_CUSTOMER: "bg-(--term-success-bg) text-(--term-success-fg)",
  RESOLVED: "bg-up/15 text-up",
  CLOSED: "bg-panel-2 text-text-faint",
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  WAITING_CUSTOMER: "Awaiting your reply",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export function SupportTab() {

  // New case form state
  const [subject, setSubject] = useState<string>(CATEGORIES[0]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successRef, setSuccessRef] = useState("");
  // Submit failures are action errors, distinct from the query error.
  const [actionError, setActionError] = useState("");

  const queryClient = useQueryClient();

  // Server state via react-query: 30s auto-sync (pauses in background tabs);
  // the shell's badge watcher invalidates when a case changes status.
  const { data, isPending, error: queryError } = useQuery({
    queryKey: ["account-support-cases"],
    queryFn: async () => {
      const res = await fetch("/api/support/cases", { cache: "no-store" });
      if (!res.ok) throw new Error("Couldn't load your support cases. Please refresh.");
      const payload = await res.json() as { cases?: SupportCase[] };
      return payload.cases ?? [];
    },
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
  const cases = data ?? [];
  const loading = isPending;
  const loadCases = useCallback(
    async () => void queryClient.invalidateQueries({ queryKey: ["account-support-cases"] }),
    [queryClient],
  );

  useEffect(() => {
    const onCountsChanged = () => void queryClient.invalidateQueries({ queryKey: ["account-support-cases"] });
    window.addEventListener("blckforest:counts-changed", onCountsChanged);
    return () => window.removeEventListener("blckforest:counts-changed", onCountsChanged);
  }, [queryClient]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setActionError("");
    setSuccessRef("");
    try {
      const res = await fetch("/api/support/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setActionError(body.error || "Couldn't submit your case. Please try again.");
        setSubmitting(false);
        return;
      }
      const data = await res.json();
      setActionError("");
      setSuccessRef(data.reference);
      setMessage("");
      await loadCases();
    } catch {
      setActionError("Network error. Please try again.");
    }
    setSubmitting(false);
  }

  return (
    <div className="space-y-6">
      {/* Create new case */}
      <section className="rounded-lg border border-border bg-canvas p-5">
        <h3 className="text-sm font-semibold mb-1">Open a support case</h3>
        <p className="text-xs text-text-muted mb-4">
          Our team typically responds within one business day. Your case reference will appear below once submitted.
        </p>
        {successRef && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-up/30 bg-up/10 px-4 py-3 text-sm text-up"><CircleCheck size={16} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0" />
            Case created — your reference is <strong>{successRef}</strong>. We&apos;ll reply by email.
          </div>
        )}
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs text-text-muted">Subject</label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger aria-label="Subject" className="h-10 w-full rounded px-2 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-text-muted">Message</label>
            <textarea
              required
              minLength={10}
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full resize-none rounded border border-border bg-canvas px-3 py-2 text-sm outline-none focus:border-brand"
              placeholder="Describe your issue or question…"
            />
          </div>
          {(queryError instanceof Error ? queryError.message : actionError) && <p className="rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-sm text-down">{queryError instanceof Error ? queryError.message : actionError}</p>}
          <button
            type="submit"
            disabled={submitting || message.trim().length < 10}
            className="h-10 rounded-lg bg-brand px-6 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {submitting ? "Submitting…" : "Submit case"}
          </button>
        </form>
      </section>

      {/* Case history */}
      <section className="rounded-lg border border-border bg-canvas p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Your support cases</h3>
          {cases.length > 0 && (
            <span className="flex flex-wrap gap-1.5" aria-label="Case status summary">
              {(["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER"] as const).map((st) => {
                const n = cases.filter((c) => c.status === st).length;
                if (!n) return null;
                return <span key={st} className={`rounded-full px-2 py-0.5 text-(length:--term-text-2xs) font-semibold ${STATUS_STYLES[st]}`}>{n} {STATUS_LABELS[st]}</span>;
              })}
              {(() => {
                const done = cases.filter((c) => c.status === "RESOLVED" || c.status === "CLOSED").length;
                return done > 0 ? <span className="rounded-full bg-panel-3 px-2 py-0.5 text-(length:--term-text-2xs) font-semibold text-text-muted">{done} resolved</span> : null;
              })()}
            </span>
          )}
        </div>
        {loading ? (
          <div className="space-y-3" role="status" aria-label="Loading support cases">
            {[0, 1].map((i) => (
              <div key={i} className="space-y-2 rounded-lg border border-border p-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-16 rounded" />
                </div>
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : cases.length === 0 ? (
          <p className="text-sm text-text-muted">You haven&apos;t opened any support cases yet.</p>
        ) : (
          <ul className="space-y-3">
            {[...cases]
              // Active cases first (most recent), then resolved/closed history.
              .sort((a, b) => {
                const rank = (s: string) => (s === "RESOLVED" || s === "CLOSED" ? 1 : 0);
                return rank(a.status) - rank(b.status) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
              })
              .map((c) => (
              <li key={c.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-text-faint">{c.reference}</span>
                    <span className={`rounded px-2 py-0.5 text-(length:--term-text-2xs) font-semibold ${STATUS_STYLES[c.status] ?? "bg-panel-3 text-text-muted"}`}>
                      {STATUS_LABELS[c.status] ?? c.status}
                    </span>
                  </div>
                  <time className="text-xs text-text-faint" dateTime={c.createdAt}>{new Date(c.createdAt).toLocaleDateString()}</time>
                </div>
                <p className="mt-2 text-sm font-medium">{c.subject}</p>
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-text-muted">{c.description}</p>
                {c.resolutionNote && (
                  <p className="mt-2 rounded border border-up/25 bg-up/5 px-3 py-2 text-xs text-text">
                    <strong className="text-up">Resolved:</strong> {c.resolutionNote}
                  </p>
                )}
                {c.status === "WAITING_CUSTOMER" && (
                  <p className="mt-2 text-(length:--term-text-xs) font-medium text-up">Awaiting your response — reply via chat or update this case.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
