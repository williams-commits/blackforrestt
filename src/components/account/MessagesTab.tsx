"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Send } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { fmtDateTime } from "@/lib/dates";

interface MessageRow {
  id: string;
  senderId: string;
  senderName: string;
  senderIsAdmin: boolean;
  recipientId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

interface ThreadRow {
  userId: string;
  email: string | null;
  name: string | null;
  accountNo: string | null;
  lastMessageAt: string | null;
  lastMessage: string;
  lastFromAdmin: boolean;
  unread: number;
  status: "AWAITING_REPLY" | "REPLIED";
}

type Inbox =
  | { viewerId: string; role: "customer"; messages: MessageRow[]; hasMore: boolean; hasThread: boolean }
  | { viewerId: string; role: "operator"; threads: { threads: ThreadRow[]; totalUnread: number } | null };

/** Two-way chat with the support/admin team. Operators see a shared-inbox
 *  summary instead — their replies belong in the Operations console. Polls
 *  every 15s while visible. */
export function MessagesTab() {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  // Send failures are action errors, distinct from the query error.
  const [actionError, setActionError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Server state via react-query: 8s auto-sync keeps read receipts feeling
  // live ("✓ Sent" flips to "✓ Read" shortly after the other side opens the
  // chat). The interval pauses in hidden tabs natively; the queryFn only
  // marks the thread read when the window is VISIBLE (?poll=1 fetches
  // without consuming the unread badge) — the badge is only spent while the
  // customer is actually looking at the conversation. Window-focus refetch
  // and badge-watcher invalidation come from react-query defaults + the
  // effect below.
  const { data: inbox, isPending, error: queryError, refetch } = useQuery({
    queryKey: ["account-messages"],
    queryFn: async () => {
      const poll = document.hidden ? "?poll=1" : "";
      const response = await fetch(`/api/messages${poll}`, { cache: "no-store" });
      const data = await response.json().catch(() => null) as (Inbox & { error?: string }) | null;
      if (!response.ok) throw new Error(data?.error ?? "Unable to load messages.");
      if (!data || (data.role !== "customer" && data.role !== "operator")) {
        throw new Error("Unexpected response from the server.");
      }
      return data;
    },
    refetchInterval: 8_000,
    staleTime: 5_000,
  });
  const loading = isPending;
  const error = queryError instanceof Error ? queryError.message : null;
  const load = useCallback(async () => { await refetch(); }, [refetch]);

  // The shell's badge watcher reports new activity — reload immediately.
  useEffect(() => {
    const onCountsChanged = () => void refetch();
    window.addEventListener("blckforest:counts-changed", onCountsChanged);
    return () => window.removeEventListener("blckforest:counts-changed", onCountsChanged);
  }, [refetch]);

  const messageCount = inbox?.role === "customer" ? inbox.messages.length : 0;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [messageCount]);

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending || inbox?.role !== "customer") return;
    setSending(true);
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Unable to send the message.");
      setDraft("");
      setActionError(null);
      await load();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Unable to send the message.");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-2" role="status" aria-label="Loading messages">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-10 w-3/4" />
      </div>
    );
  }

  if (inbox?.role === "operator") {
    return <OperatorInbox threads={inbox.threads} />;
  }

  const messages = inbox?.role === "customer" ? inbox.messages : [];
  const hasThread = inbox?.role === "customer" ? inbox.hasThread : false;

  return (
    <div className="flex h-[min(70vh,32rem)] flex-col rounded-lg border border-border bg-canvas">
      <div className="border-b border-border-soft px-4 py-3">
        <h2 className="text-sm font-semibold">Support chat</h2>
        <p className="text-(length:--term-text-xs) text-text-muted">Talk directly with our team — replies land here and in your notifications.</p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {!hasThread && (
          <p className="rounded border border-dashed border-border px-4 py-8 text-center text-xs text-text-muted">
            No messages yet — say hello and our team will reply here.
          </p>
        )}
        {messages.map((message) => {
          const mine = inbox?.role === "customer" && message.senderId === inbox.viewerId;
          return (
            <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] ${mine ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                <span className={`px-1 text-(length:--term-text-2xs) font-semibold uppercase tracking-wide ${mine ? "text-text-faint" : "text-text-muted"}`}>
                  {mine ? "You" : `Support · ${message.senderName}`}
                </span>
                <div className={`rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${mine ? "bg-brand text-white" : "bg-panel-2 text-text"}`}>
                  {message.body}
                  <div className={`mt-1 flex items-center justify-end gap-1.5 text-(length:--term-text-2xs) ${mine ? "text-white/60" : "text-text-faint"}`}>
                    <span className="tnum">{fmtDateTime(message.createdAt)}</span>
                    {mine && <span aria-label={message.readAt ? "Read by support" : "Not yet read"}>{message.readAt ? "✓✓ Read" : "✓ Sent"}</span>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {(error ?? actionError) && (
        <div role="alert" className="mx-4 mb-2 flex items-center justify-between gap-2 rounded border border-down/40 bg-down/10 px-3 py-2 text-xs text-down">
          <span>{error ?? actionError}</span>
          <button type="button" onClick={() => void load()} className="shrink-0 font-medium underline underline-offset-2">Retry</button>
        </div>
      )}

      <form onSubmit={send} className="flex items-end gap-2 border-t border-border-soft p-3">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && draft.trim() && !sending) {
              event.preventDefault();
              void send(event as unknown as React.FormEvent<HTMLFormElement>);
            }
          }}
          rows={2}
          maxLength={4000}
          placeholder="Type a message… (Enter to send, Shift+Enter for a new line)"
          aria-label="Message body"
          className="flex-1 resize-none rounded border border-border bg-panel px-3 py-2 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20"
        />
        <Button type="submit" size="sm" variant="brand" loading={sending} disabled={!draft.trim()}><Send size={12} strokeWidth={2} aria-hidden /> Send</Button>
      </form>
    </div>
  );
}

/** Operators don't have a personal support thread — customer conversations are
 *  owned by the team and handled from the Operations console. This panel shows
 *  the shared inbox state and routes there. */
function OperatorInbox({ threads }: { threads: { threads: ThreadRow[]; totalUnread: number } | null }) {
  const awaiting = threads?.threads.filter((thread) => thread.status === "AWAITING_REPLY") ?? [];
  const recent = threads?.threads.slice(0, 6) ?? [];
  return (
    <div className="rounded-lg border border-border bg-canvas">
      <div className="border-b border-border-soft px-4 py-3">
        <h2 className="text-sm font-semibold">Support inbox</h2>
        <p className="text-(length:--term-text-xs) text-text-muted">
          You&apos;re signed in as an operator. Customer conversations are handled from the Operations console — they never appear as your personal messages.
        </p>
      </div>
      <div className="px-4 py-3">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 rounded bg-brand px-3 py-2 text-xs font-medium text-white hover:brightness-95"
        >
          Open Operations console
          {threads && threads.totalUnread > 0 && (
            <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-(length:--term-text-2xs) font-bold">{threads.totalUnread} unread</span>
          )}
        </Link>
      </div>
      {threads ? (
        threads.threads.length === 0 ? (
          <p className="border-t border-border-soft px-4 py-6 text-center text-xs text-text-muted">No customer conversations yet.</p>
        ) : (
          <ul className="divide-y divide-border-soft border-t border-border-soft" aria-label="Recent conversations">
            {recent.map((thread) => (
              <li key={thread.userId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-medium">{thread.name ?? thread.email ?? thread.userId}</span>
                    {thread.unread > 0 && (
                      <span className="rounded-full bg-brand px-1.5 py-0.5 text-(length:--term-text-2xs) font-bold text-white">{thread.unread} new</span>
                    )}
                  </div>
                  <div className="truncate text-(length:--term-text-2xs) text-text-faint">
                    {thread.status === "AWAITING_REPLY" ? "Waiting for a reply" : "Replied"} · {thread.lastMessage || "—"}
                  </div>
                </div>
                <span className="shrink-0 text-(length:--term-text-2xs) text-text-faint tnum">{thread.lastMessageAt ? fmtDateTime(thread.lastMessageAt) : ""}</span>
              </li>
            ))}
          </ul>
        )
      ) : (
        <p className="border-t border-border-soft px-4 py-6 text-center text-xs text-text-muted">
          Your role doesn&apos;t include support access — contact an administrator if you need it.
        </p>
      )}
      {threads && awaiting.length > 0 && (
        <p className="border-t border-border-soft px-4 py-2 text-(length:--term-text-2xs) text-text-muted">
          {awaiting.length} conversation{awaiting.length === 1 ? "" : "s"} waiting for a reply.
        </p>
      )}
    </div>
  );
}
