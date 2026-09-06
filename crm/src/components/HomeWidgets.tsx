"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { notificationHref } from "@/lib/notificationLink";

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
  TASK_DUE: "Task due",
  TASK_OVERDUE: "Task overdue",
  APPOINTMENT_SCHEDULED: "Appointment scheduled",
  IMPORT_COMPLETED: "Import completed",
  IMPORT_FAILED: "Import failed",
  PLATFORM_USER_ONLINE: "Client is online",
  SYSTEM: "System",
};

/** Home widgets: my task counters + in-app notifications with mark-all-read. */
export function HomeWidgets() {
  const [openCount, setOpenCount] = useState<number | null>(null);
  const [overdueCount, setOverdueCount] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    const tasks = await fetch("/api/tasks?mine=1").then((r) => (r.ok ? r.json() : null));
    if (tasks) {
      setOpenCount(tasks.meta.openCount);
      setOverdueCount(tasks.meta.overdueCount);
    }
    const notes = await fetch("/api/notifications").then((r) => (r.ok ? r.json() : null));
    if (notes) {
      setNotifications(notes.data);
      setUnread(notes.meta.unread);
    }
  }, []);

  useEffect(() => {
    void refresh();
    // Re-read on tab focus so counters/notifications reflect changes made
    // elsewhere while the dashboard sat in a background tab.
    const onFocus = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH" });
    setNotifications((previous) => previous.map((n) => ({ ...n, readAt: new Date().toISOString() })));
    setUnread(0);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card" style={{ padding: "var(--space-6)" }}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-(--text-tertiary)">Focus</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">My work</h2>
          </div>
          <Link href="/tasks?mine=1" className="text-xs font-semibold text-(--text-brand) hover:underline">View tasks</Link>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Link
            href="/tasks?mine=1"
            className="card-interactive rounded-lg border border-(--border-default) bg-(--bg-subtle) p-4"
          >
            <p className="text-2xl font-semibold">{openCount ?? "–"}</p>
            <p className="text-sm text-(--text-secondary)">open tasks</p>
          </Link>
          <Link
            href="/tasks?due=overdue&mine=1"
            className="card-interactive rounded-lg border border-(--border-default) bg-(--bg-subtle) p-4"
            style={{ borderColor: (overdueCount ?? 0) > 0 ? "#fca5a5" : undefined }}
          >
            <p className="text-2xl font-semibold">{overdueCount ?? "–"}</p>
            <p className="text-sm text-(--text-secondary)">overdue</p>
          </Link>
        </div>
      </section>

      <section className="card" style={{ padding: "var(--space-6)" }}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-(--text-tertiary)">Inbox</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">Notifications {unread > 0 ? <span className="text-sm font-medium text-(--brand)">· {unread} unread</span> : ""}</h2>
          </div>
          {unread > 0 ? (
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="text-xs font-medium text-(--brand) hover:underline"
            >
              Mark all read
            </button>
          ) : null}
        </div>
        {notifications.length === 0 ? (
          <p className="text-sm text-(--text-tertiary)">Nothing yet — assignments and shared tasks land here.</p>
        ) : (
          <ul className="max-h-56 space-y-2 overflow-y-auto">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <Link
                  href={notificationHref(notification)}
                  className={`block rounded-md border p-2 text-sm transition-colors hover:bg-(--bg-hover) ${
                    notification.readAt ? "border-(--border-default) text-(--text-secondary)" : "border-(--brand)/30 bg-(--brand)/5"
                  }`}
                >
                  <p className="font-medium">
                    {TYPE_LABELS[notification.type] ?? notification.type}
                    {typeof notification.payload.title === "string" ? `: ${notification.payload.title}` : ""}
                  </p>
                  <p className="text-xs text-(--text-tertiary)">
                    {new Date(notification.createdAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
