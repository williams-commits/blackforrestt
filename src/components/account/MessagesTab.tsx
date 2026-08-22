"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { fmtDateTime } from "@/lib/dates";

interface MessageRow {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

/** Two-way chat with the support/admin team. Polls every 15s while visible. */
export function MessagesTab() {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [hasThread, setHasThread] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/messages", { cache: "no-store" });
      const data = await response.json().catch(() => null) as { messages?: MessageRow[]; hasThread?: boolean; userId?: string; error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Unable to load messages.");
      setMessages(data?.messages ?? []);
      setHasThread(Boolean(data?.hasThread));
      if (data?.userId) setMyId(data.userId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load messages.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Unable to send the message.");
      setDraft("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to send the message.");
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

  return (
    <div className="flex h-[min(70vh,32rem)] flex-col rounded-lg border border-border bg-canvas">
      <div className="border-b border-border-soft px-4 py-3">
        <h2 className="text-sm font-semibold">Support chat</h2>
        <p className="text-[11px] text-text-muted">Talk directly with our team — replies land here and in your notifications.</p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {!hasThread && (
          <p className="rounded border border-dashed border-border px-4 py-8 text-center text-xs text-text-muted">
            No messages yet — say hello and our team will reply here.
          </p>
        )}
        {messages.map((message) => {
          const mine = message.senderId === myId;
          return (
            <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${mine ? "bg-brand text-white" : "bg-panel-2 text-text"}`}>
                {message.body}
                <div className={`mt-1 text-[9px] ${mine ? "text-white/60" : "text-text-faint"} tnum`}>{fmtDateTime(message.createdAt)}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && <div role="alert" className="mx-4 mb-2 rounded border border-down/40 bg-down/10 px-3 py-2 text-xs text-down">{error}</div>}

      <form onSubmit={send} className="flex items-end gap-2 border-t border-border-soft p-3">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={2}
          maxLength={4000}
          placeholder="Type a message…"
          aria-label="Message body"
          className="flex-1 resize-none rounded border border-border bg-panel px-3 py-2 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20"
        />
        <Button type="submit" size="sm" variant="brand" loading={sending} disabled={!draft.trim()}>Send</Button>
      </form>
    </div>
  );
}
