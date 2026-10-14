"use client";

import { useEffect, useRef } from "react";
import { toast } from "@/lib/toast";
import { notificationMeta } from "@/lib/notificationMeta";

/**
 * DB-notification → toast bridge. The engine, payments and admin messaging
 * write Notification rows; this bridge polls the recent set (visible tabs
 * only), raises one toast per unseen row (toastedAt ack — the unread badge
 * survives until the user actually reads it), then acknowledges. Capped per
 * cycle so a returning tab never floods.
 */

const POLL_MS = 12_000;
const FETCH_LIMIT = 8;
const MAX_TOASTS_PER_CYCLE = 3;

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  toastedAt: string | null;
}

export function NotificationToastBridge() {
  const seen = useRef(new Set<string>());

  useEffect(() => {
    let timer: number | null = null;
    let stopped = false;

    const tick = async () => {
      if (stopped || document.hidden) return;
      try {
        const response = await fetch(`/api/notifications?scope=recent&limit=${FETCH_LIMIT}`, { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json().catch(() => null) as { notifications?: NotificationRow[] } | null;
        const fresh = (payload?.notifications ?? [])
          .filter((n) => n.toastedAt == null && !seen.current.has(n.id))
          .slice(0, MAX_TOASTS_PER_CYCLE);
        for (const n of fresh) {
          seen.current.add(n.id);
          const meta = notificationMeta(n.type);
          const Icon = meta.icon;
          const tone = meta.tone === "down" ? "error" : meta.tone === "up" ? "success" : "info";
          toast[tone](n.title, n.body, 6_000);
          void Icon; // icon reserved for the sonner custom-toast pass
        }
        if (fresh.length > 0) {
          // Toast-layer ack ONLY — displayed, not read; the unread badge
          // survives so the feed still shows them until genuinely opened.
          await fetch("/api/notifications", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ids: fresh.map((n) => n.id), toasted: true }),
          }).catch(() => undefined);
        }
      } catch {
        // Offline — next cycle retries.
      }
    };

    const start = () => {
      if (timer == null) {
        timer = window.setInterval(() => void tick(), POLL_MS);
        void tick();
      }
    };
    const stop = () => {
      if (timer != null) { window.clearInterval(timer); timer = null; }
    };
    const onVisibility = () => { if (document.hidden) stop(); else start(); };

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
