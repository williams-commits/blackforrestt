"use client";

import { useEffect, useState } from "react";
import { SessionProvider, useSession } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { socket, type ServerMessage } from "@/lib/ws/client";
import { useForexStore } from "@/lib/store";
import { ToastNotifications } from "@/components/ui/ToastNotifications";

/** Keep account metrics and open positions synchronized on every authenticated UI. */
function AccountRealtimeBridge() {
  const { status } = useSession();
  const applyAccount = useForexStore((state) => state.applyAccount);
  const applyPosition = useForexStore((state) => state.applyPosition);
  const setPositions = useForexStore((state) => state.setPositions);

  useEffect(() => {
    if (status !== "authenticated") return;

    socket.subscribeAccount();
    const off = socket.on((message: ServerMessage) => {
      if (message.type === "account_snapshot") {
        applyAccount(message.account);
        setPositions(message.positions);
      } else if (message.type === "account") {
        applyAccount(message.account);
      } else if (message.type === "position") {
        applyPosition(message.position);
      } else {
        return;
      }
      window.dispatchEvent(new CustomEvent("blckforest:realtime", { detail: message }));
    });

    return () => {
      off();
      socket.unsubscribeAccount();
    };
  }, [status, applyAccount, applyPosition, setPositions]);

  return null;
}

/** Wraps the app with NextAuth, realtime account sync, and one Query client. */
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 },
        },
      }),
  );
  return (
    <SessionProvider>
      <QueryClientProvider client={client}>
        <AccountRealtimeBridge />
        <ToastNotifications />
        {children}
      </QueryClientProvider>
    </SessionProvider>
  );
}
