"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/Icon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button, EmptyState } from "@/components/ui";
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
  PAYMENT_STATUS_CHANGED: "Payment update",
  KYC_STATUS_CHANGED: "KYC update",
  ACCOUNT_STATE_CHANGED: "Trading account",
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
  PAYMENT_STATUS_CHANGED: "trending",
  KYC_STATUS_CHANGED: "shield",
  ACCOUNT_STATE_CHANGED: "plug",
};

/** Context layer — the team inbox. Rides the shared ["notifications"] cache
 *  so the bell, the notification center, and this card stay in lockstep. */
export function TeamInbox({ className }: { className?: string }) {
  const queryClient = useQueryClient();

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
    <Card className={className}>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          Team inbox
          {unread > 0 ? <Badge>{unread} unread</Badge> : null}
        </CardTitle>
        <div className="flex items-center gap-1">
          {unread > 0 ? (
            <Button variant="tertiary" size="sm" icon="check" disabled={markAllRead.isPending} onClick={() => markAllRead.mutate()}>
              Mark read
            </Button>
          ) : null}
          <Link href="/notifications" className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
            View all
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {notificationsQuery.isPending ? (
          <div className="space-y-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-start gap-2.5">
                <Skeleton className="size-6 rounded-md" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : notificationsQuery.isError ? (
          <EmptyState
            icon="alert"
            tone="error"
            title="Inbox didn't load"
            description="Notifications are one retry away."
            action={<Button variant="secondary" size="sm" icon="refresh" onClick={() => void notificationsQuery.refetch()}>Retry</Button>}
          />
        ) : notifications.length === 0 ? (
          <EmptyState
            icon="bell"
            title="Nothing yet"
            description="Assignments and shared tasks land here the moment they happen."
          />
        ) : (
          <ul className="max-h-80 divide-y divide-border/60 overflow-y-auto">
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
      </CardContent>
    </Card>
  );
}
