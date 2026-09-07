"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/** Refresh the current authorized view when the server records a mutation. */
export function RealtimeBridge() {
  const router = useRouter();
  const lastRefresh = useRef<string | null>(null);

  useEffect(() => {
    const source = new EventSource("/api/realtime");
    const onRefresh = (event: MessageEvent<string>) => {
      const payload = JSON.parse(event.data) as { id?: string };
      if (!payload.id || payload.id === lastRefresh.current) return;
      lastRefresh.current = payload.id;
      window.dispatchEvent(new CustomEvent("crm:realtime-refresh"));
      window.dispatchEvent(new CustomEvent("crm:notifications-refresh"));
      router.refresh();
    };
    source.addEventListener("refresh", onRefresh as EventListener);
    return () => {
      source.removeEventListener("refresh", onRefresh as EventListener);
      source.close();
    };
  }, [router]);

  return null;
}