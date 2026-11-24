import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { resolveUserId } from "@/server/db";
import {
  getUserLeverageSettings,
  LeverageSettingsError,
  resolveEffectiveLeverage,
  saveUserLeveragePreference,
} from "@/server/leverage";
import { prisma } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PreferenceSchema = z.object({
  scopeKey: z.string().trim().min(7).max(40),
  leverage: z.number().finite().min(1).max(500).nullable(),
});

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
    if (symbol) {
      const instrument = await prisma.instrument.findUnique({
        where: { symbol },
        select: {
          symbol: true,
          category: true,
          leverageNotionalFactor: true,
          leverageDefault: true,
          leverageMax: true,
        },
      });
      if (!instrument) return NextResponse.json({ error: "Instrument not found." }, { status: 404 });
      const effective = await resolveEffectiveLeverage(userId, symbol);
      return NextResponse.json({
        symbol,
        enabled: effective.enabled,
        default: effective.default?.toNumber() ?? null,
        maximum: effective.maximum?.toNumber() ?? null,
        selected: effective.selected?.toNumber() ?? null,
        notionalFactor: effective.notionalFactor?.toNumber() ?? null,
      });
    }

    return NextResponse.json(await getUserLeverageSettings(userId));
  } catch (error) {
    console.error("Leverage settings load failed:", error);
    return NextResponse.json({ error: "Unable to load leverage settings." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const userId = await authenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const parsed = PreferenceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid leverage preference.", details: parsed.error.flatten() }, { status: 400 });
  }
  const scopeKey = parsed.data.scopeKey.startsWith("asset:")
    ? `asset:${parsed.data.scopeKey.slice("asset:".length).toUpperCase()}`
    : parsed.data.scopeKey.toUpperCase().startsWith("CLASS:")
      ? `class:${parsed.data.scopeKey.slice("class:".length).toUpperCase()}`
      : parsed.data.scopeKey;

  try {
    await saveUserLeveragePreference(userId, scopeKey, parsed.data.leverage);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof LeverageSettingsError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Leverage preference save failed:", error);
    return NextResponse.json({ error: "Unable to save leverage preference." }, { status: 500 });
  }
}
