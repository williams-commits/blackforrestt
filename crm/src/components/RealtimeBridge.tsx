"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/** Refresh the current authorized view when the server records a mutation. */
export function RealtimeBridge() {
  const router = useRouter();
  const lastRefresh = useRef(0);

  useEffect(() => {
    const source = new EventSource("/api/realtime");
    const onRefresh = (event: MessageEvent<string>) => {
      const payload = JSON.parse(event.data) as { at?: string };
      const timestamp = payload.at ? Date.parse(payload.at) : Date.now();
      if (timestamp <= lastRefresh.current) return;
      lastRefresh.current = timestamp;
      window.dispatchEvent(new CustomEvent("crm:realtime-refresh"));
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