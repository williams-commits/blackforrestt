"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { notificationHref } from "@/lib/notificationLink";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface NotificationRow {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  RECORD_ASSIGNED: "Assigned to you",
  TASK_CREATED: "New task",
  TASK_DUE: "Task due today",
  TASK_OVERDUE: "Task overdue",
  TASK_REMINDER: "Task reminder",
  APPOINTMENT_SCHEDULED: "Appointment scheduled",
  IMPORT_COMPLETED: "Import completed",
  IMPORT_FAILED: "Import failed",
  PLATFORM_USER_ONLINE: "Client is online",
  SYSTEM: "System update",
};

function notificationTitle(notification: NotificationRow): string {
  const label = TYPE_LABELS[notification.type] ?? notification.type.replaceAll("_", " ").toLowerCase();
  const subject = notification.payload.label ?? notification.payload.title;
  return typeof subject === "string" ? `${label}: ${subject}` : label;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const knownIds = useRef<Set<string> | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const body = (await response.json()) as { data?: NotificationRow[]; meta?: { unread?: number } };
      const nextNotifications = body.data ?? [];
      const previousIds = knownIds.current;
      if (previousIds) {
        for (const notification of nextNotifications) {
          if (!previousIds.has(notification.id) && !notification.readAt) {
            toast.info(notificationTitle(notification));
          }
        }
      }
      knownIds.current = new Set(nextNotifications.map((notification) => notification.id));
      setNotifications(nextNotifications);
      setUnread(body.meta?.unread ?? 0);
    } catch {
      // Notification polling is non-critical. Network hiccups, a restarting
      // dev server, or an expired session must not create an unhandled client
      // error every 30 seconds; the next poll will retry automatically.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 30_000);
    const onFocus = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    document.addEventListener("keydown", onKeyDown);
    const onRealtimeNotification = () => void refresh();
    window.addEventListener("crm:notifications-refresh", onRealtimeNotification);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("crm:notifications-refresh", onRealtimeNotification);
    };
  }, [refresh]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function markAllRead() {
    try {
      const response = await fetch("/api/notifications", { method: "PATCH" });
      if (!response.ok) return;
      setNotifications((previous) => previous.map((notification) => ({ ...notification, readAt: new Date().toISOString() })));
      setUnread(0);
    } catch {
      // Keep the current unread state when the request did not reach the API.
    }
  }

  return (
    <div ref={ref} className="relative">
      <Button
        variant="tertiary"
        size="icon"
        onClick={() => {
          setOpen((previous) => !previous);
          if (!open) void refresh();
        }}
        className="relative rounded-full text-muted-foreground"
        title={unread > 0 ? `${unread} unread notifications` : "Notifications"}
        aria-label={unread > 0 ? `${unread} unread notifications` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Icon name="bell" size={16} />
        {unread > 0 ? <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-4 text-white">{unread > 99 ? "99+" : unread}</span> : null}
      </Button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-popover shadow-md" role="menu">
          <div className="flex items-center justify-between border-b border-border bg-muted px-4 py-3">
            <div><p className="text-sm font-semibold">Notifications</p><p className="text-[11px] text-muted-foreground">{unread ? `${unread} unread` : "All caught up"}</p></div>
            {unread > 0 ? <button type="button" onClick={() => void markAllRead()} className="text-[11px] font-semibold hover:underline">Mark all read</button> : null}
          </div>
          {loading && notifications.length === 0 ? <p className="px-4 py-6 text-center text-sm text-muted-foreground">Checking for updates…</p> : notifications.length === 0 ? <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nothing new yet.</p> : (
            <ul className="max-h-80 overflow-y-auto">
              {notifications.slice(0, 12).map((notification) => {
                const href = notificationHref(notification);
                const content = <><p className="text-xs font-semibold">{notificationTitle(notification)}</p><p className="mt-1 text-[10px] text-muted-foreground">{new Date(notification.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</p></>;
                return <li key={notification.id} className={cn("border-b border-border px-4 py-3 last:border-0", notification.readAt ? "text-muted-foreground" : "bg-muted text-foreground")}><Link href={href} onClick={() => setOpen(false)} className="block hover:opacity-75">{content}</Link></li>;
              })}
            </ul>
          )}
          <Link href="/notifications" onClick={() => setOpen(false)} className="block border-t border-border px-4 py-2.5 text-center text-xs font-semibold hover:bg-muted">View notification center</Link>
        </div>
      ) : null}
    </div>
  );
}
