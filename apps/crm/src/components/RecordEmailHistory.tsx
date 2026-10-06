"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Icon } from "@/components/Icon";
import { cn } from "@/lib/utils";
import { relativeTime, absoluteTime } from "@/lib/time";

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

  const unread = rows.filter((row) => row.direction === "INBOUND" && !row.read).length;

  return (
    <Card aria-labelledby="record-email-history" className="gap-3">
      <CardHeader className="flex-row items-center justify-between">
        <h2 id="record-email-history" className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden>
            <Icon name="mail" size={13} />
          </span>
          Email history
          {rows.length > 0 ? (
            <span className="rounded-full bg-muted px-1.5 py-px text-[10px] font-semibold tabular-nums text-muted-foreground">{rows.length}</span>
          ) : null}
          {unread > 0 ? (
            <span className="rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-semibold tabular-nums text-primary">{unread} unread</span>
          ) : null}
        </h2>
        <Link href="/emails" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          Open mailbox <Icon name="chevron_right" size={12} />
        </Link>
      </CardHeader>
      <CardContent>
      {error ? (
        <p role="alert" className="rounded-md bg-(--error-bg) px-3 py-2 text-sm text-(--error)">{error}</p>
      ) : loading ? (
        <p className="text-sm text-(--text-tertiary)">Loading emails…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon="mail"
          title="No email correspondence yet"
          description="Emails sent from this record — and replies from this address — appear here."
          className="py-6"
        />
      ) : (
        <ul className="space-y-1.5">
          {rows.slice(0, 10).map((row) => {
            const isOpen = open?.id === row.id;
            const isUnread = row.direction === "INBOUND" && !row.read;
            return (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => void openEmail(row)}
                aria-expanded={isOpen}
                className={cn(
                  "group/mail flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2 py-2 text-left transition-colors",
                  isOpen ? "border-border bg-muted/40" : "hover:border-border/70 hover:bg-muted/30"
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-md",
                    row.status === "FAILED" ? "bg-(--error-bg) text-(--error)" : row.direction === "INBOUND" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}
                  aria-hidden
                >
                  <Icon name={row.status === "FAILED" ? "alert" : row.direction === "INBOUND" ? "download" : "upload"} size={13} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    {isUnread ? <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-label="Unread" /> : null}
                    <span className={cn("truncate text-[13px]", isUnread ? "font-semibold text-foreground" : "font-medium text-foreground")}>
                      {row.subject}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold uppercase",
                        row.direction === "INBOUND" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {row.direction === "INBOUND" ? "In" : "Out"}
                    </span>
                    {row.status === "FAILED" ? (
                      <span className="shrink-0 rounded-full bg-(--error-bg) px-1.5 py-px text-[10px] font-semibold uppercase text-(--error)">Failed</span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-(--text-tertiary)">
                    {row.direction === "INBOUND" ? row.from : `to ${row.to}`} · {row.preview}
                  </span>
                </span>
                <time
                  className="shrink-0 text-[11px] tabular-nums text-(--text-tertiary)"
                  dateTime={row.createdAt}
                  title={absoluteTime(row.createdAt)}
                >
                  {relativeTime(row.createdAt)}
                </time>
              </button>
              {isOpen ? (
                <div className="mx-2 mb-1.5 rounded-lg border border-border/70 bg-muted/30 p-3">
                  <p className="text-xs text-(--text-tertiary)">
                    {absoluteTime(row.createdAt)}
                    {row.sentBy ? ` · sent by ${row.sentBy}` : ""}
                    {row.status === "FAILED" ? ` · failed: ${row.error ?? "unknown"}` : ""}
                  </p>
                  <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-foreground">{row.body}</pre>
                </div>
              ) : null}
            </li>
          );})}
        </ul>
      )}
      </CardContent>
      {rows.length > 10 ? (
        <p className="mt-2 text-xs text-(--text-tertiary)">
          Showing the latest 10 of {rows.length} — <Link href="/emails" className="text-primary hover:underline">view all in the mailbox</Link>.
        </p>
      ) : null}
    </Card>
  );
}
