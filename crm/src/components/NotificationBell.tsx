"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

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

/** Only allow internal CRM routes supplied by the server-side notification context. */
function notificationHref(notification: NotificationRow): string | null {
  const context = notification.payload.context;
  if (context && typeof context === "object" && !Array.isArray(context)) {
    const href = (context as { href?: unknown }).href;
    if (typeof href === "string" && href.startsWith("/") && !href.startsWith("//")) return href;
  }

  // Notifications saved before contextual destinations were introduced retain
  // useful links where their legacy payload contains a related record id.
  const customerId = notification.payload.customerId;
  if (typeof customerId === "string") return `/customers/${customerId}`;
  const recordId = notification.payload.recordId;
  const recordType = notification.payload.recordType;
  const collection = typeof recordType === "string"
    ? ({ LEAD: "leads", CONTACT: "contacts", ACCOUNT: "accounts", CUSTOMER: "customers", OPPORTUNITY: "opportunities" } as Record<string, string>)[recordType]
    : undefined;
  if (collection && typeof recordId === "string") return `/${collection}/${recordId}`;
  if (typeof notification.payload.jobId === "string") return "/imports";
  if (typeof notification.payload.taskId === "string") return "/tasks";
  return null;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function refresh() {
    setLoading(true);
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const body = (await response.json()) as { data?: NotificationRow[]; meta?: { unread?: number } };
      setNotifications(body.data ?? []);
      setUnread(body.meta?.unread ?? 0);
    } catch {
      // Notification polling is non-critical. Network hiccups, a restarting
      // dev server, or an expired session must not create an unhandled client
      // error every 30 seconds; the next poll will retry automatically.
    } finally {
      setLoading(false);
    }
  }

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
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

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
      <button
        type="button"
        onClick={() => {
          setOpen((previous) => !previous);
          if (!open) void refresh();
        }}
        className="relative flex h-8 w-8 items-center justify-center rounded-full border transition-colors hover:bg-(--bg-hover)"
        style={{ borderColor: "var(--border-default)", color: "var(--text-tertiary)" }}
        title={unread > 0 ? `${unread} unread notifications` : "Notifications"}
        aria-label={unread > 0 ? `${unread} unread notifications` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {unread > 0 ? <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-(--error) px-1 text-[9px] font-bold leading-4 text-white">{unread > 99 ? "99+" : unread}</span> : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-(--border-default) bg-(--bg-surface) shadow-(--shadow-dropdown)" role="menu">
          <div className="flex items-center justify-between border-b border-(--border-default) bg-(--bg-subtle) px-4 py-3">
            <div><p className="text-sm font-semibold">Notifications</p><p className="text-[11px] text-(--text-tertiary)">{unread ? `${unread} unread` : "All caught up"}</p></div>
            {unread > 0 ? <button type="button" onClick={() => void markAllRead()} className="text-[11px] font-semibold text-(--text-brand) hover:underline">Mark all read</button> : null}
          </div>
          {loading && notifications.length === 0 ? <p className="px-4 py-6 text-center text-sm text-(--text-tertiary)">Checking for updates…</p> : notifications.length === 0 ? <p className="px-4 py-6 text-center text-sm text-(--text-tertiary)">Nothing new yet.</p> : (
            <ul className="max-h-80 overflow-y-auto">
              {notifications.slice(0, 12).map((notification) => {
                const href = notificationHref(notification);
                const content = <><p className="text-xs font-semibold">{notificationTitle(notification)}</p><p className="mt-1 text-[10px] text-(--text-tertiary)">{new Date(notification.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</p></>;
                return <li key={notification.id} className={`border-b border-(--border-default) px-4 py-3 last:border-0 ${notification.readAt ? "text-(--text-secondary)" : "bg-(--brand-50) text-(--text-primary)"}`}>{href ? <Link href={href} onClick={() => setOpen(false)} className="block hover:opacity-75">{content}</Link> : content}</li>;
              })}
            </ul>
          )}
          <Link href="/" onClick={() => setOpen(false)} className="block border-t border-(--border-default) px-4 py-2.5 text-center text-xs font-semibold text-(--text-brand) hover:bg-(--bg-hover)">View notification center</Link>
        </div>
      ) : null}
    </div>
  );
}
