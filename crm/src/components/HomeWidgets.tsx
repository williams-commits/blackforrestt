"use client";

import { useCallback, useEffect, useState } from "react";
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
  TASK_DUE: "Task due",
  TASK_OVERDUE: "Task overdue",
  APPOINTMENT_SCHEDULED: "Appointment scheduled",
  IMPORT_COMPLETED: "Import completed",
  IMPORT_FAILED: "Import failed",
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
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          My work
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <Link
            href="/tasks?mine=1"
            className="rounded-lg border border-[var(--border-default)] p-4 transition hover:border-[var(--brand)]"
          >
            <p className="text-2xl font-semibold">{openCount ?? "–"}</p>
            <p className="text-sm text-[var(--text-secondary)]">open tasks</p>
          </Link>
          <Link
            href="/tasks?due=overdue&mine=1"
            className="rounded-lg border p-4 transition hover:border-[var(--error-border)]"
            style={{ borderColor: (overdueCount ?? 0) > 0 ? "#fca5a5" : undefined }}
          >
            <p className="text-2xl font-semibold">{overdueCount ?? "–"}</p>
            <p className="text-sm text-[var(--text-secondary)]">overdue</p>
          </Link>
        </div>
      </section>

      <section className="card" style={{ padding: "var(--space-6)" }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            Notifications {unread > 0 ? `(${unread} unread)` : ""}
          </h2>
          {unread > 0 ? (
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="text-xs font-medium text-[var(--brand)] hover:underline"
            >
              Mark all read
            </button>
          ) : null}
        </div>
        {notifications.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">Nothing yet — assignments and shared tasks land here.</p>
        ) : (
          <ul className="max-h-56 space-y-2 overflow-y-auto">
            {notifications.map((notification) => (
              <li
                key={notification.id}
                className={`rounded-md border p-2 text-sm ${
                  notification.readAt ? "border-[var(--border-default)] text-[var(--text-secondary)]" : "border-[var(--brand)]/30 bg-[var(--brand)]/5"
                }`}
              >
                <p className="font-medium">
                  {TYPE_LABELS[notification.type] ?? notification.type}
                  {typeof notification.payload.title === "string" ? `: ${notification.payload.title}` : ""}
                </p>
                <p className="text-xs text-[var(--text-tertiary)]">
                  {new Date(notification.createdAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
