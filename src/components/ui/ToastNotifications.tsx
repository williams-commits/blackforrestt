"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useToastStore, type Toast } from "@/lib/toast";
import type { ServerMessage } from "@/lib/ws/client";

interface NotificationToast {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  toastedAt: string | null;
  createdAt: string;
  metadata?: { reason?: string } | null;
}

/**
 * Trade events the ACTING client already confirmed with an instant local toast
 * (order accepted in the trade panel, manual close in the positions dock).
 * Showing the DB notification too would double-toast the same action — it is
 * still marked read here and remains in the notification history. Automatic
 * closes (stop loss, take profit, expiry, stop-out, operator) have no acting
 * client and still surface as DB toasts.
 */
function suppressedByLocalToast(item: NotificationToast): boolean {
  if (item.type === "TRADE_OPENED") return true;
  return item.type === "TRADE_CLOSED" && item.metadata?.reason === "MANUAL";
}

/** Renders ephemeral toasts (toast.success/error/info) + polled DB notifications. */
export function ToastNotifications() {
  const { status } = useSession();
  const [dbToasts, setDbToasts] = useState<NotificationToast[]>([]);
  const seen = useRef(new Set<string>());
  const ephemeral = useToastStore((state) => state.toasts);
  const dismissEphemeral = useToastStore((state) => state.dismiss);

  // DB-backed notifications (polled while authenticated).
  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;

    async function load() {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json().catch(() => ({ notifications: [] }));
      const notifications = Array.isArray(payload.notifications) ? payload.notifications as NotificationToast[] : [];
      // Toast only what has never been toasted — the unread state (readAt)
      // is intentionally LEFT ALONE so the Notifications tab badge survives
      // and steers the user to the history; toasts no longer consume it.
      const fresh = notifications.filter((item) => !item.readAt && !item.toastedAt && !seen.current.has(item.id));
      // Mark ids as seen ONLY when they are processed. Marking them earlier
      // lets a StrictMode double-mounted effect consume the batch in its
      // aborted first closure (active=false) — the remounted closure then
      // finds nothing fresh and every toast is silently swallowed.
      if (!active || fresh.length === 0) return;
      fresh.forEach((item) => seen.current.add(item.id));
      // Everything unread is acknowledged (badge clears), but locally-confirmed
      // trade actions don't re-toast — the acting UI already showed one.
      const displayable = fresh.filter((item) => !suppressedByLocalToast(item));
      if (displayable.length > 0) {
        setDbToasts((current) => [...displayable, ...current].slice(0, 4));
      }
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: fresh.map((item) => item.id), toasted: true }),
      }).catch(() => undefined);
    }

    void load();
    const timer = window.setInterval(() => void load(), 12_000);
    // Trades, payment approvals (and other fund movements) create DB
    // notifications — the 12s poll would show them up to 12s late, which reads
    // as "no feedback". The realtime bridge already pushes position/account
    // events within ~1s of the trade; refresh immediately when one arrives so
    // the toast appears while the user is still looking at the screen.
    const handleRealtime = (event: Event) => {
      const message = (event as CustomEvent<ServerMessage>).detail;
      const isLedgerMovement = message?.type === "account" && message.reason === "ledger";
      const isPositionEvent = message?.type === "position";
      if (isLedgerMovement || isPositionEvent) void load();
    };
    window.addEventListener("blckforest:realtime", handleRealtime);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("blckforest:realtime", handleRealtime);
    };
  }, [status]);

  // Auto-dismiss the oldest DB toast.
  useEffect(() => {
    if (dbToasts.length === 0) return;
    const timer = window.setTimeout(() => setDbToasts((current) => current.slice(0, -1)), 5_500);
    return () => window.clearTimeout(timer);
  }, [dbToasts]);

  if (ephemeral.length === 0 && dbToasts.length === 0) return null;

  return (
    <div className="fixed right-3 top-14 z-80 flex w-[min(22rem,calc(100vw-1.5rem))] flex-col gap-2" aria-live="polite" aria-atomic="false">
      {ephemeral.map((t) => (
        <ToastCard key={t.id} variant={t.variant} title={t.title} body={t.body} onDismiss={() => dismissEphemeral(t.id)} />
      ))}
      {dbToasts.map((t) => (
        <ToastCard key={`db-${t.id}`} variant="info" title={t.title} body={t.body} onDismiss={() => setDbToasts((current) => current.filter((item) => item.id !== t.id))} />
      ))}
    </div>
  );
}

const VARIANT_STYLE: Record<Toast["variant"], { border: string; icon: string; iconColor: string }> = {
  success: { border: "border-up/40", icon: "✓", iconColor: "text-up" },
  error: { border: "border-down/40", icon: "✕", iconColor: "text-down" },
  info: { border: "border-brand/40", icon: "ℹ", iconColor: "text-brand" },
};

function ToastCard({ variant, title, body, onDismiss }: { variant: Toast["variant"]; title: string; body?: string; onDismiss: () => void }) {
  const style = VARIANT_STYLE[variant];
  return (
    <div className={`rounded border ${style.border} bg-canvas px-3 py-2 shadow-card`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span className={`mt-0.5 text-xs font-bold ${style.iconColor}`} aria-hidden="true">{style.icon}</span>
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold">{title}</div>
            {body && <div className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-text-muted">{body}</div>}
          </div>
        </div>
        <button type="button" aria-label="Dismiss notification" onClick={onDismiss} className="rounded px-1 text-text-faint hover:bg-panel-2 hover:text-text">
          x
        </button>
      </div>
    </div>
  );
}
