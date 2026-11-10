import { notFound, redirect } from "next/navigation";
import { resolveUserId } from "@/server/db";
import { listInstrumentViews } from "@/server/instruments";
import { Dashboard } from "@/components/trade/Dashboard";
import type { InstrumentView } from "@/lib/types";
import { getMarketDataMode } from "@/server/engine/marketDataMode";
import { resolveUserSettings } from "@/server/userSettings";

export const dynamic = "force-dynamic";
const LEGACY_SYMBOL_REDIRECTS: Record<string, string> = {
  MATICUSD: "POLUSD",
  VIX: "VIXY",
};

import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }): Promise<Metadata> {
  const { symbol } = await params;
  return {
    title: `${symbol.toUpperCase()} Chart`,
    description: `Live ${symbol.toUpperCase()} trading chart with real-time prices, technical indicators and order execution.`,
    robots: { index: false, follow: false },
  };
}


interface PageProps {
  params: Promise<{ symbol: string }>;
}

export default async function TradePage({ params }: PageProps) {
  const { symbol: symbolParam } = await params;
  const legacySymbol = LEGACY_SYMBOL_REDIRECTS[symbolParam.toUpperCase()];
  if (legacySymbol) redirect(`/trade/${legacySymbol}`);
  const instruments: InstrumentView[] = await listInstrumentViews();

  const instrument = instruments.find((i) => i.symbol.toUpperCase() === symbolParam.toUpperCase());
  if (!instrument) notFound();

  // Resolve per-user settings (trading enabled, deposit UI, payment methods).
  const session = await import("@/auth").then((m) => m.auth());
  if (!session?.user?.id) redirect("/login");
  const userId = await resolveUserId(session?.user?.id);
  const settings = await resolveUserSettings(userId);

  return (
    <Dashboard
      instrument={instrument}
      instruments={instruments}
      marketDataMode={getMarketDataMode()}
      depositUiEnabled={settings.deposits.uiEnabled}
      disabledPaymentMethods={["CARD", "BANK_TRANSFER", "CRYPTO"].filter(
        (m) => !settings.deposits.allowedMethods.includes(m),
      )}
      walletAddresses={settings.deposits.walletAddresses}
      marginWarningPercent={settings.trading.marginWarningPercent}
    />
  );
}
