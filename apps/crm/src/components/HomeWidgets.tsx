"use client";

import { toast } from "sonner";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/Icon";
import { Button, Section } from "@/components/ui";
import { cn } from "@/lib/utils";
import { relativeTime, absoluteTime } from "@/lib/time";
import { notificationHref } from "@/lib/notificationLink";
import { apiGet } from "@/lib/apiClient";
import { queryKeys } from "@/lib/queryKeys";

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
  RECORD_STATUS_CHANGED: "Status changed",
  STAGE_CHANGED: "Stage changed",
  NOTE_ADDED: "New note",
  TASK_COMPLETED: "Task completed",
  TASK_CANCELLED: "Task cancelled",
};

const TYPE_ICONS: Record<string, string> = {
  RECORD_ASSIGNED: "users",
  TASK_CREATED: "square_check",
  TASK_DUE: "clock",
  TASK_OVERDUE: "alert",
  TASK_REMINDER: "bell",
  APPOINTMENT_SCHEDULED: "calendar",
  IMPORT_COMPLETED: "check_circle",
  IMPORT_FAILED: "x_circle",
  PLATFORM_USER_ONLINE: "plug",
  SYSTEM: "shield",
  RECORD_STATUS_CHANGED: "refresh",
  STAGE_CHANGED: "trending",
  NOTE_ADDED: "note",
  TASK_COMPLETED: "check_circle",
  TASK_CANCELLED: "x_circle",
};

/** Home widgets: my task counters + in-app notifications with mark-all-read.
 *  Both flows ride the shared TanStack caches — ["tasks","widget"] and the
 *  ["notifications"] family — so bell/center mutations refresh them too. */
export function HomeWidgets() {
  const queryClient = useQueryClient();

  const tasksQuery = useQuery({
    queryKey: queryKeys.tasks.widget,
    queryFn: () =>
      apiGet<{ data: TaskRow[]; meta: { openCount: number; overdueCount: number } }>("/api/tasks?mine=1"),
  });
  const openCount = tasksQuery.data?.meta.openCount ?? null;
  const overdueCount = tasksQuery.data?.meta.overdueCount ?? null;
  const tasks = tasksQuery.data?.data.slice(0, 4) ?? [];

  const notificationsQuery = useQuery({
    queryKey: queryKeys.notifications.recent,
    queryFn: () => apiGet<{ data: NotificationRow[]; meta: { unread: number } }>("/api/notifications"),
  });
  const notifications = notificationsQuery.data?.data ?? [];
  const unread = notificationsQuery.data?.meta.unread ?? 0;

  const markAllRead = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/notifications", { method: "PATCH" });
      if (!response.ok) throw new Error("Could not mark notifications as read — try again.");
    },
    onSuccess: () => {
      toast.success("All caught up");
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.root });
    },
    onError: () => toast.error("Could not mark notifications as read — try again."),
  });

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <Section
        title="My work queue"
        actions={<Link href="/tasks?mine=1" className="text-xs font-medium text-muted-foreground hover:text-foreground">View tasks</Link>}
      >
        <div className="grid grid-cols-2 gap-4">
          <Link href="/tasks?mine=1" className="min-w-0 rounded-lg border border-border bg-card p-2 transition-colors hover:bg-muted/50">
            <p className="text-2xl font-semibold tabular-nums">{openCount ?? "–"}</p>
            <p className="text-sm text-muted-foreground">open tasks</p>
          </Link>
          <Link href="/tasks?due=overdue&mine=1" className="min-w-0 rounded-lg border border-border bg-card p-2 transition-colors hover:bg-muted/50">
            <p className={cn("text-2xl font-semibold tabular-nums", (overdueCount ?? 0) > 0 ? "text-destructive" : "")}>{overdueCount ?? "–"}</p>
            <p className="text-sm text-muted-foreground">overdue</p>
          </Link>
        </div>
        <div className="pt-6">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next actions</p>
            <Link href="/tasks?due=upcoming&mine=1" className="text-xs font-medium text-muted-foreground hover:text-foreground">Upcoming</Link>
          </div>
          {tasks.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">No pending tasks in your queue.</p>
          ) : (
            <ul className="divide-y divide-border">
              {tasks.map((task) => {
                // Exact page: a task row opens the TASK, not the record it
                // happens to be attached to.
                const href = `/tasks/${task.id}`;
                const overdue = task.dueAt ? new Date(task.dueAt).getTime() < Date.now() : false;
                return (
                  <li key={task.id}>
                    <Link href={href} className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2.5 text-sm hover:bg-muted">
                      <span className="flex min-w-0 items-center gap-2">
                        <Icon
                          name={task.priority === "URGENT" ? "alert" : task.priority === "HIGH" ? "clock" : "square_check"}
                          size={13}
                          className={cn("shrink-0", task.priority === "URGENT" ? "text-destructive" : "text-muted-foreground")}
                        />
                        <span className="min-w-0 truncate font-medium">{task.title}</span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums",
                          overdue ? "bg-(--error-bg) text-(--error)" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {task.dueAt ? new Date(task.dueAt).toLocaleDateString() : "no due date"}
                      </span>
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
            {unread > 0 ? <Badge>{unread} unread</Badge> : null}
            <Link href="/notifications" className="text-xs font-medium text-muted-foreground hover:text-foreground">View all</Link>
            {unread > 0 ? (
              <Button variant="secondary" size="sm" icon="check" disabled={markAllRead.isPending} onClick={() => markAllRead.mutate()}>
                Mark all read
              </Button>
            ) : null}
          </>
        }
      >
        {notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet — assignments and shared tasks land here.</p>
        ) : (
          <ul className="max-h-72 divide-y divide-border overflow-y-auto">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <Link
                  href={notificationHref(notification)}
                  className={cn(
                    "-mx-2 flex items-start gap-2.5 rounded-md px-2 py-2.5 text-sm transition-colors hover:bg-muted",
                    notification.readAt ? "" : "bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md",
                      notification.readAt ? "bg-background text-muted-foreground" : "bg-background text-foreground",
                    )}
                  >
                    <Icon name={TYPE_ICONS[notification.type] ?? "bell"} size={12} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium">
                      {TYPE_LABELS[notification.type] ?? notification.type}
                      {typeof notification.payload.title === "string" ? `: ${notification.payload.title}` : ""}
                    </span>
                    <time
                      className="mt-0.5 block text-xs text-muted-foreground"
                      dateTime={notification.createdAt}
                      title={absoluteTime(notification.createdAt)}
                    >
                      {relativeTime(notification.createdAt)}
                    </time>
                  </span>
                  {!notification.readAt ? <span aria-hidden className="mt-2 ml-auto h-2 w-2 shrink-0 rounded-full bg-foreground" /> : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
