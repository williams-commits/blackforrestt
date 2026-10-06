"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Live platform-presence badge for a linked customer. Polls the CRM's
 * scoped bridge route (the bridge itself is server-side only) and updates
 * without a reload — the server-rendered snapshot otherwise goes stale
 * while a rep stares at the customer page.
 *
 * Honest states: "online now" / "offline" only when the bridge answered;
 * "bridge unavailable" is surfaced instead of a false offline.
 */
export function PlatformPresenceBadge({ customerId, initialOnline }: { customerId: string; initialOnline: boolean }) {
  const [online, setOnline] = useState(initialOnline);
  const [reachable, setReachable] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch(`/api/customers/${customerId}/platform-presence`, { cache: "no-store" });
        if (!response.ok) return;
        const body = (await response.json().catch(() => null)) as { data?: { linked?: boolean; reachable?: boolean; online?: boolean } } | null;
        if (active && body?.data?.linked) {
          setReachable(Boolean(body.data.reachable));
          setOnline(Boolean(body.data.online));
        }
      } catch {
        // presence polling is best-effort; the last known state stands
      }
    }
    void load();
    const timer = window.setInterval(load, 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [customerId]);

  if (!reachable) {
    return (
      <span className="inline-flex items-center gap-1.5" style={{ color: "var(--warning)" }}>
        <span className="inline-block size-2 shrink-0 rounded-full" style={{ background: "var(--warning)" }} />
        bridge unavailable
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5" style={{ color: online ? "var(--success)" : "var(--text-tertiary)" }}>
      <span
        className={cn("inline-block size-2 shrink-0 rounded-full", online && "animate-pulse")}
        style={{ background: online ? "var(--success)" : "var(--text-tertiary)" }}
      />
      {online ? "online now" : "offline"}
    </span>
  );
}
