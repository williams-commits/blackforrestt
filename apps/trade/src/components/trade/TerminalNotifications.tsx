"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { ServerMessage } from "@/lib/ws/client";

interface LiveEvent {
  id: number;
  time: number;
  tone: "up" | "down" | "brand";
  icon: "position-up" | "position-down" | "ledger";
  text: string;
}

const MAX_EVENTS = 20;

/**
 * Real-time terminal notifications — a live feed of what actually happens on
 * the account while you trade: position opens/closes and ledger (balance)
 * changes, sourced from the same `blckforest:realtime` event bus that drives
 * the rest of the UI. Nothing is synthesized; an idle account shows an honest
 * empty state. History is session-scoped (this terminal mount).
 */
export function TerminalNotifications() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const counter = useRef(0);

  useEffect(() => {
    const onRealtime = (event: Event) => {
      const message = (event as CustomEvent<ServerMessage>).detail;
      const next: Omit<LiveEvent, "id" | "time"> | null = (() => {
        if (message?.type === "position") {
          const position = message.position;
          if (position.status === "OPEN") {
            return {
              tone: position.side === "BUY" ? "up" : "down",
              icon: position.side === "BUY" ? "position-up" : "position-down",
              text: `${position.symbol} ${position.side} ${position.volume.toFixed(2)} opened`,
            };
          }
          return {
            tone: position.netProfit >= 0 ? "up" : "down",
            icon: position.netProfit >= 0 ? "position-up" : "position-down",
            text: `${position.symbol} closed ${position.netProfit >= 0 ? "+" : ""}${position.netProfit.toFixed(2)}`,
          };
        }
        if (message?.type === "account" && (message as { reason?: string }).reason === "ledger") {
          return { tone: "brand", icon: "ledger", text: "Account balance updated" };
        }
        return null;
      })();
      if (!next) return;
      counter.current += 1;
      setEvents((prev) => [{ ...next, id: counter.current, time: Date.now() }, ...prev].slice(0, MAX_EVENTS));
      if (!openRef.current) setUnread((prev) => prev + 1);
    };
    window.addEventListener("blckforest:realtime", onRealtime);
    return () => window.removeEventListener("blckforest:realtime", onRealtime);
  }, []);

  // Displayed = read: opening the dropdown marks the session's notifications
  // seen locally AND settles the server-side unread count (mark all read), so
  // badges never stay inflated and alerts don't repeat after being shown.
  const openRef = useRef(false);
  const settleServerCount = async () => {
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (response.ok) {
        window.dispatchEvent(new CustomEvent("blckforest:counts-changed"));
      }
    } catch {
      // Offline — the local badge already cleared; server count settles on
      // the next poll or open.
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={(next) => { setOpen(next); openRef.current = next; if (next) { setUnread(0); void settleServerCount(); } }}>
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
      <DropdownMenuContent align="end" className="w-72 rounded-lg border border-border bg-canvas p-0 text-xs shadow-xl">
        <div className="border-b border-border-soft bg-panel-2/50 px-3 py-2 text-(length:--term-text-2xs) font-semibold uppercase tracking-wide text-text-faint">
          Live Notifications
        </div>
        <div className="max-h-72 overflow-y-auto">
          {events.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-text-faint">
              No live notifications yet — fills and account events appear here in real time.
            </p>
          ) : (
            <ul>
              {events.map((e) => (
                <li key={e.id} className="flex items-center gap-2 border-b border-border-soft px-3 py-2 last:border-b-0">
                  <span className={`shrink-0 ${e.tone === "up" ? "text-up" : e.tone === "down" ? "text-down" : "text-brand"}`}>
                    {e.icon === "ledger" ? <Wallet size={13} strokeWidth={2} aria-hidden /> : e.icon === "position-up" ? <TrendingUp size={13} strokeWidth={2} aria-hidden /> : <TrendingDown size={13} strokeWidth={2} aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-text">{e.text}</span>
                  <span className="shrink-0 text-(length:--term-text-2xs) tnum text-text-faint">
                    {new Date(e.time).toLocaleTimeString("en-GB", { hour12: false })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
