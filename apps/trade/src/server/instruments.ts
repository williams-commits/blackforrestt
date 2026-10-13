import { hub } from "@/server/engine/hub";
import { prisma } from "@/server/db";
import type { InstrumentView } from "@/lib/types";

/**
 * Server instrument list for terminal entry points (`/` and `/trade/[symbol]`):
 * live hub views (with quotes) when the engine is up, otherwise the static
 * active-instrument rows from the DB ordered by symbol so the default entry
 * instrument is deterministic even without the engine. The first entry is the
 * platform's default instrument — never hardcode a symbol.
 */
export async function listInstrumentViews(): Promise<InstrumentView[]> {
  if (hub.isReady()) {
    return hub.listInstruments().map((s) => hub.instrumentView(s));
  }
  const rows = await prisma.instrument.findMany({
    where: { active: true },
    orderBy: { symbol: "asc" },
  });
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
