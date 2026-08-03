import { NextResponse } from "next/server";
import { hub } from "@/server/engine/hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/instruments — list forex pairs with live bid/ask/mid + change. */
export async function GET() {
  const instruments = hub.listInstruments().map((s) => hub.instrumentView(s));
  return NextResponse.json({ instruments });
}
