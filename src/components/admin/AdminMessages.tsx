"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { fmtDateTime } from "@/lib/dates";

interface ThreadRow {
  userId: string;
  email: string | null;
  name: string | null;
  accountNo: string | null;
  lastMessageAt: string | null;
  lastMessage: string;
  lastFromAdmin: boolean;
}

interface MessageRow {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

/** Admin chat inbox: thread list per customer, live chat pane, and the
 *  broadcast notification composer. */
export function AdminMessages({ chatWith, onChatHandled }: { chatWith: { userId: string; label: string } | null; onChatHandled: () => void }) {
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeUser, setActiveUser] = useState<{ id: string; label: string } | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [bTitle, setBTitle] = useState("");
  const [bBody, setBBody] = useState("");
  const [bBusy, setBBusy] = useState(false);
  const [bError, setBError] = useState<string | null>(null);
  const [bResult, setBResult] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/messages", { cache: "no-store" });
      const data = await response.json().catch(() => null) as { threads?: ThreadRow[]; error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Unable to load threads.");
      setThreads(data?.threads ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load threads.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadThread = useCallback(async (userId: string) => {
    const response = await fetch(`/api/admin/messages?userId=${encodeURIComponent(userId)}`, { cache: "no-store" });
    const data = await response.json().catch(() => null) as { messages?: MessageRow[]; error?: string } | null;
    if (!response.ok) throw new Error(data?.error ?? "Unable to load the thread.");
    setMessages(data?.messages ?? []);
    // The admin is the party in every message of a thread they opened? No —
    // infer: my id is the sender of any message whose recipient is this user
    // AND whose sender is an admin; cheapest: match against thread rows.
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

  // Resolve my admin id once: sender of the most recent admin-sent message.
  useEffect(() => {
    if (myId || threads.length === 0) return;
    const adminThread = threads.find((t) => t.lastFromAdmin);
    if (adminThread) {
      // still ambiguous — instead fetch via a dedicated lightweight probe:
      void (async () => {
        const response = await fetch("/api/admin/overview", { cache: "no-store" });
        if (response.ok) {
          const data = await response.json() as { actor?: { id?: string } };
          if (data.actor?.id) setMyId(data.actor.id);
        }
      })().catch(() => undefined);
    } else {
      void (async () => {
        const response = await fetch("/api/admin/overview", { cache: "no-store" });
        if (response.ok) {
          const data = await response.json() as { actor?: { id?: string } };
          if (data.actor?.id) setMyId(data.actor.id);
        }
      })().catch(() => undefined);
    }
  }, [threads, myId]);

  useEffect(() => {
    if (!activeUser) return;
    void loadThread(activeUser.id).catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load the thread."));
    const timer = window.setInterval(() => { if (!document.hidden && activeUser) void loadThread(activeUser.id).catch(() => undefined); }, 10_000);
    return () => window.clearInterval(timer);
  }, [activeUser, loadThread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeUser || !draft.trim() || sending) return;
    setSending(true);
    try {
      const response = await fetch("/api/admin/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: activeUser.id, body: draft }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Send failed.");
      setDraft("");
      await loadThread(activeUser.id);
      await loadThreads();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Send failed.");
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

  if (loading) {
    return <div className="space-y-2" role="status" aria-label="Loading messages"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-10 w-2/3" /><Skeleton className="h-10 w-1/3" /></div>;
  }

  return (
    <section className="space-y-3" aria-labelledby="admin-messages-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="admin-messages-heading" className="text-sm font-semibold">Customer messages</h2>
          <p className="text-xs text-text-muted mt-1">Direct two-way chat with customers, plus platform-wide broadcast notifications.</p>
        </div>
        <button type="button" onClick={() => { setBError(null); setBResult(null); setBroadcastOpen(true); }} className="rounded bg-brand px-3 py-2 text-xs font-medium text-white hover:brightness-95">
          Broadcast notification
        </button>
      </div>

      {error && <div role="alert" className="rounded border border-down/40 bg-down/10 px-3 py-2 text-xs text-down">{error}</div>}

      <div className="grid gap-3 lg:grid-cols-[minmax(220px,320px)_minmax(0,1fr)]">
        {/* Thread list */}
        <div className="max-h-[32rem] overflow-y-auto rounded-lg border border-border bg-canvas">
          {threads.length === 0 && <p className="p-6 text-center text-xs text-text-muted">No conversations yet. Open a user in the Users tab and press “Chat”.</p>}
          {threads.map((thread) => (
            <button
              key={thread.userId}
              type="button"
              onClick={() => setActiveUser({ id: thread.userId, label: thread.name ?? thread.email ?? thread.userId })}
              className={`block w-full border-b border-border-soft px-3 py-2.5 text-left last:border-0 hover:bg-panel-2 ${activeUser?.id === thread.userId ? "bg-panel-2" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-medium">{thread.name ?? "Unnamed"}</span>
                <span className="shrink-0 text-[9px] text-text-faint tnum">{thread.lastMessageAt ? fmtDateTime(thread.lastMessageAt) : ""}</span>
              </div>
              <div className="truncate text-[10px] text-text-faint">{thread.email ?? "—"} · #{thread.accountNo ?? "—"}</div>
              <div className={`mt-1 truncate text-[10px] ${thread.lastFromAdmin ? "text-text-muted" : "text-brand font-medium"}`}>
                {thread.lastFromAdmin ? "You: " : ""}{thread.lastMessage || "(no messages)"}
              </div>
            </button>
          ))}
        </div>

        {/* Chat pane */}
        <div className="flex h-[32rem] flex-col rounded-lg border border-border bg-canvas">
          {activeUser ? (
            <>
              <div className="border-b border-border-soft px-4 py-2.5">
                <div className="text-xs font-semibold">{activeUser.label}</div>
                <button type="button" onClick={() => setActiveUser(null)} className="text-[10px] text-text-faint hover:text-text">close thread</button>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
                {messages.map((message) => {
                  const mine = myId !== null && message.senderId === myId;
                  return (
                    <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${mine ? "bg-brand text-white" : "bg-panel-2"}`}>
                        {message.body}
                        <div className={`mt-1 text-[9px] tnum ${mine ? "text-white/60" : "text-text-faint"}`}>{fmtDateTime(message.createdAt)}</div>
                      </div>
                    </div>
                  );
                })}
                {messages.length === 0 && <p className="py-8 text-center text-xs text-text-muted">No messages yet — send the first one.</p>}
                <div ref={bottomRef} />
              </div>
              <form onSubmit={send} className="flex items-end gap-2 border-t border-border-soft p-3">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={2}
                  maxLength={4000}
                  placeholder="Reply…"
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
