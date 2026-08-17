"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ServerMessage } from "@/lib/ws/client";

/** Re-fetches server-rendered page data when funds move (payment approved,
 *  rejected, reversed, cancelled, admin adjustment) or a position closes.
 *  Mount once on server-rendered pages that show balance/history data. */
export function RealtimeRefresh({ debounceMs = 500 }: { debounceMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handleRealtime = (event: Event) => {
      const message = (event as CustomEvent<ServerMessage>).detail;
      const ledgerChanged = message?.type === "account" && message.reason === "ledger";
      const positionClosed = message?.type === "position" && message.position.status === "CLOSED";
      if (!ledgerChanged && !positionClosed) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), debounceMs);
    };
    window.addEventListener("blckforest:realtime", handleRealtime);
    return () => {
      window.removeEventListener("blckforest:realtime", handleRealtime);
      if (timer) clearTimeout(timer);
    };
  }, [router, debounceMs]);

  return null;
}
