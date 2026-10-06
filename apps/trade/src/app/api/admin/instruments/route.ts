import { NextResponse } from "next/server";
import { AdminError, requireAdmin } from "@/server/admin";
import { prisma } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin("INSTRUMENT_READ");
    const instruments = await prisma.instrument.findMany({ orderBy: [{ category: "asc" }, { symbol: "asc" }] });
    return NextResponse.json({
      instruments: instruments.map((item) => ({
        symbol: item.symbol,
        name: item.name,
        category: item.category,
        active: item.active,
        base: item.base,
        quote: item.quote,
        digits: item.digits,
        pipSize: item.pipSize.toFixed(8),
        pipValue: item.pipValue.toFixed(8),
        contractSize: item.contractSize.toFixed(4),
        marginPerLot: item.marginPerLot.toFixed(8),
        commissionPerLot: item.commissionPerLot.toFixed(8),
        swapLongPips: item.swapLongPips.toFixed(8),
        swapShortPips: item.swapShortPips.toFixed(8),
        feedSymbol: item.feedSymbol,
        updatedAt: item.updatedAt.toISOString(),
      })),
      mutationPolicy: "Changes require an approved maker-checker AdminChangeRequest.",
    });
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to load instruments." : (error as Error).message }, { status });
  }
}
