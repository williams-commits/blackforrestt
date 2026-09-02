"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { SessionProvider, useSession } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { socket, type ServerMessage } from "@/lib/ws/client";
import { useForexStore } from "@/lib/store";
import { ToastNotifications } from "@/components/ui/ToastNotifications";
import type { BrandProfile } from "@/lib/branding";

/** Client fallback when no provider is mounted (defensive — the root layout
 *  always resolves the per-domain brand server-side and passes it down). */
export const PRIMARY_BRAND_FALLBACK: BrandProfile = {
  domain: "blackforrestt.com",
  name: "Black Forest Digital",
  shortName: "Black Forest",
  legalName: "Black Forest Digital LTD",
  supportEmail: "support@blackforrestt.com",
  address: "",
  trademark: "Black Forest™",
  wordmark: ["Black", "Forest"],
  companyRegistrationNumber: "",
  companyJurisdiction: "",
  companyRegulator: "",
  companyLicenseNumber: "",
  investorCompensationScheme: "",
  tradeEnabled: true,
  emailFrom: "",
  emailReplyTo: "",
  emailColor: "",
  emailLogoUrl: "",
  ogImage: "",
  accentColor: "",
  markColor: "",
  glyph: null,
  heroBadge: "",
  heroSubtitle: "",
  metaDescription: "",
  logoLockup: "wordmark",
  logoWord: "",
  depositWallets: "",
  landingTemplate: "default",
};

const BrandContext = createContext<BrandProfile>(PRIMARY_BRAND_FALLBACK);

/** Per-domain branding for client components (logo wordmark, name, emails).
 *  The value is resolved from the request Host on the server — no hydration
 *  mismatch, no client env baking. */
export function useBrand(): BrandProfile {
  return useContext(BrandContext);
}

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
      } else if (message.type === "activity") {
        // Badge/toast channel — carried counts applied without a fetch.
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

/** Wraps the app with NextAuth, realtime account sync, one Query client, and
 *  the per-domain brand profile resolved for this request. */
export function Providers({ children, brand }: { children: React.ReactNode; brand?: BrandProfile }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 },
        },
      }),
  );
  return (
    <BrandContext.Provider value={brand ?? PRIMARY_BRAND_FALLBACK}>
      <SessionProvider>
        <QueryClientProvider client={client}>
          <AccountRealtimeBridge />
          <ToastNotifications />
          {children}
        </QueryClientProvider>
      </SessionProvider>
    </BrandContext.Provider>
  );
}
