"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

/**
 * Email history for one CRM record — both directions (sent and received),
 * newest first. Reading an inbound email marks it read; the full mailbox
 * experience (folders, search) lives on /emails.
 */

type EmailRow = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  status: "RECEIVED" | "SENT" | "FAILED";
  from: string;
  to: string;
  subject: string;
  preview: string;
  body: string;
  read: boolean;
  sentBy: string | null;
  error: string | null;
  createdAt: string;
};

export function RecordEmailHistory({
  subjectType,
  subjectId,
}: {
  subjectType: "LEAD" | "CONTACT" | "ACCOUNT" | "CUSTOMER" | "OPPORTUNITY";
  subjectId: string;
}) {
  const [rows, setRows] = useState<EmailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<EmailRow | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ subjectType, subjectId });
      const response = await fetch(`/api/emails?${params.toString()}`);
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? `Request failed (${response.status})`);
      setRows(body.data?.rows ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load email history.");
    } finally {
      setLoading(false);
    }
  }, [subjectType, subjectId]);

  useEffect(() => { void load(); }, [load]);

  async function openEmail(row: EmailRow) {
    setOpen(row);
    if (row.direction === "INBOUND" && !row.read) {
      setRows((current) => current.map((entry) => (entry.id === row.id ? { ...entry, read: true } : entry)));
      setOpen({ ...row, read: true });
      void fetch(`/api/emails/${row.id}`, { method: "GET" }).catch(() => undefined);
    }
  }

  return (
    <section aria-labelledby="record-email-history" className="card" style={{ padding: "var(--space-4)" }}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="record-email-history" className="text-sm font-semibold text-(--text-primary)">Email history</h2>
        <Link href="/emails" className="text-xs font-medium text-(--brand) hover:underline">Open mailbox →</Link>
      </div>
      {error ? (
        <p role="alert" className="rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">{error}</p>
      ) : loading ? (
        <p className="text-sm text-(--text-tertiary)">Loading emails…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-(--text-tertiary)">No email correspondence yet. Emails sent from this record — and replies from this address — appear here.</p>
      ) : (
        <ul className="divide-y divide-(--border-default)">
          {rows.slice(0, 10).map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => void openEmail(row)}
                aria-expanded={open?.id === row.id}
                className="flex w-full items-center justify-between gap-3 px-1 py-2.5 text-left hover:bg-(--bg-hover)"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                      row.direction === "INBOUND"
                        ? "bg-(--bg-selected) text-(--brand)"
                        : "bg-(--bg-subtle) text-(--text-secondary)"
                    }`}>
                      {row.direction === "INBOUND" ? "In" : "Out"}
                    </span>
                    <span className={`truncate text-sm ${row.read || row.direction === "OUTBOUND" ? "text-(--text-primary)" : "font-bold text-(--text-primary)"}`}>
                      {row.status === "FAILED" ? `⚠ ${row.subject}` : row.subject}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-(--text-tertiary)">
                    {row.direction === "INBOUND" ? row.from : `to ${row.to}`} · {row.preview}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] text-(--text-tertiary)">
                  {new Date(row.createdAt).toLocaleDateString()}
                </span>
              </button>
              {open?.id === row.id ? (
                <div className="mb-3 rounded-lg bg-(--bg-subtle) p-3">
                  <p className="text-xs text-(--text-tertiary)">
                    {new Date(row.createdAt).toLocaleString()}
                    {row.sentBy ? ` · sent by ${row.sentBy}` : ""}
                    {row.status === "FAILED" ? ` · failed: ${row.error ?? "unknown"}` : ""}
                  </p>
                  <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-(--text-primary)">{row.body}</pre>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {rows.length > 10 ? (
        <p className="mt-2 text-xs text-(--text-tertiary)">
          Showing the latest 10 of {rows.length} — <Link href="/emails" className="text-(--brand) hover:underline">view all in the mailbox</Link>.
        </p>
      ) : null}
    </section>
  );
}
