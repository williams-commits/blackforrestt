import { notFound } from "next/navigation";
import { hub } from "@/server/engine/hub";
import { prisma, resolveUserId } from "@/server/db";
import { Dashboard } from "@/components/trade/Dashboard";
import { TIMEFRAMES, type CandleInterval, type InstrumentView } from "@/lib/types";
import { getMarketDataMode } from "@/server/engine/marketDataMode";
import { resolveUserSettings } from "@/server/userSettings";

export const dynamic = "force-dynamic";

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
  searchParams: Promise<{ tf?: string | string[] }>;
}

function resolveInterval(value: string | string[] | undefined): CandleInterval | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && (TIMEFRAMES as readonly string[]).includes(candidate)
    ? (candidate as CandleInterval)
    : null;
}

async function getInstruments(): Promise<InstrumentView[]> {
  if (hub.isReady()) {
    return hub.listInstruments().map((s) => hub.instrumentView(s));
  }
  // Fallback: static list from the DB (no live quote).
  const rows = await prisma.instrument.findMany({ where: { active: true } });
  return rows.map((r) => ({
    symbol: r.symbol,
    name: r.name,
    category: r.category,
    base: r.base,
    quote: r.quote,
    digits: r.digits,
    pipSize: Number(r.pipSize),
    pipValue: Number(r.pipValue),
    contractSize: Number(r.contractSize),
    marginPerLot: Number(r.marginPerLot),
    commissionPerLot: Number(r.commissionPerLot),
    bid: Number(r.basePrice),
    ask: Number(r.basePrice),
    mid: Number(r.basePrice),
    changePct: 0,
  }));
}

export default async function TradePage({ params, searchParams }: PageProps) {
  const [{ symbol: symbolParam }, query] = await Promise.all([params, searchParams]);
  const instruments = await getInstruments();

  const instrument = instruments.find((i) => i.symbol.toUpperCase() === symbolParam.toUpperCase());
  if (!instrument) notFound();

  // Resolve per-user settings (trading enabled, deposit UI, payment methods).
  const session = await import("@/auth").then((m) => m.auth());
  const userId = await resolveUserId(session?.user?.id);
  const settings = await resolveUserSettings(userId);

  return (
    <Dashboard
      instrument={instrument}
      instruments={instruments}
      initialInterval={resolveInterval(query.tf)}
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
