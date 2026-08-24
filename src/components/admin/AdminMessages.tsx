"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/lib/toast";
import { fmtDateTime } from "@/lib/dates";

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
    return () => window.clearInterval(timer);
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
    return [thread.name, thread.email, thread.accountNo, thread.lastMessage]
      .some((field) => field?.toLowerCase().includes(needle));
  });

  return (
    <section className="space-y-3" aria-labelledby="admin-messages-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="admin-messages-heading" className="text-sm font-semibold">Customer messages</h2>
          <p className="text-xs text-text-muted mt-1">
            Shared team inbox — every operator sees the same threads.{" "}
            {totalUnread > 0
              ? <span className="font-medium text-brand">{totalUnread} unread message{totalUnread === 1 ? "" : "s"}</span>
              : "All caught up."}
          </p>
        </div>
        <button type="button" onClick={() => { setBError(null); setBResult(null); setBroadcastOpen(true); }} className="rounded bg-brand px-3 py-2 text-xs font-medium text-white hover:brightness-95">
          Broadcast notification
        </button>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-2 rounded border border-down/40 bg-down/10 px-3 py-2 text-xs text-down">
          <span>{error}</span>
          <button type="button" onClick={() => void loadThreads()} className="shrink-0 font-medium underline underline-offset-2">Retry</button>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(240px,340px)_minmax(0,1fr)]">
        {/* Thread list */}
        <div className="flex max-h-144 flex-col rounded-lg border border-border bg-canvas">
          <div className="space-y-2 border-b border-border-soft p-2">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, account…"
              aria-label="Search conversations"
              className="w-full rounded border border-border bg-panel px-2.5 py-1.5 text-xs outline-none focus-visible:border-brand"
            />
            <label className="flex items-center gap-1.5 text-[10px] text-text-muted">
              <input type="checkbox" checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} className="accent-brand" />
              Unread only
            </label>
          </div>
          <div className="flex-1 overflow-y-auto">
            {visibleThreads.length === 0 && (
              <p className="p-6 text-center text-xs text-text-muted">
                {threads.length === 0 ? "No conversations yet. Open a user in the Users tab and press “Chat”." : "No conversations match."}
              </p>
            )}
            {visibleThreads.map((threadRow) => (
              <button
                key={threadRow.userId}
                type="button"
                onClick={() => { setLimit(PAGE_SIZE); setActiveUser({ id: threadRow.userId, label: threadRow.name ?? threadRow.email ?? threadRow.userId }); }}
                aria-current={activeUser?.id === threadRow.userId ? "true" : undefined}
                className={`block w-full border-b border-border-soft px-3 py-2.5 text-left last:border-0 hover:bg-panel-2 ${activeUser?.id === threadRow.userId ? "bg-panel-2" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`truncate text-xs ${threadRow.unread > 0 ? "font-semibold" : "font-medium"}`}>{threadRow.name ?? "Unnamed"}</span>
                  <span className="shrink-0 text-[9px] text-text-faint tnum">{threadRow.lastMessageAt ? fmtDateTime(threadRow.lastMessageAt) : ""}</span>
                </div>
                <div className="truncate text-[10px] text-text-faint">{threadRow.email ?? "—"} · #{threadRow.accountNo ?? "—"}</div>
                <div className="mt-1 flex items-center gap-1.5">
                  <span
                    className={`shrink-0 rounded px-1 py-px text-[8px] font-bold uppercase tracking-wide ${
                      threadRow.status === "AWAITING_REPLY" ? "bg-brand/15 text-brand" : "bg-panel-3 text-text-muted"
                    }`}
                  >
                    {threadRow.status === "AWAITING_REPLY" ? "Awaiting reply" : "Replied"}
                  </span>
                  {threadRow.unread > 0 && (
                    <span className="shrink-0 rounded-full bg-brand px-1.5 py-0.5 text-[9px] font-bold text-white">{threadRow.unread}</span>
                  )}
                  <span className={`truncate text-[10px] ${threadRow.lastFromAdmin ? "text-text-muted" : "text-text font-medium"}`}>
                    {threadRow.lastFromAdmin ? "You: " : ""}{threadRow.lastMessage || "(no messages)"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat pane */}
        <div className="flex h-144 flex-col rounded-lg border border-border bg-canvas">
          {activeUser ? (
            <>
              <div className="flex items-start justify-between gap-2 border-b border-border-soft px-4 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold">{thread?.user ? (thread.user.name ?? thread.user.email ?? activeUser.label) : activeUser.label}</div>
                  {thread?.user && (
                    <div className="truncate text-[10px] text-text-faint">{thread.user.email ?? "—"} · #{thread.user.accountNo ?? "—"}</div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleteOpen(true)}
                    className="text-[10px] font-medium text-down/80 hover:text-down hover:underline underline-offset-2"
                    title="Permanently delete this conversation (audited)"
                  >
                    delete
                  </button>
                  <button type="button" onClick={() => { setActiveUser(null); setThread(null); }} className="text-[10px] text-text-faint hover:text-text">close</button>
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
                  <button type="button" onClick={loadEarlier} className="mx-auto block rounded border border-border px-2.5 py-1 text-[10px] text-text-muted hover:text-text">
                    Load earlier messages
                  </button>
                )}
                {thread?.messages.map((message) => {
                  const mine = thread.viewerId === message.senderId;
                  const label = mine ? "You" : message.senderIsAdmin ? `Support · ${message.senderName}` : (thread.user.name ?? thread.user.email ?? "Customer");
                  return (
                    <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] ${mine ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                        <span className={`px-1 text-[9px] font-semibold uppercase tracking-wide ${mine ? "text-text-faint" : "text-text-muted"}`}>{label}</span>
                        <div className={`rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${mine ? "bg-brand text-white" : "bg-panel-2 text-text"}`}>
                          {message.body}
                          <div className={`mt-1 flex items-center justify-end gap-1.5 text-[9px] tnum ${mine ? "text-white/60" : "text-text-faint"}`}>
                            <span>{fmtDateTime(message.createdAt)}</span>
                            {mine && <span aria-label={message.readAt ? "Read by customer" : "Not yet read"}>{message.readAt ? "✓ Read" : "✓ Sent"}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {thread && thread.messages.length === 0 && <p className="py-8 text-center text-xs text-text-muted">No messages yet — send the first one.</p>}
                <div ref={bottomRef} />
              </div>
              {threadError && (
                <div role="alert" className="mx-4 mb-2 flex items-center justify-between gap-2 rounded border border-down/40 bg-down/10 px-3 py-2 text-xs text-down">
                  <span>{threadError}</span>
                  <button type="button" onClick={() => activeUser && void loadThread(activeUser.id, limit)} className="shrink-0 font-medium underline underline-offset-2">Retry</button>
                </div>
              )}
              <form onSubmit={send} className="flex items-end gap-2 border-t border-border-soft p-3">
                <textarea
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
                  className="flex-1 resize-none rounded border border-border bg-panel px-3 py-2 text-sm outline-none focus-visible:border-brand"
                />
                <button type="submit" disabled={sending || !draft.trim()} className="rounded bg-brand px-4 py-2 text-xs font-medium text-white disabled:opacity-50">
                  {sending ? "…" : "Send"}
                </button>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-text-muted">
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
            <label className="mb-1 block text-xs font-medium" htmlFor="b-title">Title</label>
            <input id="b-title" required minLength={3} maxLength={120} value={bTitle} onChange={(e) => setBTitle(e.target.value)} className="w-full rounded border border-border bg-panel px-3 py-2 text-sm outline-none focus-visible:border-brand" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" htmlFor="b-body">Message</label>
            <textarea id="b-body" required minLength={3} maxLength={2000} rows={5} value={bBody} onChange={(e) => setBBody(e.target.value)} className="w-full rounded border border-border bg-panel px-3 py-2 text-sm outline-none focus-visible:border-brand" />
          </div>
          {bError && <p role="alert" className="rounded border border-down/40 bg-down/10 px-3 py-2 text-xs text-down">{bError}</p>}
          {bResult && <p role="status" className="rounded border border-up/40 bg-up/10 px-3 py-2 text-xs text-up">{bResult}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" disabled={bBusy} onClick={() => setBroadcastOpen(false)} className="rounded border border-border px-3 py-2 text-xs disabled:opacity-50">Close</button>
            <button type="submit" disabled={bBusy} className="rounded bg-brand px-3 py-2 text-xs text-white disabled:opacity-50">{bBusy ? "Sending…" : "Send broadcast"}</button>
          </div>
        </form>
      </Dialog>
    </section>
  );
}
