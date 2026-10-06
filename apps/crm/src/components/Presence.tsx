"use client";

import { useEffect, useState } from "react";

export interface PresenceUser {
  id: string;
  name: string;
}

/**
 * Team presence: polls who has a fresh heartbeat (90s server window) so the
 * UI can mark teammates as online. Best-effort — failures keep the last
 * known state and the next poll retries.
 */
export function usePresence(pollMs = 60_000): { online: Set<string> } {
  const [online, setOnline] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch("/api/presence", { cache: "no-store" });
        if (!response.ok) return;
        const body = (await response.json().catch(() => null)) as { data?: { online?: PresenceUser[] } } | null;
        if (active && body?.data?.online) {
          setOnline(new Set(body.data.online.map((user) => user.id)));
        }
      } catch {
        // presence is best-effort; retry on the next tick
      }
    }
    void load();
    const timer = window.setInterval(load, pollMs);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [pollMs]);

  return { online };
}

/** Small online indicator — render nothing when the user is offline. */
export function PresenceDot({ online, title }: { online: boolean; title?: string }) {
  if (!online) return null;
  return (
    <span
      title={title ?? "Online now"}
      aria-label={title ?? "Online now"}
      className="inline-block size-2 shrink-0 rounded-full bg-emerald-500 ring-2 ring-background"
    />
  );
}
