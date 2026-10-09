import { NextResponse } from "next/server";
import { hub } from "@/server/engine/hub";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Instrument catalog for the global search palette (and any surface outside
 *  the terminal, where the WS snapshot already fills the client store).
 *  Trimmed to the fields a symbol jump needs. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const instruments = hub.isReady()
    ? hub
        .listInstruments()
        .map((symbol) => hub.instrumentView(symbol))
        .map((instrument) => ({
          symbol: instrument.symbol,
          name: instrument.name,
          category: instrument.category,
        }))
    : [];
  return NextResponse.json({ data: instruments });
}
