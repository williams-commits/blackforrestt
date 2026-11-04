"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Check, TrendingDown, TrendingUp, Wallet, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

interface NotificationFeed {
  notifications: NotificationRow[];
  unreadCount: number;
}

const FETCH_LIMIT = 8;
const POLL_MS = 15_000;

function notificationIcon(type: string) {
  if (type === "TRADE_OPENED") return TrendingUp;
  if (type === "TRADE_CLOSED") return TrendingDown;
  if (type.startsWith("PAYMENT_")) return Wallet;
  return Bell;
}

function notificationTone(type: string): string {
  if (type === "TRADE_OPENED" || type === "PAYMENT_APPROVED") return "text-up";
  if (type === "TRADE_CLOSED" || type === "PAYMENT_REJECTED") return "text-down";
  return "text-brand";
}

/**
 * Persisted notification feed. Dismissal acknowledges the database row as read,
 * keeping the unread badge accurate across reloads and other account surfaces.
 */
export function TerminalNotifications() {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/notifications?scope=recent&limit=${FETCH_LIMIT}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | (NotificationFeed & { error?: string })
        | null;
      if (!response.ok) throw new Error(payload?.error ?? "Unable to load notifications.");
      setNotifications((payload?.notifications ?? []).filter((item) => item.readAt == null));
      setUnread(payload?.unreadCount ?? 0);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load notifications.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    const onCountsChanged = () => void refresh();
    window.addEventListener("blckforest:counts-changed", onCountsChanged);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("blckforest:counts-changed", onCountsChanged);
    };
  }, [refresh]);

  const dismiss = async (id: string) => {
    setDismissing(id);
    setError(null);
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) throw new Error(payload?.error ?? "Unable to dismiss notification.");
      setNotifications((current) => current.filter((item) => item.id !== id));
      await refresh();
      window.dispatchEvent(new CustomEvent("blckforest:counts-changed"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to dismiss notification.");
    } finally {
      setDismissing(null);
    }
  };

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void refresh();
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
          className="relative flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-panel-2 hover:text-text focus-visible:outline-2 focus-visible:outline-brand"
        >
          <Bell size={15} strokeWidth={2} aria-hidden />
          {unread > 0 && (
            <Badge className="absolute -right-1 -top-1 h-4 min-w-4 px-1 text-[9px] font-bold leading-none">
              {unread > 99 ? "99+" : unread}
            </Badge>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 rounded-lg border border-border bg-canvas p-0 text-xs shadow-xl">
        <div className="flex items-center justify-between border-b border-border-soft bg-panel-2/50 px-3 py-2 text-(length:--term-text-2xs) font-semibold uppercase tracking-wide text-text-faint">
          <span>Notifications</span>
          <span className="normal-case tabular-nums">{unread} unread</span>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {error ? (
            <p className="px-3 py-4 text-xs text-down" role="alert">{error}</p>
          ) : notifications.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-text-faint">
              You&apos;re all caught up.
            </p>
          ) : (
            <ul>
              {notifications.map((item) => {
                const Icon = notificationIcon(item.type);
                return (
                  <li key={item.id} className="flex items-start gap-2 border-b border-border-soft px-3 py-2.5 last:border-b-0">
                    <span className={`mt-0.5 shrink-0 ${notificationTone(item.type)}`}>
                      <Icon size={13} strokeWidth={2} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-text">{item.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-(length:--term-text-2xs) text-text-muted">{item.body}</p>
                      <time className="mt-1 block text-(length:--term-text-2xs) tnum text-text-faint" dateTime={item.createdAt}>
                        {new Date(item.createdAt).toLocaleTimeString("en-GB", { hour12: false })}
                      </time>
                    </div>
                    <button
                      type="button"
                      aria-label={`Dismiss ${item.title}`}
                      title="Dismiss notification"
                      disabled={dismissing === item.id}
                      onClick={() => void dismiss(item.id)}
                      className="flex size-7 shrink-0 items-center justify-center rounded-md text-text-faint hover:bg-panel-2 hover:text-text focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50"
                    >
                      {dismissing === item.id
                        ? <Check size={13} strokeWidth={2} aria-hidden />
                        : <X size={13} strokeWidth={2} aria-hidden />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
