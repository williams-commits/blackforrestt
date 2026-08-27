"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/Pagination";
import { Dialog } from "@/components/ui/Dialog";
import { fmtAgo, fmtDateTime } from "@/lib/dates";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

const PAGE_SIZE = 10;

const TYPE_TONES: Record<string, string> = {
  ADMIN_MESSAGE: "bg-brand-soft text-brand",
  ADMIN_BROADCAST: "bg-brand-soft text-brand",
  ADMIN_CHAT: "bg-brand-soft text-brand",
  CUSTOMER_MESSAGE: "bg-brand-soft text-brand",
  TRADE_OPENED: "bg-brand-soft text-brand",
  TRADE_CLOSED: "bg-panel-3 text-text-muted",
  ACCOUNT_STATUS: "bg-down/10 text-down",
  PAYMENT_APPROVED: "bg-up/10 text-up",
  PAYMENT_REJECTED: "bg-down/10 text-down",
  PAYMENT_PREPARED: "bg-brand-soft text-brand",
  PAYMENT_CANCELLED: "bg-panel-3 text-text-muted",
  PAYMENT_REVERSED: "bg-panel-3 text-text-muted",
};

/** Persisted notification history — available whenever the user comes online.
 *  Rows open a detail modal (mark-as-read for unread items; chat threads
 *  deep-link to the Messages tab). Auto-syncs while visible. */
export function NotificationsTab({ onActivity, onOpenMessages }: { onActivity?: () => void; onOpenMessages?: () => void }) {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<NotificationRow | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch(`/api/notifications?scope=all&limit=${PAGE_SIZE}&offset=${(page - 1) * PAGE_SIZE}`, { cache: "no-store" });
      const data = await response.json().catch(() => null) as { notifications?: NotificationRow[]; unreadCount?: number; error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Unable to load notifications.");
      setItems(data?.notifications ?? []);
      setUnreadCount(data?.unreadCount ?? 0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
    // Auto-sync: silent poll while visible + immediate refresh when the
    // shell's badge watcher detects activity (new notification elsewhere).
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 15_000);
    const onCountsChanged = () => void load();
    window.addEventListener("blckforest:counts-changed", onCountsChanged);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("blckforest:counts-changed", onCountsChanged);
    };
  }, [load]);

  async function markRead(id: string) {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      setItems((current) => current.map((item) => (item.id === id ? { ...item, readAt: new Date().toISOString() } : item)));
      setUnreadCount((count) => Math.max(0, count - 1));
      onActivity?.();
    } catch {
      setError("Unable to mark the notification read.");
    }
  }

  async function markAllRead() {
    setBusy(true);
    setError(null);
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      await load();
    } catch {
      setError("Unable to mark notifications read.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-2" role="status" aria-label="Loading notifications">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Notifications</h2>
          <p className="text-xs text-text-muted mt-1">Your full notification history — available whenever you sign in.</p>
        </div>
        {unreadCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold text-white">{unreadCount} unread</span>
            <Button type="button" size="sm" loading={busy} onClick={() => void markAllRead()}>Mark all read</Button>
          </div>
        )}
      </div>

      {error && <div role="alert" className="rounded border border-down/40 bg-down/10 px-3 py-2 text-xs text-down">{error}</div>}

      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
          <button
            type="button"
            onClick={() => {
              // Opening the detail modal marks the notification read — the
              // user has seen it; no second click required.
              if (!item.readAt) void markRead(item.id);
              setSelected(item.readAt ? item : { ...item, readAt: new Date().toISOString() });
            }}
            className={`w-full rounded-lg border p-3 text-left transition hover:border-brand/50 ${item.readAt ? "border-border bg-canvas" : "border-brand/40 bg-brand-soft/30"}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${TYPE_TONES[item.type] ?? "bg-panel-3 text-text-muted"}`}>
                  {item.type.replaceAll("_", " ").toLowerCase()}
                </span>
                <span className="text-sm font-medium">{item.title}</span>
              </div>
              <span className="text-[10px] text-text-faint tnum">{fmtDateTime(item.createdAt)}</span>
            </div>
            <p className="mt-1.5 line-clamp-2 text-xs text-text-muted leading-relaxed whitespace-pre-wrap">{item.body}</p>
            {!item.readAt && <span className="mt-1 inline-block text-[10px] font-semibold text-brand">● unread — open to mark read</span>}
          </button>
          </li>
        ))}
        {items.length === 0 && (
          <li className="rounded border border-dashed border-border bg-canvas px-4 py-10 text-center text-xs text-text-muted">
            No notifications yet.
          </li>
        )}
      </ul>

      <Pagination page={page} pageSize={PAGE_SIZE} totalItems={Math.max(items.length, page > 1 ? 1 : 0)} onPageChange={setPage} label="notifications" compact />

      <Dialog
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.title ?? "Notification"}
        description={selected ? `${fmtDateTime(selected.createdAt)} · ${fmtAgo(selected.createdAt)}` : undefined}
        className="sm:max-w-md"
      >
        {selected && (
          <div className="space-y-4 px-5 py-4">
            <div className="flex items-center gap-2">
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${TYPE_TONES[selected.type] ?? "bg-panel-3 text-text-muted"}`}>
                {selected.type.replaceAll("_", " ").toLowerCase()}
              </span>
              {!selected.readAt && <span className="text-[10px] font-semibold text-brand">● unread</span>}
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{selected.body}</p>
            <div className="flex flex-wrap justify-end gap-2">
              {(selected.type === "ADMIN_CHAT" || selected.type === "CUSTOMER_MESSAGE") && onOpenMessages && (
                <Button type="button" variant="buy" onClick={() => { setSelected(null); onOpenMessages(); }}>
                  Open conversation
                </Button>
              )}
              <Button type="button" variant="ghost" onClick={() => setSelected(null)}>Close</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
