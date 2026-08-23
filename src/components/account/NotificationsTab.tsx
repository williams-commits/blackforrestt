"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/Pagination";
import { fmtDateTime } from "@/lib/dates";

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

/** Persisted notification history — available whenever the user comes online. */
export function NotificationsTab() {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

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
  }, [load]);

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
          <li
            key={item.id}
            className={`rounded-lg border p-3 ${item.readAt ? "border-border bg-canvas" : "border-brand/40 bg-brand-soft/30"}`}
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
            <p className="mt-1.5 text-xs text-text-muted leading-relaxed whitespace-pre-wrap">{item.body}</p>
            {!item.readAt && <span className="mt-1 inline-block text-[10px] font-semibold text-brand">● unread</span>}
          </li>
        ))}
        {items.length === 0 && (
          <li className="rounded border border-dashed border-border bg-canvas px-4 py-10 text-center text-xs text-text-muted">
            No notifications yet.
          </li>
        )}
      </ul>

      <Pagination page={page} pageSize={PAGE_SIZE} totalItems={Math.max(items.length, page > 1 ? 1 : 0)} onPageChange={setPage} label="notifications" compact />
    </div>
  );
}
