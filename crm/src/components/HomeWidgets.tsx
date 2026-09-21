"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Section } from "@/components/ui";
import { notificationHref } from "@/lib/notificationLink";

interface NotificationRow {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

interface TaskRow {
  id: string;
  title: string;
  dueAt: string | null;
  priority: string;
  subjectType: string | null;
  subjectId: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  RECORD_ASSIGNED: "Assigned to you",
  TASK_CREATED: "New task",
  TASK_DUE: "Task due",
  TASK_OVERDUE: "Task overdue",
  TASK_REMINDER: "Task reminder",
  APPOINTMENT_SCHEDULED: "Appointment scheduled",
  IMPORT_COMPLETED: "Import completed",
  IMPORT_FAILED: "Import failed",
  PLATFORM_USER_ONLINE: "Client is online",
  SYSTEM: "System",
};

const SUBJECT_PATH: Record<string, string> = {
  LEAD: "leads",
  CONTACT: "contacts",
  ACCOUNT: "accounts",
  CUSTOMER: "customers",
  OPPORTUNITY: "opportunities",
};

/** Home widgets: my task counters + in-app notifications with mark-all-read. */
export function HomeWidgets() {
  const [openCount, setOpenCount] = useState<number | null>(null);
  const [overdueCount, setOverdueCount] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    const tasks = await fetch("/api/tasks?mine=1").then((r) => (r.ok ? r.json() : null));
    if (tasks) {
      setOpenCount(tasks.meta.openCount);
      setOverdueCount(tasks.meta.overdueCount);
      setTasks((tasks.data as TaskRow[]).slice(0, 4));
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
    <div className="grid gap-8 lg:grid-cols-2">
      <Section
        title="My work queue"
        actions={<Link href="/tasks?mine=1" className="link-muted">View tasks</Link>}
      >
        <div className="grid grid-cols-2 gap-4">
          <Link href="/tasks?mine=1" className="card-interactive min-w-0 rounded-lg p-2">
            <p className="text-2xl font-semibold tabular-nums">{openCount ?? "–"}</p>
            <p className="text-sm text-(--text-secondary)">open tasks</p>
          </Link>
          <Link href="/tasks?due=overdue&mine=1" className="card-interactive min-w-0 rounded-lg p-2">
            <p className={`text-2xl font-semibold tabular-nums ${(overdueCount ?? 0) > 0 ? "text-(--error)" : ""}`}>{overdueCount ?? "–"}</p>
            <p className="text-sm text-(--text-secondary)">overdue</p>
          </Link>
        </div>
        <div className="border-t border-(--border-hairline) pt-4">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-(--text-tertiary)">Next actions</p>
            <Link href="/tasks?due=upcoming&mine=1" className="link-muted">Upcoming</Link>
          </div>
          {tasks.length === 0 ? (
            <p className="py-3 text-sm text-(--text-tertiary)">No pending tasks in your queue.</p>
          ) : (
            <ul className="divide-y divide-(--border-hairline)">
              {tasks.map((task) => {
                const href = task.subjectType && task.subjectId && SUBJECT_PATH[task.subjectType] ? `/${SUBJECT_PATH[task.subjectType]}/${task.subjectId}` : "/tasks?mine=1";
                return (
                  <li key={task.id}>
                    <Link href={href} className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2.5 text-sm hover:bg-(--bg-hover)">
                      <span className="min-w-0 truncate font-medium">{task.title}</span>
                      <span className={`shrink-0 text-[10px] font-semibold uppercase ${task.priority === "URGENT" ? "text-(--error)" : "text-(--text-tertiary)"}`}>{task.dueAt ? new Date(task.dueAt).toLocaleDateString() : "no due date"}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Section>

      <Section
        title="Team inbox"
        actions={
          <>
            {unread > 0 ? <span className="badge badge-brand">{unread} unread</span> : null}
            <Link href="/notifications" className="link-muted">View all</Link>
            {unread > 0 ? (
              <Button variant="secondary" size="sm" icon="check" onClick={() => void markAllRead()}>
                Mark all read
              </Button>
            ) : null}
          </>
        }
      >
        {notifications.length === 0 ? (
          <p className="text-sm text-(--text-tertiary)">Nothing yet — assignments and shared tasks land here.</p>
        ) : (
          <ul className="max-h-56 divide-y divide-(--border-hairline) overflow-y-auto">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <Link
                  href={notificationHref(notification)}
                  className={`-mx-2 flex items-start gap-2 rounded-md px-2 py-2.5 text-sm transition-colors hover:bg-(--bg-hover) ${
                    notification.readAt ? "" : "bg-(--accent-soft)"
                  }`}
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.readAt ? "border border-(--border-strong)" : "bg-(--accent)"}`} />
                  <span className="min-w-0">
                    <span className="block font-medium">
                      {TYPE_LABELS[notification.type] ?? notification.type}
                      {typeof notification.payload.title === "string" ? `: ${notification.payload.title}` : ""}
                    </span>
                    <span className="mt-0.5 block text-xs text-(--text-tertiary)">
                      {new Date(notification.createdAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
