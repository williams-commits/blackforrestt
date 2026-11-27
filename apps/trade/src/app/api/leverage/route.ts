import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveUserId } from "@/server/db";
import {
  LeverageSettingsError,
  resolveEffectiveLeverage,
} from "@/server/leverage";
import { hub } from "@/server/engine/hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authenticatedUserId(): Promise<string | null> {
  const session = await auth();
  try {
    return await resolveUserId(session?.user?.id);
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const userId = await authenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const symbol = new URL(request.url).searchParams.get("symbol")?.trim().toUpperCase();
    if (!symbol) return NextResponse.json({ error: "Instrument symbol is required." }, { status: 400 });
    const effective = await resolveEffectiveLeverage(symbol);
    const quoteToAccountRate = hub.quoteToAccountRate(symbol);
    const conversionAvailable = quoteToAccountRate != null && Number.isFinite(quoteToAccountRate) && quoteToAccountRate > 0;
    return NextResponse.json({
      symbol,
      enabled: effective.enabled,
      default: effective.default?.toNumber() ?? null,
      maximum: effective.maximum?.toNumber() ?? null,
      contractSize: effective.contractSize?.toNumber() ?? null,
      quoteToAccountRate,
      conversionAvailable,
    });
  } catch (error) {
    if (error instanceof LeverageSettingsError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Leverage settings load failed:", error);
    return NextResponse.json({ error: "Unable to load leverage settings." }, { status: 500 });
  }
}
