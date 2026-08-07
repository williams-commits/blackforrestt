"use client";

import { useEffect, useState } from "react";

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
  OPEN: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  WAITING_CUSTOMER: "bg-purple-100 text-purple-700",
  RESOLVED: "bg-green-100 text-green-700",
  CLOSED: "bg-gray-100 text-gray-600",
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  WAITING_CUSTOMER: "Awaiting your reply",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export function SupportTab() {
  const [cases, setCases] = useState<SupportCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // New case form state
  const [subject, setSubject] = useState<string>(CATEGORIES[0]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successRef, setSuccessRef] = useState("");

  async function loadCases() {
    try {
      const res = await fetch("/api/support/cases", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCases(data.cases ?? []);
    } catch {
      setError("Couldn't load your support cases. Please refresh.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCases();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccessRef("");
    try {
      const res = await fetch("/api/support/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Couldn't submit your case. Please try again.");
        setSubmitting(false);
        return;
      }
      const data = await res.json();
      setSuccessRef(data.reference);
      setMessage("");
      await loadCases();
    } catch {
      setError("Network error. Please try again.");
    }
    setSubmitting(false);
  }

  return (
    <div className="space-y-6">
      {/* Create new case */}
      <section className="rounded-xl border border-border bg-canvas p-5">
        <h3 className="text-sm font-semibold mb-1">Open a support case</h3>
        <p className="text-xs text-text-muted mb-4">
          Our team typically responds within one business day. Your case reference will appear below once submitted.
        </p>
        {successRef && (
          <div className="mb-4 rounded-lg border border-green/30 bg-green/10 px-4 py-3 text-sm text-green-700">
            ✓ Case created — your reference is <strong>{successRef}</strong>. We&apos;ll reply by email.
          </div>
        )}
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs text-text-muted">Subject</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="h-10 w-full rounded border border-border bg-canvas px-2 text-sm outline-none focus:border-brand"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
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
          {error && <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting || message.trim().length < 10}
            className="h-10 rounded-lg bg-brand px-6 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit case"}
          </button>
        </form>
      </section>

      {/* Case history */}
      <section className="rounded-xl border border-border bg-canvas p-5">
        <h3 className="mb-4 text-sm font-semibold">Your support cases</h3>
        {loading ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : cases.length === 0 ? (
          <p className="text-sm text-text-muted">You haven&apos;t opened any support cases yet.</p>
        ) : (
          <ul className="space-y-3">
            {cases.map((c) => (
              <li key={c.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-text-faint">{c.reference}</span>
                    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[c.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABELS[c.status] ?? c.status}
                    </span>
                  </div>
                  <time className="text-xs text-text-faint">{new Date(c.createdAt).toLocaleDateString()}</time>
                </div>
                <p className="mt-2 text-sm font-medium">{c.subject}</p>
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-text-muted">{c.description}</p>
                {c.resolutionNote && (
                  <p className="mt-2 rounded bg-panel px-3 py-2 text-xs text-text">
                    <strong>Resolution:</strong> {c.resolutionNote}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
