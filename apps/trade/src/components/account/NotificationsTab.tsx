"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/Alert";
import { Bell, CheckCheck } from "lucide-react";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { SimpleDialog as Dialog } from "@/components/ui/Dialog";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtAgo, fmtDateTime } from "@/lib/dates";
import { notificationMeta, notificationTileClass } from "@/lib/notificationMeta";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

const PAGE_SIZE = 10;

const GROUP_LABELS: Record<string, string> = {
  all: "All",
  messages: "Messages",
  payments: "Payments",
  trades: "Trades",
  account: "Account",
};

const TYPE_TONES: Record<string, string> = {
  ADMIN_MESSAGE: "bg-(--term-warning-bg) text-(--term-warning-fg)",
  ADMIN_BROADCAST: "bg-(--term-warning-bg) text-(--term-warning-fg)",
  ADMIN_CHAT: "bg-(--term-warning-bg) text-(--term-warning-fg)",
  CUSTOMER_MESSAGE: "bg-(--term-warning-bg) text-(--term-warning-fg)",
  TRADE_OPENED: "bg-(--term-warning-bg) text-(--term-warning-fg)",
  TRADE_CLOSED: "bg-muted text-muted-foreground",
  ACCOUNT_STATUS: "bg-(--term-danger-bg) text-(--term-danger-fg)",
  PAYMENT_APPROVED: "bg-(--term-success-bg) text-(--term-success-fg)",
  PAYMENT_REJECTED: "bg-(--term-danger-bg) text-(--term-danger-fg)",
  PAYMENT_PREPARED: "bg-(--term-warning-bg) text-(--term-warning-fg)",
  PAYMENT_CANCELLED: "bg-muted text-muted-foreground",
  PAYMENT_REVERSED: "bg-muted text-muted-foreground",
};

/** Persisted notification feed — tonal rows with unread emphasis, category
 *  chips, mark-all-read, and Load more over the paginated API. Rows open a
 *  detail modal (opening an unread item marks it read). */
export function NotificationsTab({ onActivity, onOpenMessages }: { onActivity?: () => void; onOpenMessages?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [accumulated, setAccumulated] = useState<NotificationRow[]>([]);
  const [selected, setSelected] = useState<NotificationRow | null>(null);
  const [group, setGroup] = useState("all");
  const queryClient = useQueryClient();

  // Server state via react-query: 15s auto-sync while the tab is visible
  // (interval pauses in background tabs) + immediate refetch whenever the
  // shell's badge watcher reports new activity. Pages accumulate client-side
  // so Load more extends the feed without losing rows.
  const { data, isPending, isFetching, error: queryError } = useQuery({
    queryKey: ["account-notifications", page, group],
    queryFn: async () => {
      const response = await fetch(`/api/notifications?scope=all&limit=${PAGE_SIZE}&offset=${(page - 1) * PAGE_SIZE}${group !== "all" ? `&group=${group}` : ""}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null) as { notifications?: NotificationRow[]; unreadCount?: number; groupCounts?: Record<string, number>; error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Unable to load notifications.");
      return {
        items: payload?.notifications ?? [],
        unreadCount: payload?.unreadCount ?? 0,
        groupCounts: payload?.groupCounts ?? { all: 0, messages: 0, payments: 0, trades: 0, account: 0 },
      };
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  // First page replaces the feed (filters changed / fresh sync); later pages
  // append. Keyed by id so re-syncs never duplicate rows.
  useEffect(() => {
    if (!data) return;
    setAccumulated((prev) => {
      if (page === 1) return data.items;
      const seen = new Set(prev.map((i) => i.id));
      return [...prev, ...data.items.filter((i) => !seen.has(i.id))];
    });
  }, [data, page]);

  const unreadCount = data?.unreadCount ?? 0;
  const groupCounts = data?.groupCounts ?? { all: 0, messages: 0, payments: 0, trades: 0, account: 0 };
  const error = queryError instanceof Error ? queryError.message : null;
  const hasMore = data != null && data.items.length === PAGE_SIZE;

  useEffect(() => {
    const onCountsChanged = () => void queryClient.invalidateQueries({ queryKey: ["account-notifications"] });
    window.addEventListener("blckforest:counts-changed", onCountsChanged);
    return () => window.removeEventListener("blckforest:counts-changed", onCountsChanged);
  }, [queryClient]);

  async function markRead(id: string) {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      void queryClient.invalidateQueries({ queryKey: ["account-notifications"] });
      onActivity?.();
    } catch {
      // Failure surfaces via the invalidated query's own error state.
    }
  }

  async function markAllRead() {
    setBusy(true);
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      await queryClient.invalidateQueries({ queryKey: ["account-notifications"] });
    } catch {
      // Failure surfaces via the invalidated query's own error state.
    } finally {
      setBusy(false);
    }
  }

  const rows = useMemo(() => accumulated, [accumulated]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>Your full notification history — available whenever you sign in.</CardDescription>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <ChipGroup
            ariaLabel="Filter notifications by category" className="flex-wrap"
            value={group}
            onChange={(value) => { setGroup(value); setPage(1); setAccumulated([]); }}
            options={Object.entries(GROUP_LABELS).map(([key, label]) => ({
              value: key,
              label: `${label}${groupCounts[key] > 0 ? ` · ${groupCounts[key] > 99 ? "99+" : groupCounts[key]}` : ""}`,
            }))}
          />
        </div>
        {unreadCount > 0 && (
          <CardAction className="flex items-center gap-2">
            <Badge className="bg-primary text-primary-foreground">{unreadCount} unread</Badge>
            <Button type="button" size="sm" variant="outline" loading={busy} onClick={() => void markAllRead()}>
              <CheckCheck size={12} strokeWidth={2} aria-hidden /> Mark all read
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {error && <Alert tone="err">{error}</Alert>}

        {isPending && page === 1 ? (
          <div className="space-y-2" role="status" aria-label="Loading notifications">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/50" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Bell size={18} strokeWidth={1.75} aria-hidden />
            </div>
            <p className="text-sm font-medium">
              {group === "all" ? "No notifications yet." : `No ${GROUP_LABELS[group].toLowerCase()} notifications.`}
            </p>
          </div>
        ) : (
          <>
            <ul className="space-y-2">
              {rows.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      // Opening the detail modal marks the notification read —
                      // the user has seen it; no second click required.
                      if (!item.readAt) void markRead(item.id);
                      setSelected(item.readAt ? item : { ...item, readAt: new Date().toISOString() });
                    }}
                    className={`w-full rounded-xl p-3.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                      item.readAt ? "bg-card" : "bg-primary/10"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${notificationTileClass(item.type)}`}>
                        {(() => { const M = notificationMeta(item.type); return <M.icon size={15} strokeWidth={2} aria-hidden />; })()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-sm font-medium">{item.title}</span>
                            {!item.readAt && <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-label="New" />}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{fmtAgo(item.createdAt)}</span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
                        <span className={`mt-1.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${TYPE_TONES[item.type] ?? "bg-muted text-muted-foreground"}`}>
                          {notificationMeta(item.type).label}
                        </span>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            {hasMore && (
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button type="button" variant="outline" size="sm" loading={isFetching && page > 1} onClick={() => setPage((p) => p + 1)}>
                  Load more
                </Button>
                <span className="text-xs text-muted-foreground tabular-nums">{rows.length} loaded</span>
              </div>
            )}
          </>
        )}
      </CardContent>

      <Dialog
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.title ?? "Notification"}
        description={selected ? `${fmtDateTime(selected.createdAt)} · ${fmtAgo(selected.createdAt)}` : undefined}
        className="sm:max-w-md"
      >
        {selected && (
          <div className="space-y-4 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className={`flex size-9 items-center justify-center rounded-full ${notificationTileClass(selected.type)}`}>
                {(() => { const M = notificationMeta(selected.type); return <M.icon size={15} strokeWidth={2} aria-hidden />; })()}
              </span>
              <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${TYPE_TONES[selected.type] ?? "bg-muted text-muted-foreground"}`}>
                {notificationMeta(selected.type).label}
              </span>
              {!selected.readAt && <span className="text-xs font-semibold text-primary">● unread</span>}
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{selected.body}</p>
            <div className="flex flex-wrap justify-end gap-2">
              {(selected.type === "ADMIN_CHAT" || selected.type === "CUSTOMER_MESSAGE") && onOpenMessages && (
                <Button type="button" variant="default" onClick={() => { setSelected(null); onOpenMessages(); }}>
                  Open conversation
                </Button>
              )}
              <Button type="button" variant="ghost" onClick={() => setSelected(null)}>Close</Button>
            </div>
          </div>
        )}
      </Dialog>
    </Card>
  );
}
