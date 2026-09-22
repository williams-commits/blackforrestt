"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { EmailCompose } from "@/components/EmailCompose";
import { Button } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/Icon";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchInput } from "@/components/form";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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
  htmlBody: string | null;
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
  { key: "inbox", label: "Inbox", icon: "mail" },
  { key: "unread", label: "Unread", icon: "bell" },
  { key: "sent", label: "Sent", icon: "external" },
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
  const [compose, setCompose] = useState<null | { to?: string; subject?: string; body?: string; html?: string }>(null);
  const [smtpConfigured, setSmtpConfigured] = useState<boolean | null>(null);
  const searchParams = useSearchParams();
  const filteredUserId = searchParams.get("userId") ?? null;
  const filteredUserName = searchParams.get("userName") ?? "selected user";
  const [mineOnly, setMineOnly] = useState(false);

  useEffect(() => {
    void fetch("/api/emails/send")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => setSmtpConfigured(Boolean(body?.data?.configured)))
      .catch(() => setSmtpConfigured(false));
  }, []);

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
      if (filteredUserId) params.set("userId", filteredUserId);
      else if (mineOnly) params.set("mine", "1");
      const response = await fetch(`/api/emails?${params.toString()}`);
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? `Request failed (${response.status})`);
      setData(body.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load the mailbox.");
    } finally {
      setLoading(false);
    }
  }, [folder, page, search, filteredUserId, mineOnly]);

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
    } else {
      setError("Could not mark the message as unread — try again.");
    }
  }

  const rows = useMemo(() => data?.rows ?? [], [data]);

  return (
    <div className="space-y-4" data-module="emails">
      <WorkspaceHeader
        eyebrow="Mail"
        title="Emails"
        subtitle="Correspondence history — inbound replies arrive here automatically; every send is archived against its record."
        actions={
          <Button variant="primary" icon="edit" onClick={() => setCompose({})}>
            Compose
          </Button>
        }
        metrics={[
          { label: "Unread", value: data?.unreadCount ?? 0, tone: data?.unreadCount ? "warning" : "brand" },
          { label: "On page", value: rows.length, tone: "info" },
        ]}
      />
      {error ? (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}
      {smtpConfigured === false ? (
        <div role="status" className="flex items-start gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
          <span aria-hidden>⚠</span>
          <span>
            <strong>SMTP is not configured.</strong> Sending is disabled — set{" "}
            <code className="rounded bg-background px-1 font-mono text-xs">SMTP_URL</code> and{" "}
            <code className="rounded bg-background px-1 font-mono text-xs">SMTP_FROM</code> in the environment and reload. Inbound
            email (webhook) is unaffected.
          </span>
        </div>
      ) : null}

      {/* Toolbar: search + filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        {filteredUserId ? (
          <Badge variant="secondary" className="gap-1 rounded-full px-3 py-1 text-xs font-medium">
            Mail of {filteredUserName}
            <Link href="/emails" aria-label="Clear user filter" className="text-muted-foreground hover:text-foreground">×</Link>
          </Badge>
        ) : null}
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Checkbox
            checked={mineOnly}
            onCheckedChange={(checked) => { setMineOnly(checked === true); setPage(1); }}
          />
          Me
        </label>
        <Label htmlFor="mailbox-search" className="sr-only">Search emails</Label>
        <SearchInput
          id="mailbox-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search subject, body, addresses…"
          className="h-8"
          wrapperClassName="w-full sm:w-64 lg:w-72"
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
        {/* Folder rail — quiet rows, active row on muted */}
        <Card className="gap-0 p-2">
          <div role="tablist" aria-label="Mailbox folders" className="flex gap-1 overflow-x-auto lg:flex-col">
            {FOLDERS.map((entry) => (
              <button
                key={entry.key}
                role="tab"
                aria-selected={folder === entry.key}
                onClick={() => { setFolder(entry.key); setPage(1); setSelected(null); }}
                className={cn(
                  "flex shrink-0 items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  folder === entry.key
                    ? "bg-muted font-semibold text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <span className="flex items-center gap-2">
                  <Icon name={entry.icon} size={14} className={folder === entry.key ? "text-foreground" : "text-muted-foreground"} />
                  {entry.label}
                </span>
                {entry.key === "inbox" && data && data.unreadCount > 0 ? (
                  <Badge className="px-1.5 text-[10px] font-bold">{data.unreadCount}</Badge>
                ) : null}
              </button>
            ))}
          </div>
        </Card>

        <Card className="gap-0 overflow-hidden py-0">
          <div className="grid lg:grid-cols-[360px_1fr]">
          {/* List */}
          <div className="max-h-[70vh] divide-y divide-border overflow-y-auto border-b border-border lg:border-b-0 lg:border-r">
            {loading && rows.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">Loading mailbox…</p>
            ) : rows.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                {folder === "sent" ? "No sent emails yet — sends are archived here automatically." : folder === "unread" ? "Inbox zero. Nothing unread." : "No emails match this view."}
              </p>
            ) : (
              rows.map((row) => (
                <button
                  key={row.id}
                  onClick={() => void open(row)}
                  aria-current={selected?.id === row.id}
                  className={cn(
                    "block w-full px-4 py-3 text-left transition-colors hover:bg-muted/60",
                    selected?.id === row.id ? "bg-muted" : ""
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("truncate text-sm", row.read ? "text-muted-foreground" : "font-bold text-foreground")}>
                      {row.direction === "INBOUND" ? row.from : `To ${row.to}`}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground/70">{timeAgo(row.createdAt)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    {!row.read && row.direction === "INBOUND" ? (
                      <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-foreground" />
                    ) : (
                      <span aria-hidden className="h-2 w-2 shrink-0 rounded-full border border-border" />
                    )}
                    <span className={cn("truncate text-sm", row.read ? "text-muted-foreground" : "font-semibold text-foreground")}>
                      {row.status === "FAILED" ? `⚠ ${row.subject}` : row.subject}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground/70">{row.preview}</p>
                </button>
              ))
            )}
            {data && (data.page > 1 || data.hasMore) ? (
              <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={data.page <= 1 || loading}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  ← Prev
                </Button>
                <span>Page {data.page}</span>
                <Button
                  size="sm"
                  variant="secondary"
                  icon="chevron_right"
                  disabled={!data.hasMore || loading}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next →
                </Button>
              </div>
            ) : null}
          </div>

          {/* Reading pane */}
          <div className="max-h-[70vh] overflow-y-auto p-5">
            {selected ? (
              <article>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-foreground">{selected.subject}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{selected.direction === "INBOUND" ? "From" : "To"}:</span>{" "}
                      {selected.direction === "INBOUND" ? selected.from : selected.to}
                      {selected.cc ? <span className="text-muted-foreground/70"> · cc {selected.cc}</span> : null}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground/70">
                      {new Date(selected.createdAt).toLocaleString()}
                      {selected.sentBy ? ` · sent by ${selected.sentBy}` : ""}
                      {selected.status === "FAILED" ? ` · failed: ${selected.error ?? "unknown error"}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {selected.subjectType && selected.subjectId && RECORD_PATH[selected.subjectType] ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon="external"
                        href={`/${RECORD_PATH[selected.subjectType]}/${selected.subjectId}`}
                      >
                        View {selected.subjectType.toLowerCase()} →
                      </Button>
                    ) : null}
                    {selected.direction === "INBOUND" ? (
                      <>
                        <Button
                          size="sm"
                          variant="primary"
                          icon="mail"
                          onClick={() => {
                            const escapeHtml = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
                            const quote = selected.body
                              .split("\n")
                              .map((line) => `<p>${escapeHtml(line) || "<br>"}</p>`)
                              .join("");
                            setCompose({
                              to: selected.from,
                              subject: selected.subject.startsWith("Re:") ? selected.subject : `Re: ${selected.subject}`,
                              body: `\n\n---- On ${new Date(selected.createdAt).toLocaleString()}, ${selected.from} wrote:\n${selected.body}`,
                              html: `<p><br></p><p>On ${new Date(selected.createdAt).toLocaleString()}, ${escapeHtml(selected.from)} wrote:</p><blockquote>${quote}</blockquote>`,
                            });
                          }}
                        >
                          Reply
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          icon="mail"
                          onClick={() => void markUnread(selected)}
                        >
                          Mark unread
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
                {selected.htmlBody ? (
                  <div
                    className="mt-4 max-w-none text-sm leading-relaxed text-foreground [&_a]:text-foreground [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-6"
                    dangerouslySetInnerHTML={{ __html: selected.htmlBody }}
                  />
                ) : (
                  <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">{selected.body}</pre>
                )}
              </article>
            ) : (
              <div className="flex h-full min-h-64 items-center justify-center text-sm text-muted-foreground/70">
                Select an email to read it.
              </div>
            )}
          </div>
        </div>
        </Card>
      </div>
      {compose ? (
        <EmailCompose
          toEmail={compose.to ?? null}
          initialSubject={compose.subject}
          initialBody={compose.body}
          initialHtml={compose.html}
          onClose={() => { setCompose(null); void load(); }}
          onSent={() => void load()}
        />
      ) : null}
    </div>
  );
}
