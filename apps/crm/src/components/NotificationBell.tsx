"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationHref } from "@/lib/notificationLink";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { relativeTime, absoluteTime } from "@/lib/time";
import { apiGet } from "@/lib/apiClient";
import { queryKeys } from "@/lib/queryKeys";
import { useIsDesktop } from "@/lib/useMediaQuery";

interface NotificationRow {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  toastedAt?: string | null;
  createdAt: string;
}

interface NotificationListResponse {
  data: NotificationRow[];
  meta: { unread: number };
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
  RECORD_STATUS_CHANGED: "Status changed",
  STAGE_CHANGED: "Stage changed",
  NOTE_ADDED: "New note",
  TASK_COMPLETED: "Task completed",
  TASK_CANCELLED: "Task cancelled",
  COMMENT_ADDED: "New comment",
};

function notificationTitle(notification: NotificationRow): string {
  const label = TYPE_LABELS[notification.type] ?? notification.type.replaceAll("_", " ").toLowerCase();
  const subject = notification.payload.label ?? notification.payload.title;
  return typeof subject === "string" ? `${label}: ${subject}` : label;
}

/** Patch the shared ["notifications","recent"] cache after a local
 *  read/toast acknowledgement, so the badge and every mounted consumer
 *  agree without waiting for a refetch. */
function patchRecentCache(
  queryClient: ReturnType<typeof useQueryClient>,
  patch: (rows: NotificationRow[], unread: number) => { rows: NotificationRow[]; unread: number },
) {
  queryClient.setQueryData<NotificationListResponse>(queryKeys.notifications.recent, (current) => {
    if (!current) return current;
    const next = patch(current.data ?? [], current.meta?.unread ?? 0);
    return { ...current, data: next.rows, meta: { ...current.meta, unread: next.unread } };
  });
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const knownIds = useRef<Set<string> | null>(null);
  const queryClient = useQueryClient();
  const isDesktop = useIsDesktop();

  // Full list: mounted with the bell's lifetime, steady-state 60s poll —
  // exactly the cadence the manual implementation ran.
  const listQuery = useQuery({
    queryKey: queryKeys.notifications.recent,
    queryFn: () => apiGet<NotificationListResponse>("/api/notifications"),
    refetchInterval: 60_000,
  });
  const notifications = listQuery.data?.data ?? [];
  const unread = listQuery.data?.meta.unread ?? 0;
  const loading = listQuery.isPending;

  // Cheap unread-count poll (12s): when unread grows, pull the full list so
  // toasts and the dropdown stay fresh.
  const countsQuery = useQuery({
    queryKey: queryKeys.notifications.counts,
    queryFn: () => apiGet<{ data: { unread: number } }>("/api/notifications?scope=counts"),
    refetchInterval: 12_000,
  });
  const lastUnread = useRef<number | null>(null);
  useEffect(() => {
    const unreadNow = countsQuery.data?.data.unread;
    if (typeof unreadNow !== "number") return;
    const previous = lastUnread.current;
    lastUnread.current = unreadNow;
    if (previous === null ? unreadNow > 0 : unreadNow > previous) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.recent });
    }
  }, [countsQuery.data, queryClient]);

  // Toast cadence (trading-platform pattern): toast unread notifications
  // that were never toasted, then acknowledge them server-side — the unread
  // badge survives the toast and steers the user to the history.
  useEffect(() => {
    const nextNotifications = listQuery.data?.data;
    if (!nextNotifications) return;
    const previousIds = knownIds.current;
    const freshToasts: string[] = [];
    if (previousIds) {
      for (const notification of nextNotifications) {
        if (!previousIds.has(notification.id) && !notification.readAt && !notification.toastedAt) {
          freshToasts.push(notification.id);
          toast.info(notificationTitle(notification));
        }
      }
    }
    knownIds.current = new Set(nextNotifications.map((notification) => notification.id));
    if (freshToasts.length > 0) {
      void fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: freshToasts, toasted: true }),
      }).catch(() => undefined);
    }
  }, [listQuery.data]);

  // Realtime signal from the SSE bridge — same contract as before.
  useEffect(() => {
    const onRealtimeNotification = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.root });
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("crm:notifications-refresh", onRealtimeNotification);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("crm:notifications-refresh", onRealtimeNotification);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [queryClient]);

  // Outside-click closes the DESKTOP dropdown only. On mobile the bottom
  // Sheet owns its own dismissal (backdrop + Escape via Radix) — this
  // listener must not kill Sheet interactions.
  useEffect(() => {
    if (!isDesktop) return;
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [isDesktop]);

  async function markAllRead() {
    // Optimistic: badge and list update instantly; failure reverts via refetch.
    const previous = queryClient.getQueryData<NotificationListResponse>(queryKeys.notifications.recent);
    patchRecentCache(queryClient, (rows) => ({
      rows: rows.map((notification) => ({ ...notification, readAt: new Date().toISOString() })),
      unread: 0,
    }));
    try {
      const response = await fetch("/api/notifications", { method: "PATCH" });
      if (!response.ok) throw new Error("failed");
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.counts });
    } catch {
      queryClient.setQueryData(queryKeys.notifications.recent, previous);
      toast.error("Could not mark notifications as read — try again.");
    }
  }

  function openBell() {
    setOpen((previous) => !previous);
    if (!open) void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.recent });
  }

  /** One panel body shared by both surfaces — desktop dropdown and mobile
   *  bottom Sheet render identical content, so behavior can never drift. */
  const panel = (
    <>
      <div className="flex items-center justify-between border-b border-border bg-muted px-4 py-3">
        <div><p className="text-sm font-semibold">Notifications</p><p className="text-[11px] text-muted-foreground">{unread ? `${unread} unread` : "All caught up"}</p></div>
        {unread > 0 ? <button type="button" onClick={() => void markAllRead()} className="-my-1 inline-flex min-h-9 items-center px-2 text-[11px] font-semibold hover:underline">Mark all read</button> : null}
      </div>
      {loading && notifications.length === 0 ? <p className="px-4 py-6 text-center text-sm text-muted-foreground">Checking for updates…</p> : notifications.length === 0 ? <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nothing new yet.</p> : (
        <ul className={cn("overflow-y-auto", isDesktop ? "max-h-80" : "max-h-[60dvh]")}>
          {notifications.slice(0, 12).map((notification) => {
            const href = notificationHref(notification);
            const content = <><p className="text-xs font-semibold">{notificationTitle(notification)}</p><p className="mt-1 text-[10px] text-muted-foreground"><time dateTime={notification.createdAt} title={absoluteTime(notification.createdAt)}>{relativeTime(notification.createdAt)}</time></p></>;
            // Clicking a notification marks it read and navigates — the
            // "Mark all read" control stays for bulk clearing.
            const openAndMarkRead = () => {
              setOpen(false);
              if (notification.readAt) return;
              patchRecentCache(queryClient, (rows, unreadCount) => ({
                rows: rows.map((row) => (row.id === notification.id ? { ...row, readAt: new Date().toISOString() } : row)),
                unread: Math.max(0, unreadCount - 1),
              }));
              void fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: notification.id, read: true }) })
                .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.counts }))
                .catch(() => undefined);
            };
            return <li key={notification.id} className={cn("border-b border-border px-4 py-3 last:border-0", notification.readAt ? "text-muted-foreground" : "bg-muted text-foreground")}><Link href={href} onClick={openAndMarkRead} className="block py-1 hover:opacity-75">{content}</Link></li>;
          })}
        </ul>
      )}
      <Link href="/notifications" onClick={() => setOpen(false)} className="block border-t border-border px-4 py-3 text-center text-xs font-semibold hover:bg-muted">View notification center</Link>
    </>
  );

  return (
    <div ref={ref} className="relative">
      <Button
        variant="tertiary"
        size="icon"
        onClick={openBell}
        className="relative rounded-full text-muted-foreground"
        title={unread > 0 ? `${unread} unread notifications` : "Notifications"}
        aria-label={unread > 0 ? `${unread} unread notifications` : "Notifications"}
        aria-expanded={open}
        aria-haspopup={isDesktop ? "menu" : "dialog"}
      >
        <Icon name="bell" size={16} />
        {unread > 0 ? <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-4 text-white">{unread > 99 ? "99+" : unread}</span> : null}
      </Button>

      {isDesktop ? (
        // Desktop: anchored dropdown beside the bell (unchanged behavior).
        open ? (
          <div className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-popover shadow-md" role="menu">
            {panel}
          </div>
        ) : null
      ) : (
        // Mobile: bottom Sheet — fits the viewport, scrolls, backdrop/Escape
        // close and focus return come from the Radix sheet primitive.
        <Sheet
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            // Radix restores focus to whatever was focused when the sheet
            // opened (nothing, for a programmatic open) AFTER this callback
            // — defer past it so the bell trigger keeps focus for keyboard
            // users regardless of how the panel was opened or closed.
            if (!next) window.setTimeout(() => ref.current?.querySelector("button")?.focus(), 0);
          }}
        >
          <SheetContent
            side="bottom"
            className="mx-auto flex max-h-[85dvh] w-full max-w-lg flex-col gap-0 overflow-y-auto rounded-t-2xl p-0"
            aria-label="Notifications"
          >
            <SheetTitle className="sr-only">Notifications</SheetTitle>
            {panel}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
