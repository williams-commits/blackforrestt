"use client";

import { createContext, useContext, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
  publicDesign: "default",
};

const BrandContext = createContext<BrandProfile>(PRIMARY_BRAND_FALLBACK);

/** Per-domain branding for client components (logo wordmark, name, emails).
 *  The value is resolved from the request Host on the server — no hydration
 *  mismatch, no client env baking. */
export function useBrand(): BrandProfile {
  return useContext(BrandContext);
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
              <QueryClientProvider client={client}>
          
          {children}
        </QueryClientProvider>
          </BrandContext.Provider>
  );
}
