"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * The single TanStack Query boundary for the CRM app. One QueryClient per
 * browser session (created lazily inside state — never a module-level
 * singleton, which would leak between SSR renders).
 *
 * Defaults, tuned to the CRM's existing manual-fetch behavior rather than
 * guesswork:
 *  - staleTime 30s: collaborative data, but the app already refreshed on
 *    focus/realtime signals — 30s keeps back-navigation instant without
 *    letting counters drift on a screen left open.
 *  - retry 1: one retry absorbs dev-server restarts and blips; the old
 *    manual code did not retry at all, so more would mask real failures.
 *  - refetchOnWindowFocus: the previous NotificationBell/HomeWidgets did
 *    exactly this by hand — the QueryClient now provides it for free.
 * Mutations declare their own error UX per call site; no global defaults.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: true,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
