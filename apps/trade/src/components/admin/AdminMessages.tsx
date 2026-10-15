"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SimpleDialog as Dialog } from "@/components/ui/Dialog";
import { Megaphone, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/lib/toast";
import { fmtDateTime } from "@/lib/dates";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface ThreadRow {
  userId: string;
  email: string | null;
  name: string | null;
  accountNo: string | null;
  brandDomain?: string | null;
  lastMessageAt: string | null;
  lastMessage: string;
  lastFromAdmin: boolean;
  unread: number;
  status: "AWAITING_REPLY" | "REPLIED";
}

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

interface ThreadState {
  viewerId: string;
  user: { id: string; name: string | null; email: string | null; accountNo: string | null };
  messages: MessageRow[];
  hasMore: boolean;
}

const PAGE_SIZE = 100;

/** Admin shared support inbox: searchable thread list with unread badges and
 *  reply status, live chat pane with sender attribution and read receipts, and
 *  the broadcast notification composer. Message direction comes from the API
 *  (viewerId + senderIsAdmin) — the client never infers identity. */
export function AdminMessages({ chatWith, onChatHandled }: { chatWith: { userId: string; label: string } | null; onChatHandled: () => void }) {
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeUser, setActiveUser] = useState<{ id: string; label: string } | null>(null);
  const [thread, setThread] = useState<ThreadState | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [bTitle, setBTitle] = useState("");
  const [bBody, setBBody] = useState("");
  const [bBusy, setBBusy] = useState(false);
  const [bError, setBError] = useState<string | null>(null);
  const [bResult, setBResult] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);

  const loadThreads = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/messages", { cache: "no-store" });
      const data = await response.json().catch(() => null) as { threads?: ThreadRow[]; totalUnread?: number; error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Unable to load threads.");
      setThreads(data?.threads ?? []);
      setTotalUnread(data?.totalUnread ?? 0);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load threads.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadThread = useCallback(async (userId: string, currentLimit: number) => {
    const response = await fetch(`/api/admin/messages?userId=${encodeURIComponent(userId)}&limit=${currentLimit}`, { cache: "no-store" });
    const data = await response.json().catch(() => null) as (ThreadState & { error?: string }) | null;
    if (!response.ok) throw new Error(data?.error ?? "Unable to load the thread.");
    if (data?.messages) setThread(data);
  }, []);

  useEffect(() => {
    void loadThreads();
    const timer = window.setInterval(() => { if (!document.hidden) void loadThreads(); }, 15_000);
    return () => window.clearInterval(timer);
  }, [loadThreads]);

  // Deep-link from UsersPanel "Chat" button
  useEffect(() => {
    if (chatWith) {
      setActiveUser({ id: chatWith.userId, label: chatWith.label });
      onChatHandled();
    }
  }, [chatWith, onChatHandled]);

  useEffect(() => {
    if (!activeUser) {
      setThread(null);
      return;
    }
    setThreadLoading(true);
    setThreadError(null);
    void loadThread(activeUser.id, limit)
      .catch((cause) => setThreadError(cause instanceof Error ? cause.message : "Unable to load the thread."))
      .finally(() => setThreadLoading(false));
    const timer = window.setInterval(() => {
      if (!document.hidden && activeUser) void loadThread(activeUser.id, limit).catch(() => undefined);
    }, 10_000);
    // Focus refresh keeps read receipts ("✓ Read") live when the operator
    // returns to the window after the customer reads the thread.
    const onFocus = () => { if (activeUser) void loadThread(activeUser.id, limit).catch(() => undefined); };
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [activeUser, limit, loadThread]);

  const messageCount = thread?.messages.length ?? 0;
  useEffect(() => {
    if (wasAtBottomRef.current) bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [messageCount]);

  function loadEarlier() {
    setLimit((current) => Math.min(200, current + PAGE_SIZE));
  }

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!activeUser || !body || sending) return;
    setSending(true);
    setThreadError(null);
    try {
      const response = await fetch("/api/admin/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: activeUser.id, body }),
      });
      const data = await response.json().catch(() => ({})) as { message?: MessageRow; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Send failed.");
      setDraft("");
      // Optimistically append the serialized message the server returned, then
      // refresh the inbox so last-message/unread state stays in sync.
      if (data.message && thread && thread.messages[thread.messages.length - 1]?.id !== data.message.id) {
        setThread((current) => current ? { ...current, messages: [...current.messages, data.message!] } : current);
      }
      await Promise.all([loadThread(activeUser.id, limit), loadThreads()]);
    } catch (cause) {
      setThreadError(cause instanceof Error ? cause.message : "Send failed.");
    } finally {
      setSending(false);
    }
  }

  async function broadcast(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBBusy(true);
    setBError(null);
    setBResult(null);
    try {
      const response = await fetch("/api/admin/notifications/broadcast", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: bTitle, body: bBody }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Broadcast failed.");
      setBResult(`Delivered to ${data.recipients} user(s).`);
      setBTitle("");
      setBBody("");
    } catch (cause) {
      setBError(cause instanceof Error ? cause.message : "Broadcast failed.");
    } finally {
      setBBusy(false);
    }
  }

  /** Moderation: permanently remove the customer's whole thread (audited). */
  async function deleteThread() {
    if (!activeUser) return;
    setDeleteBusy(true);
    try {
      const response = await fetch(`/api/admin/messages?userId=${encodeURIComponent(activeUser.id)}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({})) as { deleted?: number; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Delete failed.");
      toast.success("Conversation deleted", `${data.deleted ?? 0} message(s) removed for ${activeUser.label}. The deletion is recorded in the audit trail.`);
      setDeleteOpen(false);
      setThread(null);
      setActiveUser(null);
      await loadThreads();
    } catch (cause) {
      toast.error("Delete failed", cause instanceof Error ? cause.message : "Unable to delete the conversation.");
    } finally {
      setDeleteBusy(false);
    }
  }

  if (loading) {
    return <div className="space-y-2" role="status" aria-label="Loading messages"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-10 w-2/3" /><Skeleton className="h-10 w-1/3" /></div>;
  }

  const needle = search.trim().toLowerCase();
  const visibleThreads = threads.filter((thread) => {
    if (unreadOnly && thread.unread === 0) return false;
    if (!needle) return true;
    return [thread.name, thread.email, thread.accountNo, thread.brandDomain ?? "", thread.lastMessage]
      .some((field) => field?.toLowerCase().includes(needle));
  });

  return (
    <section className="space-y-3" aria-labelledby="admin-messages-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="admin-messages-heading" className="text-sm font-semibold">Customer messages</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Shared team inbox — every operator sees the same threads.{" "}
            {totalUnread > 0
              ? <span className="font-medium text-primary">{totalUnread} unread message{totalUnread === 1 ? "" : "s"}</span>
              : "All caught up."}
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => { setBError(null); setBResult(null); setBroadcastOpen(true); }}><Megaphone size={13} strokeWidth={2} aria-hidden /> New broadcast</Button>
      </div>

      {error && (
        <Alert tone="err" className="flex items-center justify-between gap-2 text-xs">
          <span>{error}</span>
          <button type="button" onClick={() => void loadThreads()} className="shrink-0 font-medium underline underline-offset-2">Retry</button>
        </Alert>
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(240px,340px)_minmax(0,1fr)]">
        {/* Thread list */}
        <div className="flex max-h-144 flex-col">
          <div className="space-y-2 border-b border-border p-2">
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, account…"
              aria-label="Search conversations"
            />
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Checkbox checked={unreadOnly} onCheckedChange={(checked) => setUnreadOnly(checked === true)} aria-label="Unread only" />
              Unread only
            </Label>
          </div>
          <div className="flex-1 overflow-y-auto">
            {visibleThreads.length === 0 && (
              <p className="p-6 text-center text-xs text-muted-foreground">
                {threads.length === 0 ? "No conversations yet. Open a user in the Users tab and press “Chat”." : "No conversations match."}
              </p>
            )}
            {visibleThreads.map((threadRow) => (
              <button
                key={threadRow.userId}
                type="button"
                onClick={() => { setLimit(PAGE_SIZE); setActiveUser({ id: threadRow.userId, label: threadRow.name ?? threadRow.email ?? threadRow.userId }); }}
                aria-current={activeUser?.id === threadRow.userId ? "true" : undefined}
                className={`block w-full border-b border-border px-3 py-3 text-left last:border-0 hover:bg-accent/60 ${activeUser?.id === threadRow.userId ? "bg-muted/60" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`truncate text-xs ${threadRow.unread > 0 ? "font-semibold" : "font-medium"}`}>{threadRow.name ?? "Unnamed"}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{threadRow.lastMessageAt ? fmtDateTime(threadRow.lastMessageAt) : ""}</span>
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {threadRow.email ?? "—"} · #{threadRow.accountNo ?? "—"}
                  {threadRow.brandDomain && <span className="ml-1 rounded bg-primary/10 px-1 py-px text-xs font-semibold text-primary">{threadRow.brandDomain}</span>}
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <Badge variant="secondary" className={`px-1.5 py-0 text-xs ${threadRow.status === "AWAITING_REPLY" ? "bg-(--term-warning-bg) text-(--term-warning-fg)" : ""}`}>
                    {threadRow.status === "AWAITING_REPLY" ? "Awaiting reply" : "Replied"}
                  </Badge>
                  {threadRow.unread > 0 && (
                    <Badge className="px-1.5 py-0 text-xs">{threadRow.unread}</Badge>
                  )}
                  <span className={`truncate text-xs ${threadRow.lastFromAdmin ? "text-muted-foreground" : "text-foreground font-medium"}`}>
                    {threadRow.lastFromAdmin ? "You: " : ""}{threadRow.lastMessage || "(no messages)"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat pane */}
        <div className="flex h-144 flex-col">
          {activeUser ? (
            <>
              <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold">{thread?.user ? (thread.user.name ?? thread.user.email ?? activeUser.label) : activeUser.label}</div>
                  {thread?.user && (
                    <div className="truncate text-xs text-muted-foreground">{thread.user.email ?? "—"} · #{thread.user.accountNo ?? "—"}</div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleteOpen(true)}
                    className="text-xs font-medium text-down/80 hover:text-down hover:underline underline-offset-2"
                    title="Permanently delete this conversation (audited)"
                  >
                    delete
                  </button>
                  <button type="button" onClick={() => { setActiveUser(null); setThread(null); }} className="text-xs text-muted-foreground hover:text-foreground">close</button>
                </div>
              </div>
              <div
                className="flex-1 space-y-2 overflow-y-auto px-4 py-3"
                onScroll={(event) => {
                  const el = event.currentTarget;
                  wasAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
                }}
              >
                {threadLoading && !thread && <div className="space-y-2" role="status" aria-label="Loading thread"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-8 w-1/2" /><Skeleton className="h-8 w-3/4" /></div>}
                {thread && thread.hasMore && (
                  <button type="button" onClick={loadEarlier} className="mx-auto block text-xs hover:text-foreground">
                    Load earlier messages
                  </button>
                )}
                {thread?.messages.map((message) => {
                  const mine = thread.viewerId === message.senderId;
                  const label = mine ? "You" : message.senderIsAdmin ? `Support · ${message.senderName}` : (thread.user.name ?? thread.user.email ?? "Customer");
                  return (
                    <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] ${mine ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                        <span className={`px-1 text-xs font-semibold uppercase tracking-wide ${mine ? "text-muted-foreground" : "text-muted-foreground"}`}>{label}</span>
                        <div className={`rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                          {message.body}
                          <div className={`mt-1 flex items-center justify-end gap-1.5 text-xs tnum ${mine ? "opacity-60" : "text-muted-foreground"}`}>
                            <span>{fmtDateTime(message.createdAt)}</span>
                            {mine && <span aria-label={message.readAt ? "Read by customer" : "Not yet read"}>{message.readAt ? "✓ Read" : "✓ Sent"}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {thread && thread.messages.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No messages yet — send the first one.</p>}
                <div ref={bottomRef} />
              </div>
              {threadError && (
                <div className="mx-4 mb-2"><Alert tone="err" className="flex items-center justify-between gap-2 text-xs">
                  <span>{threadError}</span>
                  <button type="button" onClick={() => activeUser && void loadThread(activeUser.id, limit)} className="shrink-0 font-medium underline underline-offset-2">Retry</button>
                </Alert></div>
              )}
              <form onSubmit={send} className="flex items-end gap-2 border-t border-border p-3">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && draft.trim() && !sending) {
                      e.preventDefault();
                      void send(e as unknown as React.FormEvent<HTMLFormElement>);
                    }
                  }}
                  rows={2}
                  maxLength={4000}
                  placeholder="Reply… (Enter to send, Shift+Enter for a new line)"
                  aria-label="Reply message"
                  className="flex-1 resize-none"
                />
                <Button type="submit" size="sm" variant="brand" disabled={sending || !draft.trim()}>
                  {sending ? "…" : "Send"}
                </Button>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-muted-foreground">
              Select a conversation on the left, or start one from the Users tab.
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete this conversation?"
        message={`Every message in ${activeUser?.label ?? "this customer"}'s support thread will be permanently removed for the whole team. The deletion is written to the audit trail. This cannot be undone.`}
        confirmLabel="Delete conversation"
        cancelLabel="Keep it"
        busy={deleteBusy}
        onConfirm={() => void deleteThread()}
        onCancel={() => setDeleteOpen(false)}
      />

      <Dialog
        open={broadcastOpen}
        onClose={() => { if (!bBusy) setBroadcastOpen(false); }}
        title="Broadcast notification"
        description="Sends an in-app notification to every active user. Delivered instantly to their notification history."
        className="max-w-md"
      >
        <form className="p-5 space-y-4" onSubmit={broadcast}>
          <div>
            <Label htmlFor="b-title" className="mb-1 block text-xs font-medium">Title</Label>
            <Input id="b-title" required minLength={3} maxLength={120} value={bTitle} onChange={(e) => setBTitle(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="b-body" className="mb-1 block text-xs font-medium">Message</Label>
            <Textarea id="b-body" required minLength={3} maxLength={2000} rows={5} value={bBody} onChange={(e) => setBBody(e.target.value)} placeholder="Message every customer will receive…" />
          </div>
          {bError && <Alert tone="err">{bError}</Alert>}
          {bResult && <Alert tone="ok">{bResult}</Alert>}
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" disabled={bBusy} onClick={() => setBroadcastOpen(false)}>Close</Button>
            <Button type="submit" size="sm" loading={bBusy} loadingLabel="Sending"><Send size={13} strokeWidth={2} aria-hidden /> Send broadcast</Button>
          </div>
        </form>
      </Dialog>
    </section>
  );
}
