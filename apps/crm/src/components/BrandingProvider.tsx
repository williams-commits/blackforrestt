"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { CrmBranding } from "@/lib/branding";

/**
 * Client-side branding. BRANDING_* env vars are server-only (no
 * NEXT_PUBLIC_ prefix by design — they never leak into the JS bundle), so
 * the root layout resolves them once and injects the values here.
 */
const BrandingContext = createContext<CrmBranding | null>(null);

export function BrandingProvider({ value, children }: { value: CrmBranding; children: ReactNode }) {
  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useCrmBranding(): CrmBranding {
  return (
    useContext(BrandingContext) ?? {
      name: "Collo CRM",
      short: "Collo",
      logo: "C",
    }
  );
}
