"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/Alert";
import { ArrowRight, Headset, MessageCircle, Send } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { fmtAgo, fmtDateTime } from "@/lib/dates";

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
    <div className="flex h-[min(70vh,32rem)] flex-col rounded-xl bg-card">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">BF</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Support chat</h2>
          <p className="text-xs text-muted-foreground">Talk directly with our team — replies land here and in your notifications.</p>
        </div>
        <Badge variant="secondary" className="bg-(--term-success-bg) text-(--term-success-fg)">
          <span className="size-1.5 rounded-full bg-(--term-success-fg)" aria-hidden /> Online
        </Badge>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {!hasThread && (
          <div className="flex flex-col items-center gap-2 rounded-xl bg-muted/40 px-4 py-10 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <MessageCircle size={18} strokeWidth={1.75} aria-hidden />
            </span>
            <p className="text-sm font-medium">No messages yet</p>
            <p className="text-xs text-muted-foreground">Say hello and our team will reply here.</p>
          </div>
        )}
        {messages.map((message) => {
          const mine = inbox?.role === "customer" && message.senderId === inbox.viewerId;
          return (
            <div key={message.id} className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
              {!mine && (
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                  {(message.senderName ?? "S")[0]?.toUpperCase()}
                </span>
              )}
              <div className={`max-w-[80%] ${mine ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                <span className={`px-1 text-xs font-semibold ${mine ? "text-muted-foreground" : "text-muted-foreground"}`}>
                  {mine ? "You" : `Support · ${message.senderName}`}
                </span>
                <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                  {message.body}
                  <div className={`mt-1 flex items-center justify-end gap-1.5 text-xs ${mine ? "opacity-60" : "text-muted-foreground"}`}>
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
        <div className="mx-4 mb-2">
          <Alert tone="err" className="py-2 text-xs">
            <span className="flex flex-wrap items-center justify-between gap-2">
              {error ?? actionError}
              <button type="button" onClick={() => void load()} className="shrink-0 font-medium underline underline-offset-2">Retry</button>
            </span>
          </Alert>
        </div>
      )}

      <form onSubmit={send} className="flex items-end gap-2 border-t border-border p-3">
        <Textarea
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
          className="flex-1 resize-none"
        />
        <Button type="submit" size="sm" variant="default" loading={sending} disabled={!draft.trim()}><Send size={12} strokeWidth={2} aria-hidden /> Send</Button>
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
    <div className="space-y-6">
      {/* Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Headset size={18} strokeWidth={1.75} aria-hidden />
            </span>
            <div className="min-w-0">
              <CardTitle>Support inbox</CardTitle>
              <CardDescription>
                You&apos;re signed in as an operator — customer conversations are owned by the team and handled from the Operations console.
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {awaiting.length > 0 && (
              <Badge variant="secondary" className="bg-(--term-warning-bg) text-(--term-warning-fg)">{awaiting.length} awaiting reply</Badge>
            )}
            {threads && threads.totalUnread > 0 && (
              <Badge className="bg-primary text-primary-foreground">{threads.totalUnread} unread</Badge>
            )}
            {awaiting.length === 0 && (!threads || threads.totalUnread === 0) && (
              <Badge variant="secondary" className="bg-(--term-success-bg) text-(--term-success-fg)">All caught up</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="default" size="sm" asChild>
            <Link href="/admin" className="inline-flex items-center gap-2">
              Open Operations console
              <ArrowRight size={13} strokeWidth={2} aria-hidden />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Recent conversations */}
      <Card>
        <CardHeader>
          <CardTitle>Recent conversations</CardTitle>
          <CardDescription>Newest activity first.</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {threads == null ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <MessageCircle size={18} strokeWidth={1.75} aria-hidden />
              </div>
              <p className="text-sm font-medium">No support access</p>
              <p className="text-xs text-muted-foreground">Your role doesn&apos;t include support access — contact an administrator if you need it.</p>
            </div>
          ) : threads.threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <MessageCircle size={18} strokeWidth={1.75} aria-hidden />
              </div>
              <p className="text-sm font-medium">No customer conversations yet</p>
            </div>
          ) : (
            <ul className="space-y-1 px-3 pb-3">
              {recent.map((thread) => {
                const waiting = thread.status === "AWAITING_REPLY";
                return (
                  <li key={thread.userId}>
                    <Link
                      href="/admin"
                      className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted/50"
                    >
                      <span className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${waiting ? "bg-(--term-warning-bg) text-(--term-warning-fg)" : "bg-muted text-muted-foreground"}`}>
                        {(thread.name ?? thread.email ?? thread.userId)[0]?.toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{thread.name ?? thread.email ?? thread.userId}</span>
                          {thread.unread > 0 && (
                            <Badge className="bg-primary px-1.5 text-xs">{thread.unread} new</Badge>
                          )}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{thread.lastMessage || "—"}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge variant="secondary" className={waiting ? "bg-(--term-warning-bg) text-(--term-warning-fg)" : "bg-(--term-success-bg) text-(--term-success-fg)"}>
                          {waiting ? "Awaiting reply" : "Replied"}
                        </Badge>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {thread.lastMessageAt ? fmtAgo(thread.lastMessageAt) : ""}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
