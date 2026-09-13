"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";

/**
 * Mailbox — inbox / unread / sent folders, a reading pane, search, and
 * pagination. Inbound mail arrives through the ingestion webhook; sent mail
 * is persisted by the send flow. Emails linked to CRM records carry a chip
 * that jumps straight to the record.
 */

type EmailRow = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  status: "RECEIVED" | "SENT" | "FAILED";
  from: string;
  to: string;
  cc: string | null;
  subject: string;
  preview: string;
  body: string;
  subjectType: string | null;
  subjectId: string | null;
  read: boolean;
  sentBy: string | null;
  error: string | null;
  createdAt: string;
};

type MailboxResponse = {
  rows: EmailRow[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  unreadCount: number;
};

const FOLDERS = [
  { key: "inbox", label: "Inbox" },
  { key: "unread", label: "Unread" },
  { key: "sent", label: "Sent" },
] as const;

const RECORD_PATH: Record<string, string> = {
  LEAD: "leads",
  CONTACT: "contacts",
  ACCOUNT: "accounts",
  CUSTOMER: "customers",
  OPPORTUNITY: "opportunities",
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function MailboxPage() {
  const [folder, setFolder] = useState<"inbox" | "unread" | "sent">("inbox");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<MailboxResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<EmailRow | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(query); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        folder: folder === "unread" ? "inbox" : folder,
        page: String(page),
      });
      if (folder === "unread") params.set("unread", "1");
      if (search) params.set("q", search);
      const response = await fetch(`/api/emails?${params.toString()}`);
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? `Request failed (${response.status})`);
      setData(body.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load the mailbox.");
    } finally {
      setLoading(false);
    }
  }, [folder, page, search]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const refresh = () => void load();
    window.addEventListener("crm:realtime-refresh", refresh);
    return () => window.removeEventListener("crm:realtime-refresh", refresh);
  }, [load]);

  async function open(email: EmailRow) {
    setSelected(email);
    if (email.direction === "INBOUND" && !email.read) {
      // Optimistic read-state; the server marks it read too.
      setData((current) => current ? {
        ...current,
        rows: current.rows.map((row) => (row.id === email.id ? { ...row, read: true } : row)),
        unreadCount: Math.max(0, current.unreadCount - 1),
      } : current);
      setSelected({ ...email, read: true });
      void fetch(`/api/emails/${email.id}`, { method: "GET" }).catch(() => undefined);
    }
  }

  async function markUnread(email: EmailRow) {
    const response = await fetch(`/api/emails/${email.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: false }),
    }).catch(() => null);
    if (response?.ok) {
      setSelected(null);
      void load();
    }
  }

  const rows = useMemo(() => data?.rows ?? [], [data]);

  return (
    <div className="space-y-4">
      <WorkspaceHeader
        eyebrow="Mail"
        title="Emails"
        subtitle="Correspondence history — inbound replies arrive here automatically; every send is archived against its record."
        metrics={[
          { label: "Unread", value: data?.unreadCount ?? 0, tone: data?.unreadCount ? "warning" : "brand" },
          { label: "On page", value: rows.length, tone: "info" },
        ]}
      />
      {error ? (
        <p role="alert" className="rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">{error}</p>
      ) : null}

      <div className="card overflow-hidden">
        {/* Toolbar: folders + search */}
        <div className="flex flex-col gap-3 border-b border-(--border-default) bg-(--bg-subtle) px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div role="tablist" aria-label="Mailbox folders" className="flex gap-1">
            {FOLDERS.map((entry) => (
              <button
                key={entry.key}
                role="tab"
                aria-selected={folder === entry.key}
                onClick={() => { setFolder(entry.key); setPage(1); setSelected(null); }}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  folder === entry.key
                    ? "bg-(--bg-surface) text-(--text-primary) shadow-sm"
                    : "text-(--text-secondary) hover:bg-(--bg-hover)"
                }`}
              >
                {entry.label}
                {entry.key === "inbox" && data && data.unreadCount > 0 ? (
                  <span className="ml-1.5 rounded-full bg-(--brand) px-1.5 py-0.5 text-[10px] font-bold text-(--text-inverse)">
                    {data.unreadCount}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="mailbox-search" className="sr-only">Search emails</label>
            <input
              id="mailbox-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search subject, body, addresses…"
              className="input lg:w-72"
            />
          </div>
        </div>

        <div className="grid lg:grid-cols-[380px_1fr]">
          {/* List */}
          <div className="max-h-[70vh] divide-y divide-(--border-default) overflow-y-auto border-b border-(--border-default) lg:border-b-0 lg:border-r">
            {loading && rows.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-(--text-tertiary)">Loading mailbox…</p>
            ) : rows.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-(--text-tertiary)">
                {folder === "sent" ? "No sent emails yet — sends are archived here automatically." : folder === "unread" ? "Inbox zero. Nothing unread." : "No emails match this view."}
              </p>
            ) : (
              rows.map((row) => (
                <button
                  key={row.id}
                  onClick={() => void open(row)}
                  aria-current={selected?.id === row.id}
                  className={`block w-full px-4 py-3 text-left transition hover:bg-(--bg-hover) ${
                    selected?.id === row.id ? "bg-(--bg-selected)" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`truncate text-sm ${row.read ? "text-(--text-secondary)" : "font-bold text-(--text-primary)"}`}>
                      {row.direction === "INBOUND" ? row.from : `To ${row.to}`}
                    </span>
                    <span className="shrink-0 text-[11px] text-(--text-tertiary)">{timeAgo(row.createdAt)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    {!row.read && row.direction === "INBOUND" ? (
                      <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-(--brand)" />
                    ) : (
                      <span aria-hidden className="h-2 w-2 shrink-0 rounded-full border border-(--border-strong)" />
                    )}
                    <span className={`truncate text-sm ${row.read ? "text-(--text-secondary)" : "font-semibold text-(--text-primary)"}`}>
                      {row.status === "FAILED" ? `⚠ ${row.subject}` : row.subject}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-(--text-tertiary)">{row.preview}</p>
                </button>
              ))
            )}
            {data && (data.page > 1 || data.hasMore) ? (
              <div className="flex items-center justify-between px-4 py-2 text-xs text-(--text-secondary)">
                <button
                  type="button"
                  disabled={data.page <= 1 || loading}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="rounded border border-(--border-strong) px-2 py-1 disabled:opacity-40"
                >
                  ← Prev
                </button>
                <span>Page {data.page}</span>
                <button
                  type="button"
                  disabled={!data.hasMore || loading}
                  onClick={() => setPage((current) => current + 1)}
                  className="rounded border border-(--border-strong) px-2 py-1 disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            ) : null}
          </div>

          {/* Reading pane */}
          <div className="max-h-[70vh] overflow-y-auto p-5">
            {selected ? (
              <article>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-(--border-default) pb-4">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-(--text-primary)">{selected.subject}</h2>
                    <p className="mt-1 text-sm text-(--text-secondary)">
                      <span className="font-medium">{selected.direction === "INBOUND" ? "From" : "To"}:</span>{" "}
                      {selected.direction === "INBOUND" ? selected.from : selected.to}
                      {selected.cc ? <span className="text-(--text-tertiary)"> · cc {selected.cc}</span> : null}
                    </p>
                    <p className="mt-0.5 text-xs text-(--text-tertiary)">
                      {new Date(selected.createdAt).toLocaleString()}
                      {selected.sentBy ? ` · sent by ${selected.sentBy}` : ""}
                      {selected.status === "FAILED" ? ` · failed: ${selected.error ?? "unknown error"}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {selected.subjectType && selected.subjectId && RECORD_PATH[selected.subjectType] ? (
                      <Link
                        href={`/${RECORD_PATH[selected.subjectType]}/${selected.subjectId}`}
                        className="rounded-md border border-(--border-strong) px-2.5 py-1.5 text-xs font-medium hover:bg-(--bg-hover)"
                      >
                        View {selected.subjectType.toLowerCase()} →
                      </Link>
                    ) : null}
                    {selected.direction === "INBOUND" ? (
                      <button
                        type="button"
                        onClick={() => void markUnread(selected)}
                        className="rounded-md border border-(--border-strong) px-2.5 py-1.5 text-xs font-medium hover:bg-(--bg-hover)"
                      >
                        Mark unread
                      </button>
                    ) : null}
                  </div>
                </div>
                <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-relaxed text-(--text-primary)">{selected.body}</pre>
              </article>
            ) : (
              <div className="flex h-full min-h-64 items-center justify-center text-sm text-(--text-tertiary)">
                Select an email to read it.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
